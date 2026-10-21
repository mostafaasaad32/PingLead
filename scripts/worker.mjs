// ==============================================================================
// scripts/worker.mjs
// Automated 24/7 Background Ingestion Worker for PingLead (Vollna Architecture)
// Continuously scrapes the 9 freelance platforms, matches active user filters,
// and dispatches real-time Telegram alerts ($0 API cost).
// ==============================================================================

import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error("❌ CRON_SECRET is not set in .env — the worker cannot authenticate with /api/cron/ingest.");
  process.exit(1);
}
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const INTERVAL_SECONDS = 30; // Hyper real-time automated scan every 30 seconds

console.log("==================================================");
console.log("🚀 PingLead 24/7 Autonomous Background Worker Started");
console.log(`📡 Ingestion Target: ${BASE_URL}/api/cron/ingest`);
console.log(`⏱️ Real-time Frequency: Every ${INTERVAL_SECONDS} seconds`);
console.log("💼 Platforms Monitored (9): Mostaql, Nafezly, Khamsat, Kafiil, Baeed, Freelancer, WWR, RemoteOK, PPH");
console.log("==================================================\n");

let cycleCount = 0;
let isRunningCycle = false;

async function runCronCycle() {
  if (isRunningCycle) {
    console.log("⏳ Previous cycle still running, skipping overlap...");
    return;
  }

  isRunningCycle = true;
  cycleCount++;
  const timestamp = new Date().toLocaleTimeString("ar-EG", { hour12: true });
  console.log(`[${timestamp}] 🔄 Radar Ingestion Cycle #${cycleCount} initiating across 9 platforms...`);

  try {
    const url = `${BASE_URL}/api/cron/ingest?scrape=true`;
    const res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json", "Authorization": `Bearer ${CRON_SECRET}` }
    });

    if (!res.ok) {
      console.error(`[!] Cron endpoint returned HTTP ${res.status}:`, await res.text());
      return;
    }

    const data = await res.json();
    console.log(`✅ [Cycle #${cycleCount} Done in ${data.duration_ms}ms]:`);
    console.log(`   • Total Projects Scraped: ${data.totalProjectsIngested || 0}`);
    console.log(`   • Active User Filters Evaluated: ${data.activeFiltersCount || 0}`);
    console.log(`   • Smart Matches Triggered: ${data.matchesFound || 0}`);
    console.log(`   • Interactive Telegram Alerts Dispatched: ${data.smartTelegramDispatched || 0}`);
  } catch (err) {
    console.error(`[!] Ingestion error:`, err.message);
  } finally {
    isRunningCycle = false;
  }
}

// Initial cycle
runCronCycle();

// 60-second recurring loop
setInterval(runCronCycle, INTERVAL_SECONDS * 1000);
