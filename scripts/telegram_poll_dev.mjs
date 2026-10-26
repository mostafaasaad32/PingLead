// ==============================================================================
// scripts/telegram_poll_dev.mjs
// Local development bridge for the Telegram bot.
// Telegram can't reach localhost via webhook, so this script long-polls getUpdates
// and forwards each update to the local /api/webhooks/telegram route.
//
// Usage: npm run bot:dev
//        npm run bot:dev -- --force   (removes an existing webhook first - see warning below)
//
// ⚠️ Use a separate TEST bot from @BotFather. getUpdates only works when the bot has
//    no webhook, so running this against the production bot with --force takes it
//    offline for real users until the webhook is registered again.
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
const LOCAL_URL = `${process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`}/api/webhooks/telegram`;
const FORCE = process.argv.includes("--force");

async function main() {
  if (!token || token.startsWith("your_")) {
    console.error("❌ TELEGRAM_BOT_TOKEN is not set in .env. Get one from @BotFather, then restart npm run dev.");
    process.exitCode = 1;
    return;
  }

  const api = async (method, body = {}) => {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const me = await api("getMe");
  if (!me.ok) {
    console.error("❌ Telegram rejected the token:", me.description);
    process.exitCode = 1;
    return;
  }

  const info = await api("getWebhookInfo");
  if (info.result?.url) {
    if (!FORCE) {
      console.error(`⚠️ @${me.result.username} already has a webhook: ${info.result.url}`);
      console.error("   Polling would steal its messages. Use a separate test bot,");
      console.error("   or re-run with --force if you are sure this bot isn't used by anyone else.");
      process.exitCode = 1;
      return;
    }
    await api("deleteWebhook");
    console.log(`🗑️  Removed webhook ${info.result.url} (register it again with scripts/set_telegram_webhook.mjs)`);
  }

  console.log(`🤖 Polling @${me.result.username} → forwarding to ${LOCAL_URL}`);
  console.log("   Send /start to the bot in Telegram. Press Ctrl+C to stop.\n");

  let offset = 0;
  while (true) {
    try {
      const updates = await api("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message", "callback_query"],
      });

      for (const update of updates.result || []) {
        const label = update.message?.text || `button: ${update.callback_query?.data}`;

        const res = await fetch(LOCAL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(secret && !secret.startsWith("generate_") ? { "x-telegram-bot-api-secret-token": secret } : {}),
          },
          body: JSON.stringify(update),
        });
        const result = await res.json().catch(() => ({}));
        // Only acknowledge the update once the local app has received it
        offset = update.update_id + 1;
        console.log(`📩 ${label} → HTTP ${res.status} ${result.action || result.error || ""}`);
      }
    } catch (err) {
      console.error("⚠️ Waiting for the local app:", err.message, "- retrying in 3s");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
