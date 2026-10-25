// ==============================================================================
// src/lib/scrapers/baeed.ts
// Arabic Remote Jobs & Freelance Platform (Baeed / Baaeed - بعيد حسوب)
// Scrapes live remote work opportunities across Arab world with authentic dates
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory } from './types';
import { parseArabicRelativeDate } from './utils';
import { extractCleanBudget } from '../filters/categorizer';
import { classifyProject } from '../taxonomy';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const CATEGORY_MAP: Record<string, string> = {
  web_mobile_dev: 'https://baaeed.com/categories/remote-programming-jobs',
  web_dev: 'https://baaeed.com/categories/remote-programming-jobs',
  ai_data_automation: 'https://baaeed.com/categories/remote-programming-jobs',
  it_cybersecurity_devops: 'https://baaeed.com/categories/remote-programming-jobs',
  game_ar_vr: 'https://baaeed.com/categories/remote-programming-jobs',
  ecommerce_stores: 'https://baaeed.com/categories/remote-programming-jobs',
  ui_ux_graphic: 'https://baaeed.com/categories/remote-design-jobs',
  ui_ux: 'https://baaeed.com/categories/remote-design-jobs',
  design: 'https://baaeed.com/categories/remote-design-jobs',
  video_audio_motion: 'https://baaeed.com/categories/remote-design-jobs',
  digital_marketing_seo: 'https://baaeed.com/categories/remote-marketing-sales-jobs',
  marketing: 'https://baaeed.com/categories/remote-marketing-sales-jobs',
  sales_customer_support: 'https://baaeed.com/categories/remote-support-jobs',
  support: 'https://baaeed.com/categories/remote-support-jobs',
  writing_translation: 'https://baaeed.com/categories/remote-translation-jobs',
  writing: 'https://baaeed.com/categories/remote-translation-jobs',
  business_accounting_legal: 'https://baaeed.com/categories/remote-business-jobs',
  accounting: 'https://baaeed.com/categories/remote-business-jobs',
  engineering_architecture: 'https://baaeed.com/remote-jobs',
  education_training: 'https://baaeed.com/remote-jobs',
  other: 'https://baaeed.com/remote-jobs',
};

/**
 * Scrapes remote opportunities from Baaeed (Hsoub) with authentic dates.
 */
export async function scrapeBaeedCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 20
): Promise<UnifiedProject[]> {
  // Unmapped slugs (including 'all') read every category, not just programming
  const url = CATEGORY_MAP[categorySlug] || 'https://baaeed.com/remote-jobs';

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      console.warn(`[Baeed Scraper] HTTP ${res.status} returned from ${url}`);
      return [];
    }

    const html = await res.text();
    const projects: UnifiedProject[] = [];

    const jobRegex = /href="(https:\/\/baaeed\.com\/remote-jobs\/([^"]+))"[^>]*>([\s\S]*?)<\/a>/gi;
    const jobsMap = new Map<string, { id: string; url: string; texts: string[]; rawDate: string | null }>();

    let match;
    while ((match = jobRegex.exec(html)) !== null) {
      const jobUrl = match[1];
      const jobSlug = match[2];
      const text = match[3].replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');

      if (!text) continue;

      const subHtml = html.slice(match.index, match.index + 2200);
      const timeMatch = subHtml.match(/<time[^>]*datetime=["']([^"']+)["']/i);
      const agoMatch = subHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/i) || subHtml.match(/(منذ\s+[^<]+)/i);
      const rawDate = timeMatch ? timeMatch[1].trim() : (agoMatch ? agoMatch[1].replace(/<[^>]*>/g, '').trim() : null);

      if (!jobsMap.has(jobUrl)) {
        jobsMap.set(jobUrl, { id: jobSlug, url: jobUrl, texts: [text], rawDate });
      } else {
        const existing = jobsMap.get(jobUrl)!;
        existing.texts.push(text);
        if (!existing.rawDate && rawDate) existing.rawDate = rawDate;
      }
    }

    const rawCategory = url.includes('/categories/')
      ? url.split('/categories/')[1].replace(/-jobs$/, '')
      : (categorySlug !== 'all' ? categorySlug : null);

    for (const [jobUrl, data] of jobsMap.entries()) {
      if (projects.length >= limit) break;

      const sortedTexts = [...data.texts].sort((a, b) => a.length - b.length);
      const title = sortedTexts[0] || 'وظيفة عن بعد';
      const description = sortedTexts.slice(1).join(' ') || title;
      const company = data.id.split('-')[0] || 'صاحب عمل';
      const publishedAt = parseArabicRelativeDate(data.rawDate);

      const classResult = classifyProject({
        platform: 'baeed',
        title,
        description,
        rawCategory,
      });
      const budget = extractCleanBudget(`${title} ${description}`);

      projects.push(
        createUnifiedProject({
          external_id: data.id,
          platform: 'baeed',
          title,
          description,
          url: jobUrl,
          budget: budget.budget_text,
          budget_min: budget.budget_min,
          budget_max: budget.budget_max,
          currency: budget.currency || 'USD',
          language: 'ar',
          category: classResult.category,
          raw_category: rawCategory,
          published_at: publishedAt,
          author: company,
        })
      );
    }

    console.log(`[Baeed Scraper] Extracted ${projects.length} live opportunities for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[Baeed Scraper] Error scraping ${categorySlug}:`, err.message);
    return [];
  }
}
