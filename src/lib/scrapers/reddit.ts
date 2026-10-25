// ==============================================================================
// src/lib/scrapers/reddit.ts
// Reddit Hiring Posts Scraper Engine via Scrapling Sidecar
// Leverages curl_cffi Chrome impersonation to bypass Reddit 403 blocks
// ==============================================================================

import { UnifiedProject } from './types';
import { fetchFromScrapling, mapScraplingJobsToUnified } from './scrapling-bridge';

const SUBREDDITS_BY_CATEGORY: Record<string, string[]> = {
  web_mobile_dev: ['forhire', 'freelance_forhire'],
  ai_data_automation: ['forhire'],
  ui_ux_graphic: ['forhire', 'DesignJobs'],
  digital_marketing_seo: ['forhire'],
  writing_translation: ['forhire', 'HireaWriter'],
  other: ['forhire'],
};

export async function scrapeRedditCategory(
  categorySlug: string = 'web_mobile_dev',
  limitPerSubreddit: number = 25
): Promise<UnifiedProject[]> {
  const subs = SUBREDDITS_BY_CATEGORY[categorySlug] || ['forhire'];
  const allProjects: UnifiedProject[] = [];

  for (const subreddit of subs) {
    try {
      const jobs = await fetchFromScrapling('reddit', {
        subreddit,
        limit: limitPerSubreddit,
      });

      if (jobs && jobs.length > 0) {
        const unified = mapScraplingJobsToUnified(jobs, 'freelancer' as any);
        allProjects.push(...unified);
      }
    } catch (err: any) {
      console.warn(`[Reddit Scraper] Failed to fetch r/${subreddit}:`, err.message);
    }
  }

  return allProjects;
}
