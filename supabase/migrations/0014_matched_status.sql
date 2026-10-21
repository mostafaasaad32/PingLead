-- ==============================================================================
-- Migration: 0014_matched_status.sql
-- Description:
--   1. Adds 'matched' to user_project_actions.status check constraint.
--      - 'matched': System-matched lead delivered via filters/inbox.
--      - 'saved': Manually bookmarked project by the user.
--      - 'applied': Freelancer actually applied / submitted bid on the platform.
--      - 'replied': Client sent a response/message.
--      - 'won': Freelancer was awarded the project.
--      - 'ignored': Freelancer dismissed/hid the project.
--   2. Updates existing filter-matched rows from 'saved' to 'matched' so
--      saved count reflects only user-bookmarked projects.
-- ==============================================================================

ALTER TABLE public.user_project_actions
  DROP CONSTRAINT IF EXISTS user_project_actions_status_check;

ALTER TABLE public.user_project_actions
  ADD CONSTRAINT user_project_actions_status_check
  CHECK (status IN ('matched', 'saved', 'applied', 'replied', 'ignored', 'won'));

-- Migrate existing auto-matched leads (which have a filter ID and no proposal/notes) to 'matched'
UPDATE public.user_project_actions
SET status = 'matched'
WHERE status = 'saved'
  AND matched_filter_id IS NOT NULL
  AND generated_proposal IS NULL;
