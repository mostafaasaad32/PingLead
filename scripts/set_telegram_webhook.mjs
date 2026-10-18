// ==============================================================================
// scripts/set_telegram_webhook.mjs
// Registers the Telegram bot webhook with a secret_token so /api/webhooks/telegram
// can reject requests that don't come from Telegram.
// Usage: node scripts/set_telegram_webhook.mjs https://your-domain.com
// ==============================================================================

import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1 && !process.env[trimmed.slice(0, idx).trim()]) {
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL;

if (!token || !secret || !baseUrl) {
  console.error("Missing TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, or the site URL argument.");
  process.exit(1);
}

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    url: `${baseUrl.replace(/\/$/, "")}/api/webhooks/telegram`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
  }),
});

console.log(await res.json());
