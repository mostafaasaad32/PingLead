// ==============================================================================
// src/lib/scrapers/pph.ts
// Global Freelance Platform Scraper (PeoplePerHour & Remotive Global Feed)
// Siphons live freelance & remote client opportunities at $0 API Cost
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory } from './types';
import { classifyProjectCategory, extractCleanBudget, isCategoryMatch } from '../filters/categorizer';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

/**
 * Scrapes global freelance opportunities from PeoplePerHour / Remotive Public Stream
 */
export async function scrapePphCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 20
): Promise<UnifiedProject[]> {
  const projects: UnifiedProject[] = [];

  // 1. Attempt PPH RSS Feed
  try {
    const res = await fetch('https://www.peopleperhour.com/freelance-jobs?feed=rss', {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (res.ok) {
      const xml = await res.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];

      for (const itemXml of items) {
        if (projects.length >= limit) break;

        const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
        const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
        const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);
        const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

        if (!titleMatch || !linkMatch) continue;

        const title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim();
        const url = linkMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim();
        const desc = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').trim() : title;
        const pubDate = pubDateMatch ? new Date(pubDateMatch[1]).toISOString() : new Date().toISOString();

        const cat = classifyProjectCategory(`${title} ${desc}`, categorySlug);
        const budget = extractCleanBudget(`${title} ${desc}`);

        projects.push(
          createUnifiedProject({
            external_id: Buffer.from(url).toString('base64').slice(0, 16),
            platform: 'pph',
            title,
            description: desc,
            url,
            budget: budget.budget_text,
            budget_min: budget.budget_min,
            budget_max: budget.budget_max,
            currency: budget.currency,
            language: 'en',
            category: cat,
            published_at: pubDate,
            author: 'PPH Client',
          })
        );
      }
    }
  } catch (err: any) {
    console.warn('[PPH Scraper] RSS fetch failed, utilizing global stream fallback:', err.message);
  }

  // 2. High-reliability Global Remote & Freelance API Fallback (Remotive Public API)
  if (projects.length < limit) {
    try {
      const res = await fetch('https://remotive.com/api/remote-jobs?limit=25', {
        headers: { 'User-Agent': USER_AGENT, 'Accept': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        const remotiveJobs = data.jobs || [];

        for (const job of remotiveJobs) {
          if (projects.length >= limit) break;
          if (!job.title || !job.url) continue;

          const cat = classifyProjectCategory(`${job.title} ${job.description || ''}`, job.category);
          if (categorySlug !== 'all' && !isCategoryMatch(cat, categorySlug)) continue;

          const budget = extractCleanBudget(`${job.salary || ''} ${job.title}`);

          projects.push(
            createUnifiedProject({
              external_id: `remotive_${job.id}`,
              platform: 'pph',
              title: `${job.company_name ? `${job.company_name}: ` : ''}${job.title}`,
              description: (job.description || job.title).replace(/<[^>]*>/g, '').slice(0, 800),
              url: job.url,
              budget: job.salary || budget.budget_text || null,
              budget_min: budget.budget_min,
              budget_max: budget.budget_max,
              currency: budget.currency || '$',
              language: 'en',
              category: cat,
              published_at: job.publication_date ? new Date(job.publication_date).toISOString() : new Date().toISOString(),
              author: job.company_name || 'Global Client',
            })
          );
        }
      }
    } catch (err: any) {
      console.warn('[PPH Scraper] Global stream fallback failed:', err.message);
    }
  }

  console.log(`[PPH Scraper] Extracted ${projects.length} live global opportunities for #${categorySlug}`);
  return projects;
}
