-- ==============================================================================
-- Migration: 0009_lock_telegram_chat_id.sql
-- Description:
--   Users may only link Telegram through the bot (/start <connect_token>), which runs
--   with the service role. Signed-in users can still disconnect (set NULL), but can no
--   longer write an arbitrary telegram_chat_id from the browser and redirect alerts
--   to someone else's chat.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.guard_telegram_chat_id()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NEW.telegram_chat_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' OR NEW.telegram_chat_id IS DISTINCT FROM OLD.telegram_chat_id THEN
      RAISE EXCEPTION 'telegram_chat_id can only be set by linking through the Telegram bot';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_telegram_chat_id ON public.freelancer_profiles;
CREATE TRIGGER trg_guard_telegram_chat_id
  BEFORE INSERT OR UPDATE ON public.freelancer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_telegram_chat_id();

DROP TRIGGER IF EXISTS trg_guard_telegram_chat_id ON public.profiles;
CREATE TRIGGER trg_guard_telegram_chat_id
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_telegram_chat_id();
