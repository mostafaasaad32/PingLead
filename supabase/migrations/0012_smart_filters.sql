-- ==============================================================================
-- Migration: 0012_smart_filters.sql
-- Description:
--   Competition & client-quality conditions on user filters (data from migration 0010):
--     - max_bids:             skip projects that already have more bids than this
--     - min_client_hire_rate: skip clients whose hire rate (%) is below this
--     - exclude_new_clients:  skip clients who have never hired anyone (Mostaql)
--     - job_type:             'any' | 'fixed' | 'hourly'
--     - client_countries:     only clients from these countries (empty = any)
--   Projects whose platform doesn't expose a value always pass that condition.
-- ==============================================================================

ALTER TABLE public.user_filters
  ADD COLUMN IF NOT EXISTS max_bids INTEGER CHECK (max_bids IS NULL OR max_bids >= 0),
  ADD COLUMN IF NOT EXISTS min_client_hire_rate INTEGER CHECK (min_client_hire_rate IS NULL OR min_client_hire_rate BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS exclude_new_clients BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'any' CHECK (job_type IN ('any', 'fixed', 'hourly')),
  ADD COLUMN IF NOT EXISTS client_countries TEXT[] NOT NULL DEFAULT '{}';
