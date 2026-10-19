-- ==============================================================================
-- Migration: 0011_monthly_ai_credits.sql
-- Description:
--   Tracks when a user's AI credits were last renewed, so they top back up to the
--   monthly allowance at the start of each month (renewal happens lazily in the app
--   the first time credits are used in a new month).
-- ==============================================================================

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS credits_renewed_at TIMESTAMPTZ;
