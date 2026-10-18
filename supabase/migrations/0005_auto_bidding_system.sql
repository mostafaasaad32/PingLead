-- ==============================================================================
-- Migration: 0005_auto_bidding_system.sql
-- Project: PingLead (Vollna Auto-Bidding Engine Architecture)
-- Description:
--   1. auto_bidding_configs (User rules, AI score threshold, scheduling, A/B templates, attachments)
--   2. auto_bid_queue (Generated proposals queued for 1-click approval or auto-sending)
--   3. Triggers, RLS policies, and backfilling
-- ==============================================================================

-- 1. Create auto_bidding_configs table
CREATE TABLE IF NOT EXISTS public.auto_bidding_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  min_match_score INTEGER NOT NULL DEFAULT 80 CHECK (min_match_score BETWEEN 50 AND 100),
  schedule_start_hour INTEGER NOT NULL DEFAULT 8 CHECK (schedule_start_hour BETWEEN 0 AND 23),
  schedule_end_hour INTEGER NOT NULL DEFAULT 23 CHECK (schedule_end_hour BETWEEN 0 AND 23),
  active_days TEXT[] NOT NULL DEFAULT '{"monday","tuesday","wednesday","thursday","friday","saturday","sunday"}',
  review_mode TEXT NOT NULL DEFAULT 'require_approval' CHECK (review_mode IN ('require_approval', 'full_auto')),
  ab_testing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  template_a_id UUID REFERENCES public.proposal_templates(id) ON DELETE SET NULL,
  template_b_id UUID REFERENCES public.proposal_templates(id) ON DELETE SET NULL,
  daily_limit INTEGER NOT NULL DEFAULT 10 CHECK (daily_limit BETWEEN 1 AND 50),
  smart_delay_minutes INTEGER NOT NULL DEFAULT 5 CHECK (smart_delay_minutes BETWEEN 1 AND 60),
  smart_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_bidding_configs_user ON public.auto_bidding_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_bidding_configs_enabled ON public.auto_bidding_configs(is_enabled);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS trg_auto_bidding_configs_updated_at ON public.auto_bidding_configs;
CREATE TRIGGER trg_auto_bidding_configs_updated_at
  BEFORE UPDATE ON public.auto_bidding_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Enable RLS on auto_bidding_configs
ALTER TABLE public.auto_bidding_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own auto bidding config" ON public.auto_bidding_configs;
CREATE POLICY "Users manage own auto bidding config"
  ON public.auto_bidding_configs FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Create auto_bid_queue table
CREATE TABLE IF NOT EXISTS public.auto_bid_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads_pool(id) ON DELETE SET NULL,
  match_score INTEGER NOT NULL DEFAULT 80,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected', 'auto_sent')),
  generated_proposal TEXT NOT NULL,
  template_used_id UUID REFERENCES public.proposal_templates(id) ON DELETE SET NULL,
  template_variant TEXT CHECK (template_variant IN ('A', 'B')),
  selected_attachment JSONB,
  platform_url TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_bid_queue_user_status ON public.auto_bid_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_auto_bid_queue_created_at ON public.auto_bid_queue(created_at DESC);

-- Attach updated_at trigger
DROP TRIGGER IF EXISTS trg_auto_bid_queue_updated_at ON public.auto_bid_queue;
CREATE TRIGGER trg_auto_bid_queue_updated_at
  BEFORE UPDATE ON public.auto_bid_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Enable RLS on auto_bid_queue
ALTER TABLE public.auto_bid_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own auto bid queue" ON public.auto_bid_queue;
CREATE POLICY "Users manage own auto bid queue"
  ON public.auto_bid_queue FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Backfill existing users with default auto_bidding_configs
INSERT INTO public.auto_bidding_configs (
  user_id,
  is_enabled,
  min_match_score,
  schedule_start_hour,
  schedule_end_hour,
  review_mode,
  daily_limit,
  smart_delay_minutes,
  smart_attachments
)
SELECT
  id,
  FALSE,
  80,
  8,
  23,
  'require_approval',
  10,
  5,
  '[
    {
      "id": "att-1",
      "title": "معرض نماذج الأعمال (PDF Portfolio)",
      "url_or_file": "https://pinglead.example.com/portfolio.pdf",
      "trigger_conditions": "Next.js, React, Full Stack, SaaS"
    }
  ]'::jsonb
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
