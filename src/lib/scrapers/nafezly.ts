// ==============================================================================
// src/lib/scrapers/nafezly.ts
// Arabic Freelance Platform Scraper Engine (Nafezly - نفذلي)
// Extracts authentic live projects with genuine source publication timestamps
// Uses direct HTML parsing from https://nafezly.com/projects?sort=latest
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
  sales_customer_support: 'business',
  support: 'business',
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
 * Scrapes fresh, real-world Arabic freelance client projects directly from Nafezly
 * extracting authentic publication dates (e.g. "منذ 45 دقيقة", "منذ ساعتين", "منذ 10 ساعات").
 */
export async function scrapeNafezlyCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 25
): Promise<UnifiedProject[]> {
  // 'all' = newest projects across every Nafezly category
  const nafezlyCat = CATEGORY_MAP[categorySlug] || 'development';
  let targetUrl =
    categorySlug === 'all'
      ? 'https://nafezly.com/projects?sort=latest'
      : `https://nafezly.com/projects?category=${nafezlyCat}&sort=latest`;

  try {
    let res = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      targetUrl = 'https://nafezly.com/projects?sort=latest';
      res = await fetch(targetUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        },
      });
    }

    if (!res.ok) {
      console.warn(`[Nafezly Scraper] HTTP ${res.status} returned from ${targetUrl}`);
      return [];
    }

    const html = await res.text();
    const projects: UnifiedProject[] = [];

    // Match each project card link and title
    const projectRegex = /<a[^>]*href="(https:\/\/nafezly\.com\/project\/(\d+)-([^\"]+))"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const seenIds = new Set<string>();

    while ((match = projectRegex.exec(html)) !== null && projects.length < limit) {
      const projectUrl = match[1];
      const projectId = match[2];
      const rawTitle = match[4];
      const cleanTitle = rawTitle.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      if (!cleanTitle || seenIds.has(projectId)) continue;
      seenIds.add(projectId);

      // Card context runs until the next (different) project's link
      const rawContext = html.slice(match.index, match.index + 7000);
      const nextProjectRegex = /href="https:\/\/nafezly\.com\/project\/(\d+)-/g;
      let cardEnd = rawContext.length;
      let np;
      while ((np = nextProjectRegex.exec(rawContext)) !== null) {
        if (np[1] !== projectId) {
          cardEnd = np.index;
          break;
        }
      }
      const cardContext = rawContext.slice(0, cardEnd);

      // Competition & client signals: <span class="fal fa-ballot ..."></span> 37 عروض
      const iconText = (icon: string) =>
        cardContext
          .match(new RegExp(`${icon}[^"]*"[^>]*><\\/span>\\s*([^<]+)`, 'i'))?.[1]
          .replace(/\s+/g, ' ')
          .trim() || null;
      const bidsText = iconText('fa-ballot');
      const bidsDigits = bidsText?.match(/\d+/);
      const insights = {
        bids_count: bidsDigits ? parseInt(bidsDigits[0], 10) : null,
        duration_text: iconText('fa-business-time'),
        client_country: iconText('fa-map-marker-alt'),
      };

      // Extract description
      const descMatch = cardContext.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const desc = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : cleanTitle;

      // Extract authentic clock relative time: <span class="fal fa-clock"...></span> منذ ...
      const clockMatch =
        cardContext.match(/fa-clock[^>]*><\/span>\s*([^<\n\r]+)/i) ||
        cardContext.match(/fa-clock[\s\S]{0,120}?(منذ\s+[^<\n\r]+)/i);

      let clockText = clockMatch ? clockMatch[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : null;
      const publishedAt = parseArabicRelativeDate(clockText);

      // Extract budget
      const budgetMatch = cardContext.match(/(\d+\s*-\s*\d+\s*\$|\d+\s*\$)/i);
      const budget = budgetMatch ? extractCleanBudget(budgetMatch[1]) : extractCleanBudget(`${cleanTitle} ${desc}`);

      // Category
      const detectedCat = classifyProjectCategory(`${cleanTitle} ${desc}`, categorySlug);

      // Author extraction if present
      const authorMatch = cardContext.match(/data-profile-role="owner"[^>]*>([\s\S]*?)<\/a>/i);
      const author = authorMatch ? authorMatch[1].replace(/<[^>]*>/g, '').trim() : 'عميل نفذلي';

      projects.push(
        createUnifiedProject({
          external_id: projectId,
          platform: 'nafezly',
          title: cleanTitle,
          description: desc,
          url: projectUrl,
          budget: budget.budget_text,
          budget_min: budget.budget_min,
          budget_max: budget.budget_max,
          currency: budget.currency || 'USD',
          language: 'ar',
          category: detectedCat,
          published_at: publishedAt,
          author,
          insights,
        })
      );
    }

    console.log(`[Nafezly Scraper] Extracted ${projects.length} live opportunities with authentic dates for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[Nafezly Scraper] Error scraping ${categorySlug}:`, err.message);
    return [];
  }
}
