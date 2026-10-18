-- ==============================================================================
-- supabase/migrations/0002_expand_platforms.sql
-- Drop platform constraint to allow all global & Arabic freelance aggregator platforms
-- ==============================================================================

-- 1. Remove the restrictive 3-platform constraint
ALTER TABLE public.leads_pool 
  DROP CONSTRAINT IF EXISTS leads_pool_platform_check;

-- 2. Optional: Add an updated expanded check constraint or leave unconstrained for maximum flexibility
-- We leave it unconstrained or expand it to all supported aggregator platforms:
ALTER TABLE public.leads_pool
  ADD CONSTRAINT leads_pool_platform_check
  CHECK (platform IN (
    'reddit', 'twitter', 'linkedin', 'x',
    'mostaql', 'nafezly', 'khamsat', 'kafiil', 'baeed',
    'freelancer', 'pph', 'wwr', 'remoteok', 'hackernews'
  ));
