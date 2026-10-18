-- ==============================================================================
-- Migration: 0001_init_schema.sql
-- Project: AI Lead Radar (PingLead)
-- Description: Core schema, RLS policies, automated triggers, and initial category seeds
-- ==============================================================================

-- 1. Create Profiles Table (User settings, bio context, Telegram connect)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  bio_context TEXT, -- نبذة عن خدمات المشترك يستخدمها الـ AI لصياغة الرد الذكي المخصص
  telegram_chat_id TEXT UNIQUE,
  telegram_connect_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  subscription_tier TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_tier IN ('trial', 'freelancer', 'agency', 'expired')),
  subscription_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 days'),
  smart_replies_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Categories Table (Standard niches & pooled query settings)
CREATE TABLE IF NOT EXISTS public.categories (
  slug TEXT PRIMARY KEY, -- e.g. 'web_dev', 'ui_ux', 'marketing', 'accounting'
  name_ar TEXT NOT NULL,
  reddit_subreddits TEXT[] NOT NULL,
  boolean_query_ar TEXT NOT NULL,
  boolean_query_en TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. Create User Subscriptions Map (Links users to watched categories)
CREATE TABLE IF NOT EXISTS public.user_subscriptions_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category_slug TEXT NOT NULL REFERENCES public.categories(slug) ON DELETE CASCADE,
  custom_include_keywords TEXT[] DEFAULT '{}',
  min_intent_score INT NOT NULL DEFAULT 8,
  UNIQUE(user_id, category_slug)
);

-- 4. Create Deduplicated Leads Pool (Single global storage for all posts)
CREATE TABLE IF NOT EXISTS public.leads_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('reddit', 'twitter', 'linkedin')),
  external_post_id TEXT NOT NULL,
  author_handle TEXT,
  post_text TEXT NOT NULL,
  post_url TEXT NOT NULL,
  category_slug TEXT REFERENCES public.categories(slug),
  intent_score INT CHECK (intent_score BETWEEN 0 AND 10),
  is_buyer BOOLEAN DEFAULT FALSE,
  ai_reason_short TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rejected_regex', 'scored', 'dispatched')),
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, external_post_id)
);

-- 5. Create User Lead Deliveries Table (Audit log of dispatched leads & smart replies)
CREATE TABLE IF NOT EXISTS public.user_lead_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads_pool(id) ON DELETE CASCADE,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  smart_reply_generated TEXT,
  smart_reply_generated_at TIMESTAMPTZ,
  UNIQUE(user_id, lead_id)
);

-- ==============================================================================
-- Row Level Security (RLS)
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_lead_deliveries ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view and update their own record
CREATE POLICY "Users can view own profile" 
  ON public.profiles FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id);

-- Categories: Read-only for all authenticated users
CREATE POLICY "Categories are readable by authenticated users" 
  ON public.categories FOR SELECT 
  TO authenticated 
  USING (is_active = TRUE);

-- User Subscriptions Map: Users can manage their own subscriptions
CREATE POLICY "Users manage own subscriptions" 
  ON public.user_subscriptions_map FOR ALL 
  USING (auth.uid() = user_id);

-- Leads Pool: Authenticated users can view scored leads in their subscribed categories
CREATE POLICY "Users can view matched leads" 
  ON public.leads_pool FOR SELECT 
  TO authenticated 
  USING (
    status IN ('scored', 'dispatched') AND
    category_slug IN (
      SELECT category_slug FROM public.user_subscriptions_map WHERE user_id = auth.uid()
    )
  );

-- Lead Deliveries: Users can view their own deliveries
CREATE POLICY "Users can view own deliveries" 
  ON public.user_lead_deliveries FOR SELECT 
  USING (auth.uid() = user_id);

-- ==============================================================================
-- Automated User Profile Creation Trigger
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- Initial Seed Data: 4 Core Categories with High-Intent Boolean Queries
-- ==============================================================================

INSERT INTO public.categories (slug, name_ar, reddit_subreddits, boolean_query_ar, boolean_query_en, is_active)
VALUES
  (
    'web_dev',
    'تطوير البرمجيات والمواقع',
    ARRAY['forhire', 'freelance_forhire', 'webdev', 'Egypt', 'saudiarabia'],
    '("محتاج مبرمج" OR "مطلوب مبرمج" OR "ابحث عن مبرمج" OR "احتاج مبرمج" OR "حد يرشحلي مبرمج" OR "شخص يعمل موقع" OR "تطبيق جوال")',
    '("looking for developer" OR "need a programmer" OR "hiring web developer" OR "build my website" OR "software agency recommendation")',
    TRUE
  ),
  (
    'ui_ux',
    'تصميم الواجهات وتجربة المستخدم',
    ARRAY['forhire', 'designjobs', 'freelance_forhire', 'Egypt', 'saudiarabia'],
    '("محتاج مصمم" OR "مطلوب مصمم" OR "احتاج مصمم واجهات" OR "تصميم UI/UX" OR "تصميم لوجو وهوية")',
    '("looking for UI designer" OR "need UX designer" OR "hiring designer" OR "redesign website" OR "app design quote")',
    TRUE
  ),
  (
    'marketing',
    'التسويق الرقمي وإدارة الحملات',
    ARRAY['forhire', 'freelance_forhire', 'digital_marketing', 'Egypt', 'saudiarabia'],
    '("محتاج مسوق" OR "مطلوب مسوق الكتروني" OR "ادارة حملات اعلانية" OR "خبير سيو" OR "شركة تسويق")',
    '("looking for marketer" OR "hire media buyer" OR "need SEO expert" OR "run ads for my store" OR "marketing agency recommendation")',
    TRUE
  ),
  (
    'accounting',
    'المحاسبة والخدمات المالية',
    ARRAY['forhire', 'freelance_forhire', 'accounting', 'Egypt', 'saudiarabia'],
    '("محتاج محاسب" OR "مطلوب محاسب قانوني" OR "اعداد قوائم مالية" OR "ضرائب واقرارات" OR "برنامج محاسبة")',
    '("need an accountant" OR "looking for bookkeeper" OR "hire CPA" OR "tax preparation help" OR "financial auditing services")',
    TRUE
  )
ON CONFLICT (slug) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  reddit_subreddits = EXCLUDED.reddit_subreddits,
  boolean_query_ar = EXCLUDED.boolean_query_ar,
  boolean_query_en = EXCLUDED.boolean_query_en,
  is_active = EXCLUDED.is_active;
