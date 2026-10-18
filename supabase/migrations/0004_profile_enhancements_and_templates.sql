-- ==============================================================================
-- Migration: 0004_profile_enhancements_and_templates.sql
-- Project: PingLead (Vollna UI/UX Alignment & DB Persistence Overhaul)
-- Description:
--   1. Add ai_credits, country, timezone, time_format to freelancer_profiles
--   2. Create proposal_templates table with RLS
--   3. Update handle_new_freelancer_user trigger for 25 credits & Egypt defaults
--   4. Backfill existing user records
-- ==============================================================================

-- 1. Alter freelancer_profiles to add credits & locale preferences
ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS ai_credits INTEGER NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'Egypt',
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Africa/Cairo',
  ADD COLUMN IF NOT EXISTS time_format TEXT NOT NULL DEFAULT '12h';

-- 2. Create proposal_templates table (Vollna Proposal Templates feature)
CREATE TABLE IF NOT EXISTS public.proposal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sender_name TEXT,
  hourly_rate NUMERIC DEFAULT 30,
  pricing_type TEXT NOT NULL DEFAULT 'job_terms' CHECK (pricing_type IN ('job_terms', 'custom')),
  filter_id UUID REFERENCES public.user_filters(id) ON DELETE SET NULL,
  template_body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_templates_user ON public.proposal_templates(user_id);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS trg_proposal_templates_updated_at ON public.proposal_templates;
CREATE TRIGGER trg_proposal_templates_updated_at
  BEFORE UPDATE ON public.proposal_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Enable RLS on proposal_templates
ALTER TABLE public.proposal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own proposal templates" ON public.proposal_templates;
CREATE POLICY "Users manage own proposal templates"
  ON public.proposal_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Update the user registration trigger function
CREATE OR REPLACE FUNCTION public.handle_new_freelancer_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Strict Check: Do not insert any data if the user has not completed verification yet
  IF NEW.email_confirmed_at IS NULL AND NEW.confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only proceed if the user just became verified (transition from unverified -> verified)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.email_confirmed_at IS NOT NULL OR OLD.confirmed_at IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Create default profile with 25 AI credits and Egyptian timezone
  INSERT INTO public.freelancer_profiles (
    user_id,
    full_name,
    ai_credits,
    country,
    timezone,
    time_format
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    25,
    'Egypt',
    'Africa/Cairo',
    '12h'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    ai_credits = COALESCE(public.freelancer_profiles.ai_credits, 25),
    country = COALESCE(public.freelancer_profiles.country, 'Egypt'),
    timezone = COALESCE(public.freelancer_profiles.timezone, 'Africa/Cairo'),
    time_format = COALESCE(public.freelancer_profiles.time_format, '12h');

  -- Create default filter if not exists
  INSERT INTO public.user_filters (user_id, filter_name, categories, min_budget_usd, is_active)
  VALUES (
    NEW.id,
    'تطوير البرمجيات (افتراضي)',
    ARRAY['web_dev'],
    0,
    TRUE
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_freelancer ON auth.users;
CREATE TRIGGER on_auth_user_created_freelancer
  AFTER INSERT OR UPDATE OF email_confirmed_at, confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_freelancer_user();

-- 4. Backfill any existing users in auth.users missing freelancer_profiles
INSERT INTO public.freelancer_profiles (user_id, full_name, ai_credits, country, timezone, time_format)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)),
  25,
  'Egypt',
  'Africa/Cairo',
  '12h'
FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET
  ai_credits = COALESCE(public.freelancer_profiles.ai_credits, 25),
  country = COALESCE(public.freelancer_profiles.country, 'Egypt'),
  timezone = COALESCE(public.freelancer_profiles.timezone, 'Africa/Cairo'),
  time_format = COALESCE(public.freelancer_profiles.time_format, '12h');
