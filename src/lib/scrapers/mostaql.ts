// ==============================================================================
// src/lib/scrapers/mostaql.ts
// #1 Arabic Freelance Platform Scraper Engine (Mostaql - مستقل)
// Covers Egypt, Saudi Arabia, UAE, and the Gulf with 100% Arabic direct client projects
// Zero Cost - Real-time HTML Scraping with resilient fallback
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory, ProjectInsights } from './types';
import { parseArabicRelativeDate } from './utils';
import { classifyProjectCategory } from '../filters/categorizer';
import { calculateClientScore } from '../scoring/client-scorer';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const CATEGORY_MAP: Record<string, string> = {
  web_mobile_dev: 'development',
  web_dev: 'development',
  ai_data_automation: 'development',
  it_cybersecurity_devops: 'development',
  game_ar_vr: 'development',
  ecommerce_stores: 'development',
  ui_ux_graphic: 'design',
  ui_ux: 'design',
  design: 'design',
  video_audio_motion: 'design',
  digital_marketing_seo: 'marketing',
  marketing: 'marketing',
  sales_customer_support: 'support',
  support: 'support',
  writing_translation: 'writing-translation',
  writing: 'writing-translation',
  business_accounting_legal: 'business',
  accounting: 'business',
  business: 'business',
  engineering_architecture: 'engineering-architecture',
  education_training: 'training',
  other: 'consulting',
};

/**
 * Scrapes fresh, real-world Arabic freelance client projects directly from Mostaql
 * with exact publication date, budget bounds, and category classification.
 */
