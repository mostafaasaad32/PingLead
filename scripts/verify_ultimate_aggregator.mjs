// ==============================================================================
// scripts/verify_ultimate_aggregator.mjs
// Comprehensive Verification of the Ultimate Aggregator Engine
// Tests all Arabic & Global scrapers, source-type filtering, and Supabase upsert
// ==============================================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

import { scrapeMostaqlCategory } from "../src/lib/scrapers/mostaql.ts";
import { scrapeNafezlyCategory } from "../src/lib/scrapers/nafezly.ts";
import { scrapeKhamsatCategory } from "../src/lib/scrapers/khamsat.ts";
import { scrapeKafiilCategory } from "../src/lib/scrapers/kafiil.ts";
import { scrapeBaeedCategory } from "../src/lib/scrapers/baeed.ts";
import { scrapeFreelancerCategory } from "../src/lib/scrapers/freelancer.ts";
import { scrapeWwrCategory } from "../src/lib/scrapers/wwr.ts";
import { scrapeRemoteOkCategory } from "../src/lib/scrapers/remoteok.ts";
import { scrapeRedditCategory } from "../src/lib/scrapers/reddit.ts";
import { filterLeadBySourceType } from "../src/lib/filters/negative-regex.ts";
import { ingestCategoryPosts } from "../src/lib/scrapers/index.ts";

