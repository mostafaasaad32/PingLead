// scripts/refresh_lead_dates.mjs
// Refreshes and updates authentic source dates for all categories

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

import { ingestCategoryPosts } from "../src/lib/scrapers/index.ts";
import { supabaseAdmin } from "../src/lib/supabase/admin.ts";

async function refreshDates() {
  console.log("==================================================");
  console.log("🕒 REFRESHING AUTHENTIC DATES FROM SOURCE PLATFORMS");
  console.log("==================================================");

  const { data: categories } = await supabaseAdmin
    .from("categories")
    .select("*")
    .eq("is_active", true);

  if (!categories || categories.length === 0) {
    console.log("No categories found.");
    return;
  }

  for (const cat of categories) {
    console.log(`\nSiphoning fresh leads with authentic dates for [${cat.slug}]...`);
    const stats = await ingestCategoryPosts(cat);
    console.log(`✅ [${cat.slug}]: Fetched ${stats.totalFetched}, Surviving ${stats.survivingPending}, Inserted/Updated ${stats.insertedIntoDb}`);
  }

  // Display top 8 leads with their authentic dates
  const { data: latest } = await supabaseAdmin
    .from("leads_pool")
    .select("platform, post_url, post_text, published_at")
    .order("published_at", { ascending: false })
    .limit(8);

  console.log("\n--- Top 8 Most Recently Published Leads from Sources ---");
  latest?.forEach((l, i) => {
    const domain = l.post_url ? new URL(l.post_url).hostname : l.platform;
    console.log(`${i + 1}. [${l.published_at}] (${domain}) -> ${l.post_text.slice(0, 70).replace(/\n/g, " ")}...`);
  });

  console.log("\n🎉 Authentic publication dates refresh complete!");
}

refreshDates().catch(e => console.error("Error:", e));
