// ==============================================================================
// src/lib/scrapers/remoteok.ts
// RemoteOK Global Marketplace Scraper (Free Public JSON API)
// Siphons live remote projects and engineering/design leads at $0 Cost
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory } from './types';
import { isCategoryMatch } from '../filters/categorizer';
import { classifyProject } from '../taxonomy';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

/**
 * Scrapes fresh tech and design remote leads from RemoteOK public API.
 */
export async function scrapeRemoteOkCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 20
): Promise<UnifiedProject[]> {
  const url = 'https://remoteok.com/api';

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[RemoteOK Scraper] HTTP ${res.status} returned`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const projects: UnifiedProject[] = [];

    // First element of remoteok is legal disclaimer, jobs start at index 1
    for (let i = 1; i < data.length && projects.length < limit; i++) {
      const job = data[i];
      if (!job || !job.id || !job.position) continue;

      const jobSkills: string[] = Array.isArray(job.tags) ? job.tags : [];

      // Classify with 3-Layer Master Taxonomy using Position + Tags
      const classResult = classifyProject({
        platform: 'remoteok',
        title: job.position,
        description: (job.description || '').slice(0, 500),
        skills: jobSkills,
      });

      if (categorySlug !== 'all' && !isCategoryMatch(classResult.category, categorySlug)) continue;

      const title = `${job.company ? `${job.company}: ` : ''}${job.position}`;
      // The API double-escapes newlines: descriptions contain literal "\n" sequences
      const description = (job.description || job.position)
        .replace(/<[^>]*>/g, ' ')
        .replace(/(?:\\[nrt])+/g, '\n')
        .replace(/&amp;/g, '&')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n\s*\n+/g, '\n')
        .trim()
        .slice(0, 1000);
      const postUrl = job.url || `https://remoteok.com/remote-jobs/${job.id}`;

      let budgetMin = job.salary_min || null;
      let budgetMax = job.salary_max || null;
      let budgetStr: string | null = null;

      // Salary fields only: guessing from the description misreads "$100,000 - $120,000 a year"
      // as "0 - 120". Yearly salaries, so label them.
      if (budgetMin || budgetMax) {
        const fmt = (n: number) => `$${Number(n).toLocaleString('en-US')}`;
        budgetStr =
          budgetMin && budgetMax && budgetMin !== budgetMax
            ? `${fmt(budgetMin)} - ${fmt(budgetMax)} / year`
            : `${fmt(budgetMax || budgetMin)} / year`;
      }

      projects.push(
        createUnifiedProject({
          external_id: String(job.id),
          platform: 'remoteok',
          title,
          description,
          url: postUrl,
          budget: budgetStr,
          budget_min: budgetMin,
          budget_max: budgetMax,
          currency: 'USD',
          language: 'en',
          category: classResult.category,
          raw_skills: jobSkills.length > 0 ? jobSkills : null,
          published_at: job.date ? new Date(job.date).toISOString() : new Date().toISOString(),
          author: job.company || 'Remote Employer',
        })
      );
    }

    console.log(`[RemoteOK Scraper] Extracted ${projects.length} live leads for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[RemoteOK Scraper] Error scraping ${categorySlug}:`, err.message);
    return [];
  }
}
