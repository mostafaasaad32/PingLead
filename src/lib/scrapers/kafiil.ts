// ==============================================================================
// src/lib/scrapers/kafiil.ts
// Arabic Freelance Platform Scraper (Kafiil - كفيل)
// Scrapes open client projects directly from https://kafiil.com/projects with authentic dates
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory } from './types';
import { parseArabicRelativeDate } from './utils';
import { classifyProjectCategory, extractCleanBudget } from '../filters/categorizer';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const CATEGORY_MAP: Record<string, string> = {
  web_mobile_dev: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  web_dev: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  ai_data_automation: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  it_cybersecurity_devops: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  game_ar_vr: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  ecommerce_stores: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  ui_ux_graphic: 'https://kafiil.com/projects?page=1',
  ui_ux: 'https://kafiil.com/projects?page=1',
  design: 'https://kafiil.com/projects?page=1',
  video_audio_motion: 'https://kafiil.com/projects?page=1',
  digital_marketing_seo: 'https://kafiil.com/projects?page=1',
  marketing: 'https://kafiil.com/projects?page=1',
  writing_translation: 'https://kafiil.com/projects?page=1',
  writing: 'https://kafiil.com/projects?page=1',
  business_accounting_legal: 'https://kafiil.com/projects?page=1',
  accounting: 'https://kafiil.com/projects?page=1',
  sales_customer_support: 'https://kafiil.com/projects?page=1',
  engineering_architecture: 'https://kafiil.com/projects?page=1',
  education_training: 'https://kafiil.com/projects?page=1',
  other: 'https://kafiil.com/projects?page=1',
};

/**
 * Scrapes open client projects from Kafiil marketplace.
 */
export async function scrapeKafiilCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 25
): Promise<UnifiedProject[]> {
  const url = CATEGORY_MAP[categorySlug] || 'https://kafiil.com/projects';

  try {
    let res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
      },
    });

    if (!res.ok && url !== 'https://kafiil.com/projects') {
      res = await fetch('https://kafiil.com/projects', {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ar,en;q=0.9',
        },
      });
    }

    if (!res.ok) {
      console.warn(`[Kafiil Scraper] HTTP ${res.status} returned from ${url}`);
      return [];
    }

    const html = await res.text();
    const projects: UnifiedProject[] = [];

    const projectRegex = /<a\s+href="(https:\/\/kafiil\.com\/project\/(\d+)-[^"]*)"\s+class="name\s+bold-text[^"]*">([\s\S]*?)<\/a>/gi;

    let match;
    while ((match = projectRegex.exec(html)) !== null && projects.length < limit) {
      const projectUrl = match[1];
      const projectId = match[2];
      const rawTitle = match[3];

      const cleanTitle = rawTitle.replace(/<[^>]*>/g, '').replace(/مفتوح/g, '').replace(/\s+/g, ' ').trim();
      if (!cleanTitle) continue;

      // Percent-encoded Arabic URLs make the title link alone several hundred chars long
      const subHtml = html.slice(match.index, match.index + 4000);
      const authorMatch = subHtml.match(/class="text\s+user"[^>]*>([\s\S]*?)<\/a>/i);
      const author = authorMatch
        ? authorMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        : 'عميل كفيل';

      const agoMatch = subHtml.match(/<i class="far fa-clock"><\/i>\s*([\s\S]*?)<\/span>/i);
      const publishedAt = parseArabicRelativeDate(agoMatch ? agoMatch[1].replace(/<[^>]*>/g, '').trim() : null);

      // Bids so far: <i class="fas fa-hand-holding-usd"></i> 15 عروض (stop at the next card)
      const nextCard = subHtml.indexOf('class="name bold-text', match[0].length);
      const cardHtml = nextCard > 0 ? subHtml.slice(0, nextCard) : subHtml;
      const bidsMatch = cardHtml.match(/fa-hand-holding-usd"><\/i>\s*(\d+)/i);

      const detectedCat = classifyProjectCategory(cleanTitle, categorySlug);
      const budget = extractCleanBudget(`${cleanTitle} ${cardHtml}`);

      projects.push(
        createUnifiedProject({
          external_id: projectId,
          platform: 'kafiil',
          title: cleanTitle,
          description: cleanTitle,
          url: projectUrl,
          budget: budget.budget_text,
          budget_min: budget.budget_min,
          budget_max: budget.budget_max,
          currency: budget.currency || 'USD',
          language: 'ar',
          category: detectedCat,
          published_at: publishedAt,
          author,
          insights: { bids_count: bidsMatch ? parseInt(bidsMatch[1], 10) : null },
        })
      );
    }

    console.log(`[Kafiil Scraper] Extracted ${projects.length} live projects for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[Kafiil Scraper] Error scraping ${categorySlug}:`, err.message);
    return [];
  }
}