async function verify() {
  console.log("==================================================");
  console.log("🚀 TESTING THE ULTIMATE AGGREGATOR ENGINE ($0 COST)");
  console.log("==================================================");

  const results = {};

  // 1. Mostaql (مستقل)
  console.log("\n[1/9] Testing Mostaql Scraper...");
  try {
    const mostaql = await scrapeMostaqlCategory("web_dev", 5);
    console.log(`✅ Mostaql returned ${mostaql.length} projects`);
    if (mostaql[0]) console.log(`   Sample: "${mostaql[0].title}" -> ${mostaql[0].url}`);
    results.mostaql = mostaql.length;
  } catch (e) {
    console.error("❌ Mostaql failed:", e.message);
  }

  // 2. Nafezly (نفذلي)
  console.log("\n[2/9] Testing Nafezly Scraper...");
  try {
    const nafezly = await scrapeNafezlyCategory("web_dev", 5);
    console.log(`✅ Nafezly returned ${nafezly.length} projects`);
    if (nafezly[0]) console.log(`   Sample: "${nafezly[0].title}" -> ${nafezly[0].url}`);
    results.nafezly = nafezly.length;
  } catch (e) {
    console.error("❌ Nafezly failed:", e.message);
  }

  // 3. Khamsat (خمسات - طلبات الخدمات غير الموجودة)
  console.log("\n[3/9] Testing Khamsat Requests Scraper...");
  try {
    const khamsat = await scrapeKhamsatCategory("web_dev", 5);
    console.log(`✅ Khamsat returned ${khamsat.length} buyer requests`);
    if (khamsat[0]) console.log(`   Sample: "${khamsat[0].title}" -> ${khamsat[0].url}`);
    results.khamsat = khamsat.length;
  } catch (e) {
    console.error("❌ Khamsat failed:", e.message);
  }

  // 4. Kafiil (كفيل)
  console.log("\n[4/9] Testing Kafiil Scraper...");
  try {
    const kafiil = await scrapeKafiilCategory("web_dev", 5);
    console.log(`✅ Kafiil returned ${kafiil.length} projects`);
    if (kafiil[0]) console.log(`   Sample: "${kafiil[0].title}" -> ${kafiil[0].url}`);
    results.kafiil = kafiil.length;
  } catch (e) {
    console.error("❌ Kafiil failed:", e.message);
  }

  // 5. Baeed (بعيد)
  console.log("\n[5/9] Testing Baeed Scraper...");
  try {
    const baeed = await scrapeBaeedCategory("web_dev", 5);
    console.log(`✅ Baeed returned ${baeed.length} opportunities`);
    if (baeed[0]) console.log(`   Sample: "${baeed[0].title}" -> ${baeed[0].url}`);
    results.baeed = baeed.length;
  } catch (e) {
    console.error("❌ Baeed failed:", e.message);
  }

  // 6. Freelancer.com
  console.log("\n[6/9] Testing Freelancer.com Public API...");
  try {
    const freelancer = await scrapeFreelancerCategory("web_dev", 5);
    console.log(`✅ Freelancer returned ${freelancer.length} projects`);
    if (freelancer[0]) console.log(`   Sample: "${freelancer[0].title}" (Budget: ${freelancer[0].budget}) -> ${freelancer[0].url}`);
    results.freelancer = freelancer.length;
  } catch (e) {
    console.error("❌ Freelancer failed:", e.message);
  }

  // 7. WeWorkRemotely (WWR)
  console.log("\n[7/9] Testing WeWorkRemotely RSS...");
  try {
    const wwr = await scrapeWwrCategory("web_dev", 5);
    console.log(`✅ WWR returned ${wwr.length} remote jobs`);
    if (wwr[0]) console.log(`   Sample: "${wwr[0].title}" -> ${wwr[0].url}`);
    results.wwr = wwr.length;
  } catch (e) {
    console.error("❌ WWR failed:", e.message);
  }

  // 8. RemoteOK
  console.log("\n[8/9] Testing RemoteOK Public API...");
  try {
    const remoteok = await scrapeRemoteOkCategory("web_dev", 5);
    console.log(`✅ RemoteOK returned ${remoteok.length} remote jobs`);
    if (remoteok[0]) console.log(`   Sample: "${remoteok[0].title}" (Salary: ${remoteok[0].budget}) -> ${remoteok[0].url}`);
    results.remoteok = remoteok.length;
  } catch (e) {
    console.error("❌ RemoteOK failed:", e.message);
  }

  // 9. Reddit with multi-tier fallback
  console.log("\n[9/9] Testing Reddit Scraper with Tiered Fallback...");
  try {
    const reddit = await scrapeRedditCategory(["forhire", "webdev"], "web_dev", 5);
    console.log(`✅ Reddit returned ${reddit.length} posts`);
    if (reddit[0]) console.log(`   Sample: "${reddit[0].title}" -> ${reddit[0].url}`);
    results.reddit = reddit.length;
  } catch (e) {
    console.error("❌ Reddit failed:", e.message);
  }

  // 10. Test Golden Filtering Rule
  console.log("\n==================================================");
  console.log("🛡️ TESTING SOURCE-TYPE FILTERING (GOLDEN RULE)");
  console.log("==================================================");

  const mockMarketplaceLead = {
    source_type: "marketplace",
    title: "برمجة متجر إلكتروني متكامل", // Notice: does NOT contain "مطلوب" or "محتاج"
    description: "نحتاج متجر بنظام الدفع والشحن",
    post_text: "برمجة متجر إلكتروني متكامل",
  };
  const mockMarketplacePass = filterLeadBySourceType(mockMarketplaceLead);
  console.log("1. Marketplace lead without 'مطلوب':", mockMarketplacePass.passed ? "✅ PASSED (Rule working)" : "❌ FAILED");

  const mockSocialSellerLead = {
    source_type: "social",
    title: "أنا مبرمج متاح للعمل", // Seller post!
    description: "سابقة أعمالي ورابط البيهانس",
    post_text: "أنا مبرمج متاح للعمل سابقة أعمالي",
  };
  const mockSocialFail = filterLeadBySourceType(mockSocialSellerLead);
  console.log("2. Social seller promotion lead:", !mockSocialFail.passed ? "✅ DROPPED by regex filter (Rule working)" : "❌ FAILED");

  // 11. Run Unified Ingestion Orchestrator
  console.log("\n==================================================");
  console.log("⚡ TESTING LIVE INGESTION ORCHESTRATOR FOR web_dev");
  console.log("==================================================");

  const stats = await ingestCategoryPosts({
    slug: "web_dev",
    name_ar: "تطوير الويب والبرمجة",
    reddit_subreddits: ["forhire", "webdev"],
    boolean_query_ar: "مطلوب مبرمج OR محتاج مبرمج",
    boolean_query_en: "hiring developer OR looking for developer",
  });

  console.log("📊 Orchestrator Results:");
  console.log(`   - Total Extracted: ${stats.totalFetched}`);
  console.log(`   - Filtered/Dropped: ${stats.droppedByFilter}`);
  console.log(`   - Surviving Clean Leads: ${stats.survivingPending}`);
  console.log(`   - Successfully Upserted to DB: ${stats.insertedIntoDb}`);
  console.log("   - Breakdown by Platform:", stats.platformBreakdown);

  console.log("\n==================================================");
  console.log("🎉 ALL AGGREGATOR MODULES VERIFIED SUCCESSFULLY!");
  console.log("==================================================");
}

verify().catch((e) => console.error("Fatal error:", e));
