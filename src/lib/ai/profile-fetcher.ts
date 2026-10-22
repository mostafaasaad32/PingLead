// ==============================================================================
// src/lib/ai/profile-fetcher.ts
// Platform-Specific Freelancer Profile Scraper Engine
// Dedicated extraction for Upwork, Mostaql (مستقل), Nafezly (نفذلي), Khamsat (خمسات)
// ==============================================================================

import * as cheerio from "cheerio";
import dns from "node:dns";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import {
  ExtractedProfileData,
  ExtractedPortfolioItem,
  extractAvatarFromText,
  inferProjectCategory,
  extractUpworkDeepStats,
  extractProfileFromRawText,
} from "./profile-importer";

const execFileAsync = promisify(execFile);

const BROWSER_EXECUTABLE_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

export function isWafChallenge(html: string): boolean {
  if (!html || html.length < 2500) {
    if (
      html.includes("awsWafCookieDomainList") ||
      html.includes("gokuProps") ||
      html.includes("JavaScript is disabled") ||
      html.includes("403 Forbidden") ||
      html.includes("cf-chl-")
    ) {
      return true;
    }
  }
  return false;
}

export async function dumpDomWithBrowser(url: string): Promise<string | null> {
  let browserPath = "";
  for (const p of BROWSER_EXECUTABLE_PATHS) {
    try {
      if (fs.existsSync(p)) {
        browserPath = p;
        break;
      }
    } catch (_) {}
  }

  if (!browserPath) return null;

  try {
    const { stdout } = await execFileAsync(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-sandbox",
        "--disable-crash-reporter",
        "--disable-breakpad",
        "--disable-features=Translate,OptimizationHints,MediaRouter",
        "--disable-component-update",
        "--disable-domain-reliability",
        "--disable-sync",
        "--no-first-run",
        "--mute-audio",
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "--virtual-time-budget=3500",
        "--dump-dom",
        url,
      ],
      {
        timeout: 15000,
        maxBuffer: 15 * 1024 * 1024,
      }
    );

    if (stdout && stdout.length > 2500 && !isWafChallenge(stdout)) {
      return stdout;
    }
  } catch (err: any) {
    if (err.stdout && err.stdout.length > 2500 && !isWafChallenge(err.stdout)) {
      return err.stdout;
    }
    console.warn(`[Browser Dump] Error executing ${browserPath}:`, err.message);
  }
  return null;
}

export async function fetchHtmlWithBrowserFallback(
  url: string,
  timeoutMs: number = 10000
): Promise<string> {
  let html = "";

  // 1. Fast direct fetch with browser headers
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (res.ok && res.status !== 202) {
      const text = await res.text();
      if (!isWafChallenge(text)) {
        html = text;
      }
    }
  } catch (err) {
    console.warn(`[Profile Fetcher] Direct fetch failed for ${url}:`, err);
  }

  // 2. If WAF challenge or direct fetch blocked, use headless Chrome / Edge
  if (!html) {
    const dumped = await dumpDomWithBrowser(url);
    if (dumped) {
      html = dumped;
    }
  }

  // 3. Fallback to Jina Reader if still empty
  if (!html) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: "text/plain" },
        signal: AbortSignal.timeout(10000),
      });
      if (jinaRes.ok) {
        const text = await jinaRes.text();
        if (text.length > 500 && !text.includes("403 Forbidden")) {
          html = text;
        }
      }
    } catch (_) {}
  }

  return html;
}

// Force IPv4 first in Node.js to prevent connection timeouts on Windows
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

export const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

export type PlatformType =
  | "upwork"
  | "mostaql"
  | "nafezly"
  | "khamsat"
  | "freelancer"
  | "github"
  | "pinglead"
  | "custom";

export function detectPlatformFromUrl(
  url?: string | null,
  isCurrentProfile?: boolean,
  isRawText?: boolean
): PlatformType {
  if (isCurrentProfile) return "pinglead";
  if (!url || isRawText) return "custom";
  const lower = url.toLowerCase();
  if (lower.includes("upwork.com")) return "upwork";
  if (lower.includes("mostaql.com")) return "mostaql";
  if (lower.includes("khamsat.com")) return "khamsat";
  if (lower.includes("nafezly.com")) return "nafezly";
  if (lower.includes("freelancer.com")) return "freelancer";
  if (lower.includes("github.com")) return "github";
  return "custom";
}

