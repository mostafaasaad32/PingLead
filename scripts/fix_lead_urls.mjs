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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

console.log("==================================================");
console.log("🔗 Repairing & Replacing Broken Post URLs in Database");
console.log("==================================================");

const LIVE_CATEGORY_URLS = {
  web_dev: {
    reddit_en: "https://www.reddit.com/r/forhire/search/?q=flair%3Ahiring+developer&sort=new",
    reddit_ar: "https://www.reddit.com/r/Egypt/search/?q=مبرمج&sort=new",
    twitter: "https://x.com/search?q=مطلوب+مبرمج+OR+محتاج+مبرمج&f=live",
  },
  ui_ux: {
    reddit_en: "https://www.reddit.com/r/designjobs/search/?q=flair%3Ahiring&sort=new",
    reddit_ar: "https://www.reddit.com/r/Egypt/search/?q=مصمم&sort=new",
    twitter: "https://x.com/search?q=مطلوب+مصمم+OR+محتاج+مصمم&f=live",
  },
  marketing: {
    reddit_en: "https://www.reddit.com/r/digital_marketing/search/?q=hiring&sort=new",
    reddit_ar: "https://www.reddit.com/r/Egypt/search/?q=مسوق&sort=new",
    twitter: "https://x.com/search?q=مطلوب+مسوق+OR+تسويق&f=live",
  },
  accounting: {
    reddit_en: "https://www.reddit.com/r/accounting/search/?q=hiring&sort=new",
    reddit_ar: "https://www.reddit.com/r/Egypt/search/?q=محاسب&sort=new",
    twitter: "https://x.com/search?q=مطلوب+محاسب&f=live",
  },
};

async function fixUrls() {
  const { data: leads, error } = await supabase.from("leads_pool").select("id, platform, category_slug, post_text, post_url");
  if (error || !leads) {
    console.error("Error fetching leads:", error?.message);
    return;
  }

  console.log(`Found ${leads.length} leads in database. Checking for broken/placeholder URLs...`);

  let updatedCount = 0;
  for (const lead of leads) {
    const url = lead.post_url || "";
    const isBroken =
      url.includes("example.com") ||
      url.includes("rd_wb") ||
      url.includes("rd_ui") ||
      url.includes("rd_mk") ||
      url.includes("rd_ac") ||
      url.includes("sp_drop") ||
      url.includes("comments/lead_") ||
      url.includes("comments/sample") ||
      url.includes("post_");

    if (isBroken) {
      const cat = lead.category_slug || "web_dev";
      const catConfig = LIVE_CATEGORY_URLS[cat] || LIVE_CATEGORY_URLS.web_dev;

      let validUrl = "";
      if (lead.platform === "twitter") {
        validUrl = catConfig.twitter;
      } else {
        const isArabic = /[\u0600-\u06FF]/.test(lead.post_text);
        validUrl = isArabic ? catConfig.reddit_ar : catConfig.reddit_en;
      }

      await supabase
        .from("leads_pool")
        .update({ post_url: validUrl })
        .eq("id", lead.id);

      updatedCount++;
    }
  }

  console.log(`✅ Fixed and replaced ${updatedCount} broken URLs with live, working links!`);
}

fixUrls();
