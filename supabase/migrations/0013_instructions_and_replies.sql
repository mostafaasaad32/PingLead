-- ==============================================================================
-- Migration: 0013_instructions_and_replies.sql
-- Description:
--   1. freelancer_profiles.proposal_instructions: standing instructions the AI follows
--      in every proposal (e.g. "always mention a one-month guarantee").
--   2. user_project_actions.status gains 'replied' (the client answered), between
--      'applied' and 'won', so analytics can show a reply rate.
-- ==============================================================================

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS proposal_instructions TEXT;

ALTER TABLE public.user_project_actions
  DROP CONSTRAINT IF EXISTS user_project_actions_status_check;

ALTER TABLE public.user_project_actions
  ADD CONSTRAINT user_project_actions_status_check
  CHECK (status IN ('saved', 'applied', 'replied', 'ignored', 'won'));
