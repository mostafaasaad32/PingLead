// ==============================================================================
// src/lib/scrapers/wwr.ts
// Global Remote Marketplace Scraper (WeWorkRemotely - WWR)
// Siphons live remote projects and positions via Category RSS Feeds at $0 Cost
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory } from './types';
import { classifyProjectCategory, extractCleanBudget } from '../filters/categorizer';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const CATEGORY_FEED_MAP: Record<string, string> = {
  web_mobile_dev: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  web_dev: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  ai_data_automation: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  it_cybersecurity_devops: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  game_ar_vr: 'https://weworkremotely.com/categories/remote-programming-jobs.rss',
  ecommerce_stores: 'https://weworkremotely.com/remote-jobs.rss',
  ui_ux_graphic: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
  ui_ux: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
  design: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
  video_audio_motion: 'https://weworkremotely.com/categories/remote-design-jobs.rss',
  digital_marketing_seo: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
  marketing: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss',
  sales_customer_support: 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
  support: 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss',
  writing_translation: 'https://weworkremotely.com/remote-jobs.rss',
  writing: 'https://weworkremotely.com/remote-jobs.rss',
  business_accounting_legal: 'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss',
  accounting: 'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss',
  engineering_architecture: 'https://weworkremotely.com/remote-jobs.rss',
  education_training: 'https://weworkremotely.com/remote-jobs.rss',
  other: 'https://weworkremotely.com/remote-jobs.rss',
};

/**
 * Scrapes fresh remote work leads from WeWorkRemotely RSS feeds.
 */
export async function scrapeWwrCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 20
): Promise<UnifiedProject[]> {
  const url = CATEGORY_FEED_MAP[categorySlug] || 'https://weworkremotely.com/remote-jobs.rss';

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      console.warn(`[WWR Scraper] HTTP ${res.status} returned from ${url}`);
      return [];
    }

    const xml = await res.text();
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    const projects: UnifiedProject[] = [];

    let match;
    while ((match = itemRegex.exec(xml)) !== null && projects.length < limit) {
      const itemXml = match[1];

      // Extract title
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
      let title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim() : '';
      title = title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

      // Extract link
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
      const postUrl = linkMatch ? linkMatch[1].trim() : '';

      // Extract description
      const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);
      let desc = descMatch ? descMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim() : '';
      desc = desc.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      // Extract publication date
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString();

      if (!title || !postUrl) continue;

      const idMatch = postUrl.match(/remote-jobs\/([^\/\?]+)/i);
      const externalId = idMatch ? idMatch[1] : Buffer.from(postUrl).toString('base64').slice(0, 16);

      let author = 'Remote Employer';
      if (title.includes(':')) {
        const parts = title.split(':');
        author = parts[0].trim();
      }

      // WWR's own <category> (e.g. "Full-Stack Programming") is the best hint when the text is vague
      const wwrCategory = itemXml.match(/<category>([\s\S]*?)<\/category>/i)?.[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim();
      const cat = classifyProjectCategory(`${title} ${desc}`, wwrCategory || categorySlug);
      const budget = extractCleanBudget(`${title} ${desc}`);

      projects.push(
        createUnifiedProject({
          external_id: externalId,
          platform: 'wwr',
          title,
          description: desc ? desc.slice(0, 1000) : title,
          url: postUrl,
          budget: budget.budget_text,
          budget_min: budget.budget_min,
          budget_max: budget.budget_max,
          currency: budget.currency || 'USD',
          language: 'en',
          category: cat,
          published_at: pubDate,
          author,
        })
      );
    }

    console.log(`[WWR Scraper] Extracted ${projects.length} live leads for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[WWR Scraper] Error scraping ${categorySlug}:`, err.message);
    return [];
  }
}
