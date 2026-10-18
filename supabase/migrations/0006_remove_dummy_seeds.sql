-- ==============================================================================
-- Migration: 0006_remove_dummy_seeds.sql
-- Description: Remove default filter injection from handle_new_freelancer_user
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_freelancer_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.freelancer_profiles (
    user_id,
    full_name,
    ai_credits,
    country,
    timezone,
    time_format
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    25,
    'Egypt',
    'Africa/Cairo',
    '12h'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    ai_credits = COALESCE(public.freelancer_profiles.ai_credits, 25),
    country = COALESCE(public.freelancer_profiles.country, 'Egypt'),
    timezone = COALESCE(public.freelancer_profiles.timezone, 'Africa/Cairo'),
    time_format = COALESCE(public.freelancer_profiles.time_format, '12h');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
