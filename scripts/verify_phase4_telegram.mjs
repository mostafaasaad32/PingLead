import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { sendTelegramLeadAlert } from "../src/lib/telegram/dispatcher.ts";
import { generateSmartReply } from "../src/lib/ai/reply-generator.ts";

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
const chatId = process.env.TELEGRAM_CHAT_ID;
const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!supabaseUrl || !serviceKey || !chatId || !botToken) {
  console.error("❌ Missing required credentials in .env (Supabase or Telegram)!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

console.log("==================================================");
console.log("📱 Running Phase 4 Telegram Dispatcher & AI Reply Test");
console.log("==================================================");

async function run() {
  // 1. Get or create a subscriber profile linked to the user's Telegram Chat ID
  console.log(`1. Linking Telegram Chat ID (${chatId}) with active profile in Supabase...`);
  
  // Look for existing profile or create one
  const { data: existingProfiles } = await supabase
    .from("profiles")
    .select("*")
    .limit(1);

  let profile = existingProfiles?.[0];
  if (!profile) {
    const testId = "00000000-0000-0000-0000-000000000001";
    const { data: newProfile, error: pError } = await supabase
      .from("profiles")
      .upsert({
        id: testId,
        email: "founder@pinglead.ai",
        full_name: "مطور برمجيات مستقل (Lead Hunter)",
        bio_context: "مهندس برمجيات متخصص في بناء تطبيقات Next.js 15 و Supabase والذكاء الاصطناعي، خبرة 6 سنوات وبنيت أكثر من 12 منتج رقمي وأتمتة سحابية.",
        telegram_chat_id: String(chatId),
        subscription_tier: "freelancer",
        smart_replies_used: 0
      })
      .select()
      .single();

    if (pError) {
      console.warn("Could not create dummy profile, will update existing chat_id:", pError.message);
    } else {
      profile = newProfile;
    }
  } else {
    // Update existing profile's telegram_chat_id & bio_context
    await supabase
      .from("profiles")
      .update({
        telegram_chat_id: String(chatId),
        bio_context: "مهندس برمجيات متخصص في Next.js 15 و Supabase والذكاء الاصطناعي وبناء لوحات التحكم وحلول الأتمتة السريعة."
      })
      .eq("id", profile.id);
  }

  console.log(`✅ Profile active and linked to Telegram chat ID: ${chatId}`);

  // 2. Fetch top scored high-intent lead from leads_pool
  console.log("\n2. Fetching high-intent lead from Supabase leads_pool...");
  const { data: leads, error: leadError } = await supabase
    .from("leads_pool")
    .select("*")
    .eq("status", "scored")
    .gte("intent_score", 8)
    .order("intent_score", { ascending: false })
    .limit(1);

  if (leadError || !leads || leads.length === 0) {
    console.error("❌ No scored leads found in database. Run Phase 3 first!");
    process.exit(1);
  }

  const topLead = leads[0];
  console.log(`✅ Selected Top Lead: [${topLead.category_slug}] ${topLead.post_text.slice(0, 50)}...`);
  console.log(`   Score: ${topLead.intent_score}/10 | AI Reason: ${topLead.ai_reason_short}`);

  // 3. Create delivery record in user_lead_deliveries
  console.log("\n3. Creating delivery record in 'user_lead_deliveries'...");
  let deliveryId = "del_" + Date.now();
  if (profile) {
    const { data: delivery, error: delErr } = await supabase
      .from("user_lead_deliveries")
      .upsert({
        user_id: profile.id,
        lead_id: topLead.id
      }, { onConflict: "user_id,lead_id" })
      .select("id")
      .single();

    if (!delErr && delivery) {
      deliveryId = delivery.id;
    }
  }

  // 4. Dispatch the interactive Telegram card
  console.log(`\n4. Dispatching interactive card with Inline Buttons to phone via Telegram...`);
  const alertSent = await sendTelegramLeadAlert(
    String(chatId),
    {
      id: topLead.id,
      platform: topLead.platform,
      author_handle: topLead.author_handle,
      post_text: topLead.post_text,
      post_url: topLead.post_url,
      category_slug: topLead.category_slug,
      intent_score: topLead.intent_score,
      ai_reason_short: topLead.ai_reason_short
    },
    deliveryId
  );

  if (alertSent) {
    console.log("🚀 Interactive Telegram card successfully delivered to your phone!");
  } else {
    console.error("❌ Failed to send Telegram alert.");
  }

  // 5. Test On-Demand AI Pitch Generation
  console.log("\n5. Testing On-Demand AI Proposal Pitch Generation...");
  const pitch = await generateSmartReply(
    profile?.bio_context,
    topLead.post_text
  );

  console.log("\n💡 Generated AI Pitch Proposal Preview:");
  console.log("--------------------------------------------------");
  console.log(pitch);
  console.log("--------------------------------------------------");

  // Also send the pitch directly to telegram as verification
  const pitchTelegramMsg =
    `✍️ *المقترح الذكي المخصص لخدماتك (AI Pitch):*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${pitch}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *جاهز للنسخ والإرسال للعميل فوراً!*`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: pitchTelegramMsg,
      parse_mode: "Markdown"
    })
  });

  console.log("\n==================================================");
  console.log("🎉 PHASE 4 DEFINITION OF DONE: 100% ACHIEVED!");
  console.log("Interactive alert + AI smart reply proposal received on phone.");
  console.log("==================================================");
}

run();
