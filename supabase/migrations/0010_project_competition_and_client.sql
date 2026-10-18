-- ==============================================================================
-- Migration: 0010_project_competition_and_client.sql
-- Description:
--   Competition & client-quality signals scraped from the source platforms:
--     - bids_count / bids_avg: how many freelancers already applied (and average bid)
--     - client_*: the project owner's history (Mostaql project page, Nafezly card)
--     - duration_text: requested delivery time as shown on the platform
--     - details_fetched_at: when the project page itself was last read
-- ==============================================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS bids_count INTEGER,
  ADD COLUMN IF NOT EXISTS bids_avg NUMERIC,
  ADD COLUMN IF NOT EXISTS client_hire_rate NUMERIC CHECK (client_hire_rate IS NULL OR client_hire_rate BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS client_open_projects INTEGER,
  ADD COLUMN IF NOT EXISTS client_in_progress INTEGER,
  ADD COLUMN IF NOT EXISTS client_registered_at TEXT,
  ADD COLUMN IF NOT EXISTS client_country TEXT,
  ADD COLUMN IF NOT EXISTS duration_text TEXT,
  ADD COLUMN IF NOT EXISTS details_fetched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_bids_count ON public.projects(bids_count);
