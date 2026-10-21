-- ==============================================================================
-- Migration: 0015_profile_audit_sync_and_history.sql
-- Description:
--   1. freelancer_profiles.platform_audits: JSONB storage of multi-platform audit results
--      (Upwork, Mostaql, Khamsat, etc.) for instant zero-token switching.
--   2. freelancer_profiles.persona_en & persona_ar: Dual-language master profile
--      storing approved titles, overviews, and social proofs for AI proposals.
-- ==============================================================================

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS platform_audits JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS persona_en JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS persona_ar JSONB DEFAULT '{}'::jsonb;
