-- ==============================================================================
-- Migration: 0018_push_and_email_digest.sql
-- Description:
--   Alerts for users who don't use Telegram:
--   1. push_subscriptions: one row per browser/device that allowed notifications
--      (Web Push endpoint + keys). Rows are removed when the push service reports
--      the subscription gone (HTTP 404/410).
--   2. freelancer_profiles.email_digest ('off' | 'hourly' | 'daily') and
--      email_digest_sent_at: an email summary of new matches.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage their own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS email_digest TEXT NOT NULL DEFAULT 'off'
    CHECK (email_digest IN ('off', 'hourly', 'daily')),
  ADD COLUMN IF NOT EXISTS email_digest_sent_at TIMESTAMPTZ;
