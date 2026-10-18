// ==============================================================================
// src/lib/telegram/bot-info.ts
// Resolves the bot's @username from TELEGRAM_BOT_TOKEN (getMe), so links always
// point at whichever bot this environment is running - test bot locally, real bot in production.
// ==============================================================================

const FALLBACK_BOT_USERNAME = 'Ping_Lead22_bot';

let cachedUsername: string | null = null;

export async function getBotUsername(): Promise<string> {
  if (cachedUsername) return cachedUsername;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.startsWith('your_')) return FALLBACK_BOT_USERNAME;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await res.json();
    if (data.ok && data.result?.username) {
      cachedUsername = data.result.username as string;
      return cachedUsername;
    }
  } catch {
    // network error - fall through to fallback
  }
  return FALLBACK_BOT_USERNAME;
}
