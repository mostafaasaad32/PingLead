-- ==============================================================================
-- Migration: 0007_expand_platforms_and_categories.sql
-- Description: Expand constraints for 20 Platforms & 14 Full Categories
-- ==============================================================================

-- 1. Alter public.projects constraints
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_platform_check;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_category_check;

-- 2. Alter public.leads_pool constraints
ALTER TABLE public.leads_pool DROP CONSTRAINT IF EXISTS leads_pool_platform_check;

-- 3. Upsert the 14 categories into public.categories to satisfy foreign keys
INSERT INTO public.categories (slug, name_ar, reddit_subreddits, boolean_query_ar, boolean_query_en, is_active)
VALUES
  ('web_mobile_dev', 'برمجة وتطوير المواقع والتطبيقات', '{}', '', '', true),
  ('ai_data_automation', 'الذكاء الاصطناعي والبيانات والأتمتة', '{}', '', '', true),
  ('ui_ux_graphic', 'التصميم والجرافيك وUI/UX', '{}', '', '', true),
  ('video_audio_motion', 'المونتاج والموشن جرافيك والصوتيات', '{}', '', '', true),
  ('digital_marketing_seo', 'التسويق الرقمي والإعلانات وSEO', '{}', '', '', true),
  ('writing_translation', 'الكتابة وصناعة المحتوى والترجمة', '{}', '', '', true),
  ('business_accounting_legal', 'المحاسبة والمالية والقانون والأعمال', '{}', '', '', true),
  ('sales_customer_support', 'المبيعات وخدمة العملاء والمساعد الافتراضي', '{}', '', '', true),
  ('engineering_architecture', 'الهندسة والعمارة والتصميم الداخلي', '{}', '', '', true),
  ('it_cybersecurity_devops', 'السيرفرات والشبكات والأمن السيبراني', '{}', '', '', true),
  ('ecommerce_stores', 'إدارة المتاجر الإلكترونية', '{}', '', '', true),
  ('education_training', 'التعليم والتدريب والبحث العلمي', '{}', '', '', true),
  ('game_ar_vr', 'تطوير الألعاب والنمذجة ثلاثية الأبعاد', '{}', '', '', true),
  ('other', 'أخرى / عام', '{}', '', '', true)
ON CONFLICT (slug) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  is_active = EXCLUDED.is_active;
