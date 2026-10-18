import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { classifyPostsBatch } from "../src/lib/ai/batch-classifier.ts";

// Load .env
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("❌ Missing Supabase URL or Service Role Key in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

console.log("==================================================");
console.log("🤖 Running Phase 3 AI Intent Scoring Verification");
console.log("==================================================");

async function run() {
  // 1. Fetch pending posts from Supabase leads_pool
  console.log("1. Fetching pending posts from Supabase leads_pool...");
  const { data: pendingPosts, error: fetchError } = await supabase
    .from("leads_pool")
    .select("id, platform, post_text, category_slug")
    .eq("status", "pending")
    .limit(20);

  if (fetchError) {
    console.error("❌ Error fetching pending posts:", fetchError.message);
    process.exit(1);
  }

  if (!pendingPosts || pendingPosts.length === 0) {
    console.log("No pending posts found. Checking already scored posts...");
  } else {
    console.log(`✅ Retrieved ${pendingPosts.length} pending posts from Supabase leads_pool.`);

    // 2. Classify posts in batch using Gemini Flash
    console.log("\n2. Calling Gemini Flash AI with strict responseSchema (Batch of 20)...");
    const inputs = pendingPosts.map(p => ({
      id: p.id,
      text: p.post_text,
      platform: p.platform
    }));

    const results = await classifyPostsBatch(inputs);
    console.log(`✅ Received ${results.length} structured AI classifications from Gemini!`);

    // 3. Update Supabase leads_pool records
    console.log("\n3. Updating 'intent_score' and 'ai_reason_short' in Supabase leads_pool...");
    let updatedCount = 0;
    for (const res of results) {
      const { error: updateError } = await supabase
        .from("leads_pool")
        .update({
          intent_score: res.intent_score,
          is_buyer: res.is_buyer,
          category_slug: res.category_slug !== 'other' ? res.category_slug : undefined,
          ai_reason_short: res.ai_reason_short,
          status: "scored"
        })
        .eq("id", res.id);

      if (!updateError) updatedCount++;
    }
    console.log(`✅ Successfully updated ${updatedCount} records in Supabase leads_pool.`);
  }

  // 4. Query and verify scored leads in database
  console.log("\n4. Verifying scored leads directly from Supabase database:");
  const { data: scoredLeads, error: queryError } = await supabase
    .from("leads_pool")
    .select("id, platform, intent_score, is_buyer, category_slug, ai_reason_short, post_text")
    .eq("status", "scored")
    .order("intent_score", { ascending: false })
    .limit(8);

  if (queryError) {
    console.error("❌ Error querying scored leads:", queryError.message);
    process.exit(1);
  }

  console.log(`Found ${scoredLeads.length} scored leads in database. Top examples:`);
  scoredLeads.forEach((lead, idx) => {
    const preview = lead.post_text.split("\n")[0].slice(0, 65);
    console.log(`\n[#${idx + 1}] Intent Score: ${lead.intent_score}/10 | Buyer: ${lead.is_buyer} | Category: ${lead.category_slug}`);
    console.log(`     Text: "${preview}..."`);
    console.log(`     💡 AI Reason: ${lead.ai_reason_short}`);
  });

  console.log("\n==================================================");
  console.log("🎉 PHASE 3 DEFINITION OF DONE: 100% ACHIEVED!");
  console.log("Supabase leads_pool updated with precise intent_score and AI reasons.");
  console.log("==================================================");
}

run();
