-- ==============================================================================
-- Migration: 0021_feedback.sql
-- Description:
--   In-app feedback for the beta ("رأيك" button on every dashboard page).
--   Users can add and read their own rows; the team reads everything from /admin
--   (service role). status lets the team mark items as handled.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'other' CHECK (kind IN ('bug', 'idea', 'praise', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 3 AND 2000),
  page TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'seen', 'done')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users add their own feedback" ON public.feedback;
CREATE POLICY "Users add their own feedback" ON public.feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read their own feedback" ON public.feedback;
CREATE POLICY "Users read their own feedback" ON public.feedback
  FOR SELECT USING (auth.uid() = user_id);
