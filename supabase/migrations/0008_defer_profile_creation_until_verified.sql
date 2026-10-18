-- ==============================================================================
-- Migration: 0008_defer_profile_creation_until_verified.sql
-- Project: PingLead
-- Description:
--   Ensure user data across all tables (public.profiles, public.freelancer_profiles,
--   public.user_filters, public.auto_bidding_configs) is ONLY inserted after the user
--   finishes verification (email_confirmed_at IS NOT NULL or confirmed_at IS NOT NULL).
-- ==============================================================================

-- 1. Update public.handle_new_user() trigger function for public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
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

  -- User is verified! Create default profile in public.profiles
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger for public.profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email_confirmed_at, confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. Update public.handle_new_freelancer_user() trigger function for freelancer tables
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

  -- User is verified! Create default profile with 25 AI credits and Egyptian timezone
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
    full_name = COALESCE(EXCLUDED.full_name, public.freelancer_profiles.full_name),
    ai_credits = COALESCE(public.freelancer_profiles.ai_credits, 25);

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

  -- Create default auto-bidding config if not exists
  INSERT INTO public.auto_bidding_configs (
    user_id,
    is_enabled,
    min_match_score,
    schedule_start_hour,
    schedule_end_hour,
    review_mode,
    daily_limit,
    smart_delay_minutes
  )
  VALUES (
    NEW.id,
    FALSE,
    80,
    8,
    23,
    'require_approval',
    10,
    5
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger for freelancer tables
DROP TRIGGER IF EXISTS on_auth_user_created_freelancer ON auth.users;
CREATE TRIGGER on_auth_user_created_freelancer
  AFTER INSERT OR UPDATE OF email_confirmed_at, confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_freelancer_user();


-- 3. Clean up any existing orphan rows in public tables for unconfirmed users
DELETE FROM public.profiles
WHERE id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL AND confirmed_at IS NULL
);

DELETE FROM public.freelancer_profiles
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL AND confirmed_at IS NULL
);

DELETE FROM public.user_filters
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL AND confirmed_at IS NULL
);

DELETE FROM public.auto_bidding_configs
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email_confirmed_at IS NULL AND confirmed_at IS NULL
);
