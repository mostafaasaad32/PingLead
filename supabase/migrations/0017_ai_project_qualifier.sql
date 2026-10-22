-- ==============================================================================
-- Migration: 0017_ai_project_qualifier.sql
-- Description:
--   AI project qualifier: the user writes plain-language criteria on a filter, the AI
--   scores every new match 0-100 with a one-line reason, and Telegram alerts only go
--   out for scores at or above the filter's threshold.
--   1. user_filters.ai_criteria   - the criteria (NULL/empty = qualifier off)
--      user_filters.ai_min_score  - alert threshold (default 70)
--   2. user_project_actions.ai_score / ai_reason - the result per match
--   3. freelancer_profiles.ai_evals_used / ai_evals_month - monthly evaluation quota,
--      separate from the proposal credits (reset when the month changes)
-- ==============================================================================

ALTER TABLE public.user_filters
  ADD COLUMN IF NOT EXISTS ai_criteria TEXT CHECK (ai_criteria IS NULL OR char_length(ai_criteria) <= 1000),
  ADD COLUMN IF NOT EXISTS ai_min_score INTEGER NOT NULL DEFAULT 70 CHECK (ai_min_score BETWEEN 0 AND 100);

ALTER TABLE public.user_project_actions
  ADD COLUMN IF NOT EXISTS ai_score INTEGER CHECK (ai_score IS NULL OR ai_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS ai_reason TEXT;

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS ai_evals_used INTEGER NOT NULL DEFAULT 0 CHECK (ai_evals_used >= 0),
  ADD COLUMN IF NOT EXISTS ai_evals_month TEXT;
