-- ==============================================================================
-- Migration: 0022_writing_sample.sql
-- Description:
--   Add writing_sample column to freelancer_profiles for Few-Shot Human Style Cloning.
-- ==============================================================================

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS writing_sample TEXT;