export async function scrapeMostaqlCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 25
): Promise<UnifiedProject[]> {
  // 'all' = the newest projects across every Mostaql category (covers ~4 hours per page)
  const mostaqlCategory = CATEGORY_MAP[categorySlug] || 'development';
  let targetUrl =
    categorySlug === 'all'
      ? 'https://mostaql.com/projects?sort=latest'
      : `https://mostaql.com/projects?category=${mostaqlCategory}&sort=latest`;

  try {
    let res = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      // Fallback to general latest projects page
      targetUrl = 'https://mostaql.com/projects?sort=latest';
      res = await fetch(targetUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        },
      });
    }

    if (!res.ok) {
      console.warn(`[Mostaql Scraper] returned HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const projects: UnifiedProject[] = [];

    // Match each project card title and URL
    const titleRegex = /<h2 class="mrg--bt-reset">\s*<a\s+href="(https:\/\/mostaql\.com\/project\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

    let tMatch;
    while ((tMatch = titleRegex.exec(html)) !== null && projects.length < limit) {
      const projectUrl = tMatch[1];
      const projectId = tMatch[2];
      const cleanTitle = tMatch[3].replace(/<[^>]*>/g, '').trim();

      // Extract card context for brief, author, date, and budget (stop at the next card)
      const rawContext = html.slice(tMatch.index, tMatch.index + 3500);
      const nextCardAt = rawContext.indexOf('class="project-row"', 1);
      const cardContext = nextCardAt > 0 ? rawContext.slice(0, nextCardAt) : rawContext;

      // Bids so far: <span class="hsoub-file-signature-icon"></span> 3 عروض / أضف أول عرض
      let bidsCount: number | null = null;
      if (cardContext.includes('أضف أول عرض')) {
        bidsCount = 0;
      } else {
        const bidsMatch = cardContext.match(/hsoub-file-signature-icon"><\/span>\s*(\d+)/i);
        bidsCount = bidsMatch ? parseInt(bidsMatch[1], 10) : null;
      }

      // Brief
      const briefMatch = cardContext.match(/<p class="text-wrapper-div project__brief\s*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/p>/i);
      const brief = briefMatch ? briefMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : cleanTitle;

      // Author
      const authorMatch = cardContext.match(/<bdi>([\s\S]*?)<\/bdi>/i);
      const author = authorMatch ? authorMatch[1].replace(/<[^>]*>/g, '').trim() : 'عميل مستقل';

      // Date: Extract exact <time datetime="..."> or relative "منذ ..."
      const timeTagMatch = cardContext.match(/<time[^>]*datetime=["']([^"']+)["']/i);
      const agoMatch = cardContext.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
      const rawDate = timeTagMatch ? timeTagMatch[1] : (agoMatch ? agoMatch[1].replace(/<[^>]*>/g, '').trim() : null);
      const publishedAt = parseArabicRelativeDate(rawDate);

      // No budget here: the listing card doesn't show it, and guessing from the title
      // picked up numbers like "14 يوم". fetchMostaqlProjectDetails reads the real range.

      // Category classification
      const detectedCat = classifyProjectCategory(`${cleanTitle} ${brief}`, categorySlug);

      projects.push(
        createUnifiedProject({
          external_id: projectId,
          platform: 'mostaql',
          title: cleanTitle,
          description: brief,
          url: projectUrl,
          budget: null,
          budget_min: null,
          budget_max: null,
          currency: 'USD',
          language: 'ar',
          category: detectedCat,
          published_at: publishedAt,
          author,
          insights: { bids_count: bidsCount },
        })
      );
    }

    console.log(`[Mostaql Scraper] Extracted ${projects.length} live Arabic projects for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[Mostaql Scraper] Error scraping ${categorySlug}:`, err.message);
    return [];
  }
}

const stripHtml = (s: string) =>
  s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

/**
 * Reads a Mostaql project page for what the listing doesn't show:
 * the full description, delivery time, and the client's hiring history.
 * Returns null when the page can't be read.
 */
export interface MostaqlProjectDetails extends ProjectInsights {
  description?: string;
  budget_min?: number | null;
  budget_max?: number | null;
  /** Mostaql's own category slug from the breadcrumb, e.g. "ai-machine-learning" */
  platform_category?: string | null;
}

export async function fetchMostaqlProjectDetails(
  projectUrl: string
): Promise<MostaqlProjectDetails | null> {
  try {
    const res = await fetch(projectUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const descMatch = html.match(
      /id="projectDetailsTab"[\s\S]*?<div class="text-wrapper-div carda__content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    const durationMatch = html.match(/مدة التنفيذ<\/div>\s*<div class="meta-value"[^>]*>([\s\S]*?)<\/div>/i);

    // Hire rate is either "85.71%" or "لم يحسب بعد" (no history yet)
    const hireMatch = html.match(/معدل التوظيف<\/span>\s*<\/td>\s*<td>\s*<label[^>]*>([\s\S]*?)<\/label>/i);
    const hirePercent = hireMatch?.[1].match(/([\d.]+)\s*%/);

    const openMatch = html.match(/المشاريع المفتوحة<\/span><\/td>\s*<td>\s*(\d+)/i);
    const progressMatch = html.match(/مشاريع قيد التنفيذ<\/span><\/td>\s*<td>\s*(\d+)/i);
    const registeredMatch = html.match(/تاريخ التسجيل<\/td>\s*<td>\s*<time>([^<]+)<\/time>/i);

    // Budget isn't on the listing card: data-type= project-budget_range ><span dir="rtl">$25.00 - $50.00</span>
    const budgetMatch = html.match(/project-budget_range[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i);
    const budgetNumbers = (budgetMatch?.[1].match(/[\d,]+(?:\.\d+)?/g) || [])
      .map((n) => parseFloat(n.replace(/,/g, '')))
      .filter((n) => n > 0);

    // Breadcrumb: <a href="https://mostaql.com/projects/development">
    const breadcrumbAt = html.indexOf('breadcrumb-item');
    const categoryMatch =
      breadcrumbAt >= 0
        ? html.slice(breadcrumbAt, breadcrumbAt + 2000).match(/href="https:\/\/mostaql\.com\/projects\/([a-z-]+)"/i)
        : null;

    const hireRateNum = hirePercent ? Math.min(100, parseFloat(hirePercent[1])) : null;
    const isPaymentVerified =
      html.includes('هوية موثقة') ||
      html.includes('بريد مؤكد') ||
      html.includes('جوال مؤكد') ||
      Boolean(hireRateNum && hireRateNum > 0);

    const description = descMatch ? stripHtml(descMatch[1]) : undefined;
    const minBudget = budgetNumbers.length ? Math.min(...budgetNumbers) : null;
    const maxBudget = budgetNumbers.length ? Math.max(...budgetNumbers) : null;

    const clientEvaluation = calculateClientScore({
      platform: 'mostaql',
      client_hire_rate: hireRateNum,
      client_open_projects: openMatch ? parseInt(openMatch[1], 10) : null,
      client_in_progress: progressMatch ? parseInt(progressMatch[1], 10) : null,
      client_registered_at: registeredMatch ? registeredMatch[1].trim() : null,
      payment_verified: isPaymentVerified,
      description,
      budget_min: minBudget,
      budget_max: maxBudget,
    });

    return {
      platform_category: categoryMatch ? categoryMatch[1] : null,
      budget_min: minBudget,
      budget_max: maxBudget,
      description,
      duration_text: durationMatch ? stripHtml(durationMatch[1]).replace(/\s+/g, ' ') : null,
      client_hire_rate: hireRateNum,
      client_open_projects: openMatch ? parseInt(openMatch[1], 10) : null,
      client_in_progress: progressMatch ? parseInt(progressMatch[1], 10) : null,
      client_registered_at: registeredMatch ? registeredMatch[1].trim() : null,
      payment_verified: isPaymentVerified,
      client_evaluation: clientEvaluation,
      details_fetched_at: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn(`[Mostaql Details] Could not read ${projectUrl}:`, err.message);
    return null;
  }
}
