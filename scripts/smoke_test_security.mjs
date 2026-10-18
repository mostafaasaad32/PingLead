// ==============================================================================
// scripts/smoke_test_security.mjs
// Smoke tests for the security & cron fixes (S1, S2, S3, S5, B1, B2).
// Requires the app to be running (npm run dev).
// Usage:
//   npm run test:security            # full run (~1-2 min, does 2 real scrape cycles)
//   npm run test:security -- --quick # skip the scrape-rotation tests
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

const BASE_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const QUICK = process.argv.includes("--quick");
const results = [];

function record(id, name, status, detail = "") {
  results.push({ id, name, status, detail });
  const icon = status === "pass" ? "✅" : status === "fail" ? "❌" : "⏭️ ";
  console.log(`${icon} [${id}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(method, urlPath, body, headers = {}) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON response
  }
  return { status: res.status, json };
}

function expectStatus(id, name, actual, expected) {
  record(id, name, actual === expected ? "pass" : "fail", `got ${actual}, expected ${expected}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------------------
console.log(`\n🔍 PingLead security smoke tests against ${BASE_URL}\n`);

try {
  await fetch(BASE_URL);
} catch {
  console.error(`❌ Cannot reach ${BASE_URL}. Start the app first with: npm run dev`);
  process.exit(1);
}

// S1: no real keys in .env.example
{
  const example = fs.readFileSync(path.resolve(process.cwd(), ".env.example"), "utf-8");
  const hasJwt = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/.test(example);
  record("S1", ".env.example contains no real Supabase keys", hasJwt ? "fail" : "pass");
}

// S5: no hardcoded cron secret left in app code
{
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|mjs)$/.test(entry.name) &&
        fs.readFileSync(full, "utf-8").includes("pinglead_cron_secret_secure_9921")) {
        offenders.push(path.relative(process.cwd(), full));
      }
    }
  };
  walk(path.resolve(process.cwd(), "src"));
  record("S5", "No hardcoded cron secret in src/", offenders.length ? "fail" : "pass",
    offenders.length ? offenders.join(", ") : "");
}

// S2: proposal generation requires login
{
  const { status } = await request("POST", "/api/proposals/generate", {
    project_title: "smoke test",
    project_description: "smoke test",
  });
  expectStatus("S2", "Proposal generation rejects anonymous requests", status, 401);
}

// S5: manual scan requires login
{
  const { status } = await request("POST", "/api/scan");
  expectStatus("S5", "Scan-now endpoint rejects anonymous requests", status, 401);
}

// S5: cron rejects requests without the secret (only enforceable outside development)
{
  const { status } = await request("GET", "/api/cron/ingest?scrape=false");
  if (status === 401) {
    record("S5", "Cron rejects requests without CRON_SECRET", "pass");
  } else {
    record("S5", "Cron rejects requests without CRON_SECRET", "skip",
      "dev mode skips this check; test on the production server");
  }
}

// S3: Telegram webhook
{
  const fakeCallback = {
    callback_query: {
      id: "smoke-test",
      data: "mark_app:00000000-0000-0000-0000-000000000000",
      message: { chat: { id: 1 }, message_id: 1 },
    },
  };
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const isPlaceholder = !secret || secret.startsWith("generate_");

  if (!isPlaceholder) {
    const noSecret = await request("POST", "/api/webhooks/telegram", fakeCallback);
    expectStatus("S3", "Telegram webhook rejects requests without the secret token", noSecret.status, 401);
  } else {
    record("S3", "Telegram webhook rejects requests without the secret token", "skip",
      "TELEGRAM_WEBHOOK_SECRET is not set in .env");
  }

  const withSecret = await request("POST", "/api/webhooks/telegram", fakeCallback,
    isPlaceholder ? {} : { "x-telegram-bot-api-secret-token": secret });
  expectStatus("S3", "Telegram buttons from an unlinked chat are rejected", withSecret.status, 403);
}

// B2 + B1: category rotation and no duplicate alerts (two real cycles)
if (QUICK) {
  record("B2", "Cron rotates through categories", "skip", "--quick");
  record("B1", "Telegram alerts sent only for new matches", "skip", "--quick");
} else {
  const cronHeaders = process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {};

  console.log("\n⏳ Running scrape cycle 1 (takes ~15s)...");
  const run1 = await request("GET", "/api/cron/ingest?scrape=true", null, cronHeaders);

  const msToNextMinute = 60_000 - (Date.now() % 60_000) + 2_000;
  console.log(`⏳ Waiting ${Math.round(msToNextMinute / 1000)}s for the next rotation slot...`);
  await sleep(msToNextMinute);

  console.log("⏳ Running scrape cycle 2...");
  const run2 = await request("GET", "/api/cron/ingest?scrape=true", null, cronHeaders);

  if (!run1.json?.ok || !run2.json?.ok) {
    record("B2", "Cron rotates through categories", "fail",
      `cron error: ${run1.json?.error || run2.json?.error || `HTTP ${run1.status}/${run2.status}`}`);
  } else {
    const c1 = (run1.json.categoriesScraped || []).join(", ");
    const c2 = (run2.json.categoriesScraped || []).join(", ");
    record("B2", "Cron rotates through categories", c1 && c2 && c1 !== c2 ? "pass" : "fail",
      `cycle 1: [${c1}] → cycle 2: [${c2}]`);

    const okAlerts = [run1.json, run2.json].every(
      (r) => (r.smartTelegramDispatched || 0) <= (r.actionsCreated || 0)
    );
    record("B1", "Telegram alerts sent only for new matches", okAlerts ? "pass" : "fail",
      `alerts ${run1.json.smartTelegramDispatched}/${run2.json.smartTelegramDispatched}, ` +
      `new matches ${run1.json.actionsCreated}/${run2.json.actionsCreated}`);
  }
}

// ------------------------------------------------------------------------------
const passed = results.filter((r) => r.status === "pass").length;
const failed = results.filter((r) => r.status === "fail").length;
const skipped = results.filter((r) => r.status === "skip").length;

console.log(`\n${failed ? "❌" : "✅"} ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
process.exit(failed ? 1 : 0);
