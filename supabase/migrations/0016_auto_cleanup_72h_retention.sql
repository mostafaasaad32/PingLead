-- ==============================================================================
-- Migration: 0016_auto_cleanup_72h_retention.sql
-- Description:
--   1. Fixes saved projects status logic:
--      Only projects explicitly bookmarked by users (notes = 'user_saved') retain 'saved' status.
--      Auto-matched leads without proposals are converted to 'ignored' so they never
--      pollute the user's Saved Projects list.
--   2. Adds performance indexes for 72-hour retention queries.
--   3. Creates SQL stored function `cleanup_expired_projects_72h` with strict exemption:
--      Preserves bookmarked projects (notes = 'user_saved') and projects with AI proposals.
-- ==============================================================================

-- 1. Correct existing bogus 'saved' rows that were auto-matched by scraper
UPDATE public.user_project_actions
SET status = 'ignored'
WHERE status = 'saved'
  AND (notes IS NULL OR notes = 'auto_matched')
  AND generated_proposal IS NULL;

-- 2. Indexes for fast date-range filtering and 72-hour cleanup
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_published_at ON public.projects(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_pool_created_at ON public.leads_pool(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_pool_published_at ON public.leads_pool(published_at DESC);

-- 3. Stored Procedure for 72-hour database retention cleanup
CREATE OR REPLACE FUNCTION public.cleanup_expired_projects_72h(retention_hours INT DEFAULT 72)
RETURNS TABLE(deleted_projects_count INT, deleted_leads_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_time TIMESTAMPTZ := NOW() - (retention_hours || ' hours')::INTERVAL;
  p_count INT := 0;
  l_count INT := 0;
BEGIN
  -- Delete matching leads from leads_pool for projects older than cutoff
  -- EXCLUDING any project bookmarked by a user (notes = 'user_saved') or having a generated proposal
  WITH expired_projects AS (
    SELECT p.id, p.platform || '_' || p.external_id AS ext_post_id
    FROM public.projects p
    WHERE p.created_at < cutoff_time
      AND NOT EXISTS (
        SELECT 1 FROM public.user_project_actions upa
        WHERE upa.project_id = p.id
          AND (upa.notes = 'user_saved' OR upa.generated_proposal IS NOT NULL)
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
