// ==============================================================================
// src/lib/scrapers/khamsat.ts
// Khamsat (خمسات) Buyer Requests Scraper Engine
// Siphons real-time direct buyer requests ("طلبات الخدمات غير الموجودة") with authentic dates
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory } from './types';
import { parseArabicRelativeDate } from './utils';
import { classifyProjectCategory, extractCleanBudget, isCategoryMatch } from '../filters/categorizer';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

/**
 * Scrapes fresh buyer requests from Khamsat Community Requests section.
 */
export async function scrapeKhamsatCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 25
): Promise<UnifiedProject[]> {
  const url = 'https://khamsat.com/community/requests';

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      }
    });

    if (!res.ok) {
      console.warn(`[Khamsat Scraper] returned HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const regex = /href=["'](\/community\/requests\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const authorRegex = /<a\s+class="user"[^>]*href="\/user\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    const items: Array<{ href: string; id: string; title: string; index: number }> = [];
    const seenIds = new Set<string>();

    let match;
    while ((match = regex.exec(html)) !== null) {
      const href = match[1];
      const id = match[2];
      const cleanTitle = match[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      if (cleanTitle && !seenIds.has(id)) {
        seenIds.add(id);
        items.push({ href, id, title: cleanTitle, index: match.index });
      }
    }

    const authors: string[] = [];
    let aMatch;
    while ((aMatch = authorRegex.exec(html)) !== null) {
      const cleanAuthor = aMatch[1].replace(/<[^>]*>/g, '').trim();
      if (cleanAuthor) authors.push(cleanAuthor);
    }

    const projects: UnifiedProject[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const detectedCat = classifyProjectCategory(item.title);

      // If user filtered by a specific category, match it
      if (categorySlug !== 'all' && !isCategoryMatch(detectedCat, categorySlug)) continue;

      const author = authors[i] || 'مشتري خمسات';
      const exactUrl = `https://khamsat.com${item.href}`;

      // Extract exact date from title attribute (e.g. title="17&#x2F;10&#x2F;2026 09:21:10 GMT") or relative "منذ..."
      const cardContext = html.slice(item.index, item.index + 1600);
      const titleTimeMatch = cardContext.match(/title=["'](\d{1,2}(?:&#x2F;|\/)\d{1,2}(?:&#x2F;|\/)\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}[^"']*)["']/i);
      const agoMatch = cardContext.match(/(منذ\s+[^<]+)/i);
      const rawDate = titleTimeMatch ? titleTimeMatch[1] : (agoMatch ? agoMatch[1].trim() : null);
      const publishedAt = parseArabicRelativeDate(rawDate);

      // Khamsat requests have no budget field; only use one if the buyer wrote it in the title
      const budget = extractCleanBudget(item.title);

      projects.push(
        createUnifiedProject({
          external_id: item.id,
          platform: 'khamsat',
          title: item.title,
          description: item.title,
          url: exactUrl,
          budget: budget.budget_text || null,
          budget_min: budget.budget_min || null,
          budget_max: budget.budget_max || null,
          currency: budget.currency || 'USD',
          language: 'ar',
          category: detectedCat,
          published_at: publishedAt,
          author,
        })
      );

      if (projects.length >= limit) break;
    }

    console.log(`[Khamsat Scraper] Successfully extracted ${projects.length} live requests for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[Khamsat Scraper] Error scraping for ${categorySlug}:`, err.message);
    return [];
  }
}
