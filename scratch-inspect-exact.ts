import * as cheerio from "cheerio";
import fs from "fs";

const html = fs.readFileSync(
  "C:/Users/Administrator/.gemini/antigravity-ide/brain/c41454fc-270b-4272-9658-4169e097854a/scratch/chrome-mostaql-challenge.html",
  "utf8"
);

const $ = cheerio.load(html);

// Find exact Avatar element
const avatarElem = $(".avatar img, .user-avatar img, .profile-avatar img, img[src*='avatars.hsoubcdn.com']").first();
const avatarSrc = avatarElem.attr("src") || $("img[src*='avatars.hsoubcdn.com']").first().attr("src");

console.log("AVATAR SRC:", avatarSrc);
console.log("NAME:", $("h1").first().text().trim());

// Bio
let bio = "";
$("h2, h3").each((_, el) => {
  if ($(el).text().includes("نبذة")) {
    const parent = $(el).closest(".card, .carda, div.card-body, div");
    bio = parent.text().replace($(el).text(), "").trim();
  }
});
if (!bio) {
  bio = $("#about_content, .profile-about").text().trim();
}
console.log("BIO FOUND:", bio);

// Portfolio items
const portfolioItems: any[] = [];
$(".portfolio-item, .item-card, .project-card, a[href*='/portfolio/']").each((_, el) => {
  const title = $(el).find(".title, h3, h4, .card-title").text().trim() || $(el).attr("title") || $(el).text().trim();
  const href = $(el).attr("href");
  const img = $(el).find("img").attr("src");
  if (title && href && href.includes("/portfolio/")) {
    portfolioItems.push({ title, href, img });
  }
});
console.log("PORTFOLIO ITEMS:", JSON.stringify(portfolioItems, null, 2));

// Stats
const stats: Record<string, string> = {};
$("table tr, .stat-row, .profile-stat, li").each((_, el) => {
  const text = $(el).text().replace(/\s+/g, " ").trim();
  if (text.includes("معدل إكمال المشاريع") || text.includes("إعادة التوظيف") || text.includes("التسليم في الموعد") || text.includes("سرعة الرد") || text.includes("تقييم")) {
    console.log("Stat row:", text);
  }
});
