// ==============================================================================
// scripts/dev.mjs
// One command for local development:
//   1. Next.js dev server
//   2. Ingestion worker (scripts/worker.mjs) - scrapes & sends alerts every 60s
//   3. Telegram bot bridge (scripts/telegram_poll_dev.mjs) - when a bot token is configured
// Usage: npm run dev
// ==============================================================================

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
const token = (envText.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m)?.[1] || "").trim();
const hasBotToken = token && !token.startsWith("your_");

const children = [];

function run(name, command, args) {
  const child = spawn(command, args, { stdio: "inherit", shell: true });
  children.push(child);
  child.on("exit", (code) => {
    if (name === "web") shutdown(code ?? 0);
    else if (code) console.log(`\n[${name}] stopped (exit ${code}). The site keeps running.\n`);
  });
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    if (!c.killed) c.kill();
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("web", "npx", ["next", "dev"]);

if (hasBotToken) {
  run("bot", "node", ["scripts/telegram_poll_dev.mjs"]);
} else {
  console.log(
    "\nℹ️  Telegram bot is off: add TELEGRAM_BOT_TOKEN to .env (from @BotFather) and restart npm run dev.\n"
  );
}

// Start the ingestion worker once the site answers, so its first cycle doesn't fail
const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
(async () => {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await fetch(baseUrl);
      run("worker", "node", ["scripts/worker.mjs"]);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.log(`\n[worker] ${baseUrl} did not come up; run npm run worker manually.\n`);
})();
