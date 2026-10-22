-- ==============================================================================
-- Migration: 0016_auto_cleanup_72h_retention.sql
-- Requires: 0014_matched_status.sql
-- Description:
--   1. Moves auto-matched rows that were stored under the wrong status back to 'matched':
--      - 'saved' rows tagged notes = 'auto_matched' (fallback used before 0014 existed)
--      - 'ignored' rows that were never touched by the user (stored by the fallback, or
--        bulk-updated by a script). A user dismissing a project updates one row at a time,
--        so rows sharing an updated_at with more than 5 others were not dismissed by hand.
--      Projects the user saved (notes = 'user_saved'), applied to, won, or wrote an AI
--      proposal for are not touched.
--   2. Adds indexes for the 72-hour retention queries.
--   3. Creates cleanup_expired_projects_72h() with the same protection rules as
--      src/lib/cleanup/retention.ts. Deleting a project cascades to user_project_actions,
--      so any project someone acted on is never deleted.
-- ==============================================================================

-- 1a. Fallback-tagged auto matches stored as 'saved'
UPDATE public.user_project_actions
SET status = 'matched', notes = NULL
WHERE status = 'saved'
  AND notes = 'auto_matched'
  AND generated_proposal IS NULL;

-- 1b. Auto matches stored as 'ignored' that the user never dismissed
UPDATE public.user_project_actions upa
SET status = 'matched', notes = NULL
WHERE upa.status = 'ignored'
  AND (upa.notes IS NULL OR upa.notes = 'auto_matched')
  AND upa.generated_proposal IS NULL
  AND (
    upa.updated_at = upa.created_at
    OR upa.updated_at IN (
      SELECT updated_at FROM public.user_project_actions
      GROUP BY updated_at
      HAVING COUNT(*) > 5
    )
  );

-- 2. Indexes for date-range filtering and retention cleanup
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_published_at ON public.projects(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_pool_created_at ON public.leads_pool(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_pool_published_at ON public.leads_pool(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_project_actions_project_id ON public.user_project_actions(project_id);

-- 3. Retention cleanup: deletes projects older than retention_hours (minimum 24) that nobody acted on
CREATE OR REPLACE FUNCTION public.cleanup_expired_projects_72h(retention_hours INT DEFAULT 72)
RETURNS TABLE(deleted_projects_count INT, deleted_leads_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_time TIMESTAMPTZ := NOW() - (GREATEST(retention_hours, 24) || ' hours')::INTERVAL;
  p_count INT := 0;
  l_count INT := 0;
BEGIN
  WITH expired_projects AS (
    SELECT p.id, p.platform || '_' || p.external_id AS ext_post_id
    FROM public.projects p
    WHERE p.created_at < cutoff_time
      AND p.published_at < cutoff_time
      AND NOT EXISTS (
        SELECT 1 FROM public.user_project_actions upa
        WHERE upa.project_id = p.id
          AND (
            upa.status IN ('saved', 'applied', 'replied', 'won')
            OR upa.generated_proposal IS NOT NULL
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.auto_bid_queue q WHERE q.project_id = p.id
      )
  ),
  del_leads AS (
    DELETE FROM public.leads_pool lp
    WHERE lp.external_post_id IN (SELECT ext_post_id FROM expired_projects)
    RETURNING 1
  ),
  del_projs AS (
    DELETE FROM public.projects p
    WHERE p.id IN (SELECT id FROM expired_projects)
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM del_projs),
    (SELECT COUNT(*) FROM del_leads)
  INTO p_count, l_count;

  RETURN QUERY SELECT p_count, l_count;
END;
$$;

-- Only the backend (service role) may run it
REVOKE ALL ON FUNCTION public.cleanup_expired_projects_72h(INT) FROM PUBLIC, anon, authenticated;