/**
 * 1. MOSTAQL (مستقل) SCRAPER
 * Fetches main profile (mostaql.com/u/username) + portfolio (mostaql.com/u/username/portfolio)
 * Extracts:
 * - Name, headline, bio, skills
 * - Core statistics: (تقييم عام، معدل إكمال المشاريع، معدل إعادة التوظيف، التسليم في الموعد، سرعة الرد، المشاريع المكتملة، الأوسمة)
 * - Portfolio items: actual published works and titles
 */
export async function scrapeMostaqlProfile(
  profileUrl: string
): Promise<ExtractedProfileData> {
  const usernameMatch = profileUrl.match(/mostaql\.com\/u\/([^/?#]+)/i);
  const username = usernameMatch ? usernameMatch[1] : "";
  if (!username) {
    throw new Error("لم يتم العثور على اسم المستخدم في رابط مستقل المقدم.");
  }

  const mainUrl = `https://mostaql.com/u/${username}`;
  const portfolioUrl = `https://mostaql.com/u/${username}/portfolio`;

  // 1. Fetch main profile page first (fast and contains modern profile cards + portfolio)
  const mainHtml = await fetchHtmlWithBrowserFallback(mainUrl, 14000);
  if (!mainHtml || mainHtml.length < 300) {
    throw new Error("تعذر جلب بروفايل مستقل. يرجى التأكد من صحة الرابط أو لصق النص يدوياً.");
  }

  const $ = cheerio.load(mainHtml);

  // 2. Only fetch portfolio page if main page has no portfolio links
  let portfolioHtml = "";
  if ($('a[href*="/portfolio/"]').length === 0) {
    try {
      portfolioHtml = await fetchHtmlWithBrowserFallback(portfolioUrl, 10000);
    } catch {}
  }
  const $port = portfolioHtml ? cheerio.load(portfolioHtml) : $;

  // 1. Full Name
  let fullName = $("h1").first().text().replace(/\s+/g, " ").trim();
  if (!fullName || fullName.length > 50 || fullName.includes("JavaScript")) {
    fullName =
      $(".profile-card__name, .profile-name, .user-name").first().text().trim() ||
      username;
  }

  // 2. Headline / Speciality
  let headline = $(
    ".profile-title a, .profile-title, .user-speciality, .profile-card__job, .speciality, h2.speciality, h2"
  )
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();
  if (!headline || headline === "نبذة عني" || headline === "معرض الأعمال") {
    headline = "مطور ومستقل محترف على مستقل";
  }

  // 3. Bio / Overview
  let bio = "";
  $("h2, h3").each((_, el) => {
    if ($(el).text().includes("نبذة")) {
      const parent = $(el).closest(".card, .carda, div.card-body, div");
      const cloned = parent.clone();
      cloned.find("h2, h3, .card__header").remove();
      const txt = cloned.text().replace(/\s+/g, " ").trim();
      if (txt.length > bio.length) bio = txt;
    }
  });
  if (!bio) {
    bio = $("#about_content, .profile-about, #profile-about").text().replace(/\s+/g, " ").trim();
  }

  // 4. Skills
  const skills: string[] = [];
  $(
    "a[href*='/skills/'], .tag, .skill, .profile-skills a, #user_skills a.tag, #user_skills bdi, ul.skills li, .skills-list a, .badge--light"
  ).each((_, el) => {
    const s = $(el).text().replace(/\s+/g, " ").trim();
    if (s && s !== "مهاراتي" && !skills.includes(s) && s.length < 40 && !s.includes("إضافة") && !s.includes("تعديل")) {
      skills.push(s);
    }
  });

  // 5. Avatar (Exact selector for Hsoub / Mostaql avatars)
  let avatarUrl: string | undefined = undefined;
  $("img").each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";
    if (src.includes("avatars.hsoubcdn.com") || src.includes("gravatar.com") || src.includes("/users/")) {
      avatarUrl = src.startsWith("//") ? `https:${src}` : src;
      return false;
    }
  });

  if (!avatarUrl) {
    const avatarImgSrc = $(
      "img.profile-avatar, img.uavatar, .profile-card__avatar img, .user-avatar img, .avatar img, img.avatar"
    )
      .first()
      .attr("src");

    if (avatarImgSrc && !avatarImgSrc.includes("logo") && !avatarImgSrc.includes(".svg")) {
      avatarUrl = avatarImgSrc.startsWith("//") ? `https:${avatarImgSrc}` : avatarImgSrc;
    }
  }

  // 6. Clean Text Parsing for Stats & Badges (Free of raw HTML artifacts)
  const cleanBodyText = $("body").text().replace(/\s+/g, " ");

  let overallRating = "5.0";
  const ratingMatch =
    cleanBodyText.match(/التقييم(?:\s*العام)?\s*:?\s*([0-9.]+)\s*(?:من\s*5|\/5)?/i) ||
    cleanBodyText.match(/([0-9.]+)\s*(?:من\s*5|\/5)\s*stars/i) ||
    $(".stars-active, .rating-score, .profile-rating").first().text().match(/([0-9.]+)/);
  if (ratingMatch) overallRating = ratingMatch[1];

  let completionRate = "100%";
  const completionMatch = cleanBodyText.match(/معدل\s*إكمال\s*المشاريع\s*:?\s*(\d+)%/i);
  if (completionMatch) completionRate = `${completionMatch[1]}%`;

  let rehireRate = "0%";
  const rehireMatch = cleanBodyText.match(/معدل\s*إعادة\s*التوظيف\s*:?\s*(\d+)%/i);
  if (rehireMatch) rehireRate = `${rehireMatch[1]}%`;

  let onTimeDelivery = "100%";
  const onTimeMatch = cleanBodyText.match(/التسليم\s*في\s*الموعد\s*:?\s*(\d+)%/i);
  if (onTimeMatch) onTimeDelivery = `${onTimeMatch[1]}%`;

  let responseSpeed = "خلال ساعات";
  const speedMatch =
    cleanBodyText.match(/متوسط\s*سرعة\s*الرد\s*:?\s*([^،.\n]{3,35})/i) ||
    cleanBodyText.match(/سرعة\s*الرد\s*:?\s*([^،.\n]{3,35})/i);
  if (speedMatch) {
    const cleanSpeed = speedMatch[1].replace(/<[^>]+>/g, "").replace(/&[a-z]+;/g, "").trim();
    if (cleanSpeed.length > 0 && cleanSpeed.length <= 30) {
      responseSpeed = cleanSpeed;
    }
  }

  let completedProjects: number = 0;
  const completedMatch =
    cleanBodyText.match(/المشاريع\s*المكتملة\s*:?\s*(\d+)/i) ||
    cleanBodyText.match(/(\d+)\s*مشروع\s*مكتمل/i);
  if (completedMatch) completedProjects = parseInt(completedMatch[1], 10);

  const badges: string[] = [];
  $("img[src*='badge'], .badge, .profile-badge, [title]").each((_, el) => {
    const src = $(el).attr("src") || "";
    const title = $(el).attr("title") || $(el).attr("data-original-title") || "";
    if (src.includes("badge-") && src.includes("year-")) {
      const match = src.match(/year-(\d+)/);
      if (match) badges.push(`عضو منذ ${match[1]} سنوات`);
    }
    if (title.includes("هوية موثقة") && !badges.includes("هوية موثقة")) badges.push("هوية موثقة");
    if ((title.includes("هاتف") || title.includes("جوال")) && !badges.includes("هاتف مؤكد")) badges.push("هاتف مؤكد");
    if (title.includes("بريد") && !badges.includes("بريد إلكتروني مفعّل")) badges.push("بريد إلكتروني مفعّل");
    if (title.includes("ملتزم") && !badges.includes("مستقل ملتزم")) badges.push("مستقل ملتزم");
  });

  const memberSinceMatch = cleanBodyText.match(/عضو\s*منذ\s*(\d+)\s*(?:سنوات?|أعوام?|شهر)/i);
  if (memberSinceMatch && !badges.some((b) => b.includes("عضو منذ"))) {
    badges.push(`عضو منذ ${memberSinceMatch[1]} سنوات`);
  }
  if ((cleanBodyText.includes("هوية موثقة") || $(".badge-verified, i.fa-check-circle").length > 0) && !badges.includes("هوية موثقة")) {
    badges.push("هوية موثقة");
  }
  if (cleanBodyText.includes("مستقل ملتزم") && !badges.includes("مستقل ملتزم")) badges.push("مستقل ملتزم");
  if (badges.length === 0) badges.push("مستقل مسجل");

  // 7. Portfolio Items (with high-res thumbnail extraction)
  const portfolioItems: ExtractedPortfolioItem[] = [];
  $port('a[href*="/portfolio/"], .portfolio-card, .project-card, .item-card, .card--portfolio').each((_, el) => {
    const href = $port(el).attr("href") || $port(el).find("a").attr("href") || "";
    const title =
      $port(el).find("h3, h4, .title, .card__title, .portfolio-title").text().replace(/\s+/g, " ").trim() ||
      $port(el).attr("title") ||
      $port(el).text().trim();
    const img =
      $port(el).find("img").attr("src") ||
      $port(el).find("img").attr("data-src") ||
      undefined;

    if (href.match(/\/portfolio\/\d+/i) && title && title.length > 3) {
      const cleanTitle = title.split("\n")[0].trim();
      if (!portfolioItems.some((p) => p.title === cleanTitle) && cleanTitle.length < 150) {
        const fullHref = href.startsWith("http") ? href : `https://mostaql.com${href}`;
        portfolioItems.push({
          title: cleanTitle,
          description: `مشروع تطبيقي منشور في معرض أعمال مستقل: ${cleanTitle}`,
          project_url: fullHref,
          imageUrl: img && !img.includes("logo") && !img.includes(".svg") ? (img.startsWith("//") ? `https:${img}` : img) : undefined,
          skills: skills.slice(0, 5),
          category: inferProjectCategory(cleanTitle, cleanTitle, skills),
        });
      }
    }
  });

  let portfolioCount = portfolioItems.length;
  const countInText = cleanBodyText.match(/معرض\s*الأعمال\s*(?:\((\d+)\)|:\s*(\d+)|(\d+)\s*عمل)/i);
  if (countInText) {
    const parsedCount = parseInt(countInText[1] || countInText[2] || countInText[3], 10);
    if (!isNaN(parsedCount) && parsedCount > portfolioCount) {
      portfolioCount = parsedCount;
    }
  }

  return {
    fullName,
    headline,
    bio: bio || `مستقل متخصص في ${skills.slice(0, 5).join("، ")}.`,
    skills,
    portfolioItems,
    portfolioCount,
    avatarUrl,
    platformType: "mostaql",
    sourceUrl: mainUrl,
    stats: {
      completionRate,
      rehireRate,
      onTimeDelivery,
      responseSpeed,
      completedProjects,
      portfolioCount,
      overallRating,
      badges,
    },
  };
}

/**
 * 2. NAFEZLY (نفذلي) SCRAPER
 * Fetches nafezly.com/u/username
 * Extracts: headline, bio, skills, badges, project count, rating, portfolio
 */
export async function scrapeNafezlyProfile(
  profileUrl: string
): Promise<ExtractedProfileData> {
  const usernameMatch = profileUrl.match(/nafezly\.com\/u\/([^/?#]+)/i);
  const username = usernameMatch ? usernameMatch[1] : "";
  const targetUrl = `https://nafezly.com/u/${username}`;

  const html = await fetchHtmlWithBrowserFallback(targetUrl, 12000);

  if (!html || html.length < 200) {
    throw new Error("تعذر جلب بروفايل نفذلي. يرجى التأكد من صحة الرابط.");
  }

  const $ = cheerio.load(html);
  const fullName =
    $("h1").first().text().replace(/\s+/g, " ").trim() ||
    $(".user-name, .profile-name").first().text().trim() ||
    username;

  const headline =
    $(".profile-title, .user-job, .speciality, h2").first().text().replace(/\s+/g, " ").trim() ||
    "مستقل على منصة نفذلي";

  let bio = $(".user-bio, .about-me, #about, .profile-bio, p").first().text().replace(/\s+/g, " ").trim();
  if (!bio) {
    $("h2, h3, h4").each((_, el) => {
      if ($(el).text().includes("نبذة") || $(el).text().includes("عن المستقل")) {
        const text = $(el).next().text().trim();
        if (text) bio = text;
      }
    });
  }

  const skills: string[] = [];
  $(".tag, .skill, .badge-skill, a[href*='/freelancers?skill='], .skills-list span").each((_, el) => {
    const s = $(el).text().trim();
    if (s && !skills.includes(s) && s.length < 50) skills.push(s);
  });

  let avatarUrl: string | undefined = undefined;
  const avatarImg = $(
    "img.user-avatar, img.avatar, .profile-avatar img, img[src*='nafezly.com/uploads'], img[src*='nafezly.com/avatars']"
  )
    .first()
    .attr("src");
  if (avatarImg) {
    avatarUrl = avatarImg.startsWith("//") ? `https:${avatarImg}` : avatarImg;
  } else {
    avatarUrl = extractAvatarFromText(html);
  }

  const textBody = html.replace(/\s+/g, " ");

  // Stats
  let overallRating = "5.0";
  const rMatch = textBody.match(/([0-9.]+)\s*(?:من\s*5|\/5|\(\d+\s*تقييم\))/);
  if (rMatch) overallRating = rMatch[1];

  let completedProjects = 0;
  const cpMatch = textBody.match(/(\d+)\s*مشروع\s*(?:منجز|مكتمل)/i) || textBody.match(/المشاريع\s*المنجزة\s*:?\s*(\d+)/i);
  if (cpMatch) completedProjects = parseInt(cpMatch[1], 10);

  const badges: string[] = [];
  if (textBody.includes("هوية موثقة") || textBody.includes("حساب موثق")) badges.push("هوية موثقة");
  if (textBody.includes("مستقل متميز")) badges.push("مستقل متميز");
  if (textBody.includes("هاتف موثق")) badges.push("هاتف موثق");
  if (badges.length === 0) badges.push("مستقل مسجل");

  // Portfolio items
  const portfolioItems: ExtractedPortfolioItem[] = [];
  $(".portfolio-item, .project-card, .portfolio-card, a[href*='/portfolio/']").each((_, el) => {
    const pTitle = $(el).find("h3, h4, .title").first().text().trim() || $(el).text().trim();
    const pHref = $(el).attr("href") || $(el).find("a").attr("href");
    if (pTitle && pTitle.length > 3 && pTitle.length < 100 && !portfolioItems.some(i => i.title === pTitle)) {
      portfolioItems.push({
        title: pTitle,
        description: pTitle,
        project_url: pHref ? (pHref.startsWith("/") ? `https://nafezly.com${pHref}` : pHref) : null,
        skills: skills.slice(0, 4),
        category: inferProjectCategory(pTitle, pTitle, skills),
      });
    }
  });

  return {
    fullName,
    headline,
    bio: bio || `مستقل متخصص في ${skills.slice(0, 4).join("، ")}.`,
    skills,
    portfolioItems,
    portfolioCount: portfolioItems.length,
    avatarUrl,
    platformType: "nafezly",
    sourceUrl: targetUrl,
    stats: {
      overallRating,
      completedProjects,
      portfolioCount: portfolioItems.length,
      completionRate: "100%",
      rehireRate: "20%",
      onTimeDelivery: "100%",
      responseSpeed: "خلال ساعات",
      badges,
    },
  };
}

/**
 * 3. KHAMSAT (خمسات) SCRAPER
 * Fetches khamsat.com/user/username
 * Extracts:
 * - Bio & Seller level (بائع جديد / نشيط / مميز / موثوق)
 * - Overall rating, clients count, response speed
 * - Published services (Gigs): titles, prices, ratings
 */
export async function scrapeKhamsatProfile(
  profileUrl: string
): Promise<ExtractedProfileData> {
  const usernameMatch = profileUrl.match(/khamsat\.com\/user\/([^/?#]+)/i);
  const username = usernameMatch ? usernameMatch[1] : "";
  const targetUrl = `https://khamsat.com/user/${username}`;

  const html = await fetchHtmlWithBrowserFallback(targetUrl, 12000);

  if (!html || html.length < 200) {
    throw new Error("تعذر جلب بروفايل خمسات. يرجى التأكد من صحة الرابط.");
  }

  const $ = cheerio.load(html);
  const fullName =
    $(".user-details h1, .user-name, h1").first().text().replace(/\s+/g, " ").trim() ||
    username;

  const bio =
    $(".user-bio, .profile-description, #user-brief, .carda__content").first().text().replace(/\s+/g, " ").trim();

  let avatarUrl: string | undefined = undefined;
  const avatarImg = $(
    "img.avatar, img.user-avatar, img[src*='avatars.hsoubcdn.com'], .avatar img, .user-avatar img"
  )
    .first()
    .attr("src");
  if (avatarImg) {
    avatarUrl = avatarImg.startsWith("//") ? `https:${avatarImg}` : avatarImg;
  } else {
    avatarUrl = extractAvatarFromText(html);
  }

  const textBody = html.replace(/\s+/g, " ");

  // Seller level (رتبة البائع)
  let sellerLevel = "بائع جديد";
  if (textBody.includes("بائع موثوق")) sellerLevel = "بائع موثوق";
  else if (textBody.includes("بائع مميز")) sellerLevel = "بائع مميز";
  else if (textBody.includes("بائع نشيط")) sellerLevel = "بائع نشيط";

  // Rating
  let overallRating = "100%";
  const rMatch = textBody.match(/التقييم(?:\s*العام)?\s*:?\s*(\d+)%/i) || textBody.match(/([0-9.]+)%/);
  if (rMatch) overallRating = `${rMatch[1]}%`;

  // Clients Count (عدد العملاء / المشترين)
  let clientsCount = "0";
  const clMatch = textBody.match(/عدد\s*العملاء\s*:?\s*(\d+)/i) || textBody.match(/(\d+)\s*مشتري/i);
  if (clMatch) clientsCount = clMatch[1];

  // Response speed
  let responseSpeed = "خلال ساعة";
  const spMatch = textBody.match(/سرعة\s*الرد\s*:?\s*([^،.\n<]{3,30})/i);
  if (spMatch) responseSpeed = spMatch[1].trim();

  // Published Services (Gigs)
  const gigs: Array<{
    title: string;
    price?: string;
    salesCount?: string | number;
    rating?: string | number;
    url?: string;
  }> = [];

  $(".service-card, .service-item, .card--service, .card").each((_, el) => {
    const sTitle =
      $(el).find("h3, .service-title, .card__title, a[href*='/service/']").first().text().replace(/\s+/g, " ").trim();
    const sLink = $(el).find("a[href*='/service/']").first().attr("href") || "";
    const sPrice = $(el).find(".price, .service-price, .badge-price").first().text().trim() || "$5";

    if (sTitle && sTitle.length > 5 && !gigs.some((g) => g.title === sTitle)) {
      gigs.push({
        title: sTitle,
        price: sPrice.includes("$") ? sPrice : `$${sPrice}`,
        url: sLink ? (sLink.startsWith("/") ? `https://khamsat.com${sLink}` : sLink) : undefined,
      });
    }
  });

  const skills: string[] = [];
  gigs.forEach(g => {
    skills.push(g.title.slice(0, 30));
  });

  return {
    fullName,
    headline: `${sellerLevel} في خمسات`,
    bio: bio || `بائع موثوق يقدم خدمات مصغرة احترافية على خمسات بتقييم ممتاز.`,
    skills: skills.length ? skills : ["خدمات مصغرة", "تنفيذ احترافي", "دعم فني"],
    portfolioItems: gigs.map(g => ({
      title: g.title,
      description: `خدمة معروضة على خمسات بسعر ${g.price || "$5"}`,
      project_url: g.url,
      skills: ["خدمات خمسات"],
      category: "service",
    })),
    portfolioCount: gigs.length,
    avatarUrl,
    platformType: "khamsat",
    sourceUrl: targetUrl,
    stats: {
      sellerLevel,
      overallRating,
      clientsCount,
      responseSpeed,
      activeServicesCount: gigs.length,
      portfolioCount: gigs.length,
    },
    gigs,
  };
}

/**
 * Universal profile router based on URL
 */
export async function scrapeProfileByPlatform(
  targetUrl: string
): Promise<ExtractedProfileData> {
  const platform = detectPlatformFromUrl(targetUrl);
  switch (platform) {
    case "mostaql":
      return scrapeMostaqlProfile(targetUrl);
    case "nafezly":
      return scrapeNafezlyProfile(targetUrl);
    case "khamsat":
      return scrapeKhamsatProfile(targetUrl);
    default:
      // Upwork or other platform handled by existing profile-importer
      const { extractProfileFromUrl } = await import("./profile-importer");
      return extractProfileFromUrl(targetUrl);
  }
}
