-- ==============================================================================
-- Migration: 0003_vollna_architecture.sql
-- Project: PingLead (Vollna.com Alternative Architecture)
-- Description:
--   1. projects (Unified 9 freelance platforms storage with dedup)
--   2. freelancer_profiles (Bio, tone of voice, skills, telegram)
--   3. portfolio_items (AI Vault for context-aware proposal generation)
--   4. user_filters (Vollna-style alert criteria & keywords)
--   5. user_project_actions (Mini-CRM: saved, applied, ignored, won, generated proposals)
--   6. Indexes, RLS security policies, and updated_at triggers
-- ==============================================================================

-- Ensure uuid-ossp or pgcrypto extension is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Helper Function: Automatic updated_at timestamp trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. Projects Table (Normalized multi-platform freelance projects pool)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN (
    'mostaql', 'nafezly', 'khamsat', 'kafiil', 'baeed',
    'freelancer', 'remoteok', 'pph', 'wwr'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL,
  budget TEXT,
  budget_min NUMERIC,
  budget_max NUMERIC,
  currency TEXT DEFAULT 'USD',
  budget_usd_estimate NUMERIC,
  category TEXT NOT NULL CHECK (category IN (
    'web_dev', 'design', 'marketing', 'accounting', 'writing', 'other'
  )),
  language TEXT NOT NULL DEFAULT 'ar' CHECK (language IN ('ar', 'en')),
  author TEXT DEFAULT 'صاحب مشروع',
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_platform_external_id UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_platform_external_id ON public.projects(platform, external_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_published_at ON public.projects(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_budget_usd ON public.projects(budget_usd_estimate);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 3. Freelancer Profiles Table (Subscriber context & AI Tone)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.freelancer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  title TEXT, -- e.g. "Senior Full-Stack & Next.js Engineer"
  bio TEXT,   -- In-depth bio and value proposition
  skills TEXT[] DEFAULT '{}',
  tone_of_voice TEXT NOT NULL DEFAULT 'confident' CHECK (tone_of_voice IN (
    'confident', 'friendly', 'analytical', 'direct'
  )),
  telegram_chat_id TEXT UNIQUE,
  telegram_connect_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_user_id ON public.freelancer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_telegram_chat ON public.freelancer_profiles(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_freelancer_profiles_token ON public.freelancer_profiles(telegram_connect_token);

DROP TRIGGER IF EXISTS trg_freelancer_profiles_updated_at ON public.freelancer_profiles;
CREATE TRIGGER trg_freelancer_profiles_updated_at
  BEFORE UPDATE ON public.freelancer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 4. Portfolio Items Table (AI Vault - Past work used by Gemini for proof)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_title TEXT NOT NULL,
  description TEXT NOT NULL,
  live_url TEXT,
  tags TEXT[] DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'web_dev',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_items_user_cat ON public.portfolio_items(user_id, category);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_tags ON public.portfolio_items USING GIN(tags);

DROP TRIGGER IF EXISTS trg_portfolio_items_updated_at ON public.portfolio_items;
CREATE TRIGGER trg_portfolio_items_updated_at
  BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 5. User Filters Table (Vollna Smart Filter Engine)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filter_name TEXT NOT NULL,
  platforms TEXT[] DEFAULT '{}', -- Empty array means all 9 platforms
  categories TEXT[] DEFAULT '{}', -- Empty array means all categories
  include_keywords TEXT[] DEFAULT '{}',
  exclude_keywords TEXT[] DEFAULT '{}',
  min_budget_usd NUMERIC DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notify_telegram BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_filters_user_active ON public.user_filters(user_id, is_active);

DROP TRIGGER IF EXISTS trg_user_filters_updated_at ON public.user_filters;
CREATE TRIGGER trg_user_filters_updated_at
  BEFORE UPDATE ON public.user_filters
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 6. User Project Actions Table (Mini-CRM & Proposal Tracker)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_project_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN (
    'saved', 'applied', 'ignored', 'won'
  )),
  generated_proposal TEXT,
  notes TEXT,
  matched_filter_id UUID REFERENCES public.user_filters(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_user_project_action UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_user_project_actions_user_status ON public.user_project_actions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_project_actions_project ON public.user_project_actions(project_id);

DROP TRIGGER IF EXISTS trg_user_project_actions_updated_at ON public.user_project_actions;
CREATE TRIGGER trg_user_project_actions_updated_at
  BEFORE UPDATE ON public.user_project_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 7. Automated Synchronization Trigger (auth.users -> freelancer_profiles)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_freelancer_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.freelancer_profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Also create a default Vollna-style filter for the user
  INSERT INTO public.user_filters (user_id, filter_name, categories, min_budget_usd, is_active)
  VALUES (
    NEW.id,
    'تطوير البرمجيات (افتراضي)',
    ARRAY['web_dev'],
    0,
    TRUE
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_freelancer ON auth.users;
CREATE TRIGGER on_auth_user_created_freelancer
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_freelancer_user();

-- ==============================================================================
-- 8. Row Level Security (RLS) Setup
-- ==============================================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freelancer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_project_actions ENABLE ROW LEVEL SECURITY;

-- 8.1. Projects Policies:
-- Any authenticated user can read verified projects. Service role has full write access.
DROP POLICY IF EXISTS "Projects are readable by all authenticated users" ON public.projects;
CREATE POLICY "Projects are readable by all authenticated users"
  ON public.projects FOR SELECT
  TO authenticated
  USING (TRUE);

-- 8.2. Freelancer Profiles Policies:
-- Users can read and update only their own profile.
DROP POLICY IF EXISTS "Users can view own freelancer profile" ON public.freelancer_profiles;
CREATE POLICY "Users can view own freelancer profile"
  ON public.freelancer_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own freelancer profile" ON public.freelancer_profiles;
CREATE POLICY "Users can update own freelancer profile"
  ON public.freelancer_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own freelancer profile" ON public.freelancer_profiles;
CREATE POLICY "Users can insert own freelancer profile"
  ON public.freelancer_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 8.3. Portfolio Items Policies:
-- Users can perform all operations (CRUD) only on their own portfolio items.
DROP POLICY IF EXISTS "Users manage own portfolio items" ON public.portfolio_items;
CREATE POLICY "Users manage own portfolio items"
  ON public.portfolio_items FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8.4. User Filters Policies:
-- Users manage their own Vollna-style filter rules.
DROP POLICY IF EXISTS "Users manage own filters" ON public.user_filters;
CREATE POLICY "Users manage own filters"
  ON public.user_filters FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8.5. User Project Actions (CRM) Policies:
-- Users manage their own project statuses, saved lists, and generated proposals.
DROP POLICY IF EXISTS "Users manage own project actions" ON public.user_project_actions;
CREATE POLICY "Users manage own project actions"
  ON public.user_project_actions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
