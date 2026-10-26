-- ==============================================================================
-- Migration: 0020_extension_keys.sql
-- Description:
--   Personal key for the PingLead Copilot browser extension. The extension sends it
--   as "Authorization: Bearer <key>" to /api/extension/analyze, which looks the user
--   up by the key's SHA-256 hash. Only the hash is stored; the key is shown once when
--   generated (Settings → profile) and generating a new one revokes the old one.
-- ==============================================================================

ALTER TABLE public.freelancer_profiles
  ADD COLUMN IF NOT EXISTS extension_key_hash TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS extension_key_created_at TIMESTAMPTZ;
