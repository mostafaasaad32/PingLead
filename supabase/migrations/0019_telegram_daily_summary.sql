-- ==============================================================================
-- Migration: 0019_telegram_daily_summary.sql
-- Description:
--   Daily Telegram summary at 9:00 in the user's timezone: yesterday's matches,
--   what the user applied to / got replies on / won, and the best matches still
--   waiting for a proposal. On by default for linked Telegram users.
--   telegram_summary_sent_at prevents a second summary on the same day.
-- ==============================================================================

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS telegram_summary BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS telegram_summary_sent_at TIMESTAMPTZ;
