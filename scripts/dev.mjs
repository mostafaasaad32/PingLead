// ==============================================================================
// scripts/dev.mjs
// One command for local development:
//   1. Next.js dev server
//   2. Telegram bot bridge (scripts/telegram_poll_dev.mjs) - when a bot token is configured
//   3. Ingestion worker (scripts/worker.mjs) - ONLY with --ingest (npm run dev:ingest)
// Usage: npm run dev            -> site + bot, no scraping
//        npm run dev:ingest     -> site + bot + scraping & alerts
//
// Why ingestion is off by default: the local site uses the production database. A local
// cycle inserts new matches first and alerts them through the local test bot, so the
// production cron sees them as already handled and the real bot never sends them.
// ==============================================================================

import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
const token = (envText.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m)?.[1] || "").trim();
const hasBotToken = token && !token.startsWith("your_");

const ingest = process.argv.includes("--ingest");
// Read by src/lib/cron/trigger.ts: page-load and "scan now" triggers run only with this set
const childEnv = { ...process.env, LOCAL_INGEST: ingest ? "1" : "0" };

const children = [];

function run(name, command, args = []) {
  const cmd = args.length > 0 ? `${command} ${args.join(" ")}` : command;
  const child = spawn(cmd, { stdio: "inherit", shell: true, env: childEnv });
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
run("sidecar", "python", ["-m", "uvicorn", "main:app", "--port", "8000", "--app-dir", "scrapling_service"]);

if (hasBotToken) {
  run("bot", "node", ["scripts/telegram_poll_dev.mjs"]);
} else {
  console.log(
    "\nℹ️  Telegram bot is off: add TELEGRAM_BOT_TOKEN to .env (from @BotFather) and restart npm run dev.\n"
  );
}

if (!ingest) {
  console.log(
    "\nℹ️  Scraping is off locally, so the real bot keeps getting every alert.\n" +
      "   To scrape and send alerts from this machine: npm run dev:ingest\n"
  );
}

// Start the ingestion worker once the site answers, so its first cycle doesn't fail
const baseUrl = `http://localhost:${process.env.PORT || 3000}`;
(async () => {
  if (!ingest) return;
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
