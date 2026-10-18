// ==============================================================================
// src/lib/scrapers/mostaql.ts
// #1 Arabic Freelance Platform Scraper Engine (Mostaql - مستقل)
// Covers Egypt, Saudi Arabia, UAE, and the Gulf with 100% Arabic direct client projects
// Zero Cost - Real-time HTML Scraping with resilient fallback
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory } from './types';
import { parseArabicRelativeDate } from './utils';
import { classifyProjectCategory, extractCleanBudget } from '../filters/categorizer';

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
  const mostaqlCategory = CATEGORY_MAP[categorySlug] || 'development';
  let targetUrl = `https://mostaql.com/projects?category=${mostaqlCategory}&sort=latest`;

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

      // Extract card context for brief, author, date, and budget
      const cardContext = html.slice(tMatch.index, tMatch.index + 3500);

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

      // Budget extraction
      const budget = extractCleanBudget(`${cleanTitle} ${brief} ${cardContext.slice(0, 500)}`);

      // Category classification
      const detectedCat = classifyProjectCategory(`${cleanTitle} ${brief}`, categorySlug);

      projects.push(
        createUnifiedProject({
          external_id: projectId,
          platform: 'mostaql',
          title: cleanTitle,
          description: brief,
          url: projectUrl,
          budget: budget.budget_text,
          budget_min: budget.budget_min,
          budget_max: budget.budget_max,
          currency: budget.currency || 'USD',
          language: 'ar',
          category: detectedCat,
          published_at: publishedAt,
          author,
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
