// ==============================================================================
// src/lib/scrapers/upwork.ts
// Upwork Public Jobs Scraper Engine via Scrapling Sidecar
// Bypasses Cloudflare Turnstile & anti-bot protection using StealthyFetcher
// ==============================================================================

import { UnifiedProject } from './types';
import { fetchFromScrapling, mapScraplingJobsToUnified } from './scrapling-bridge';

const CATEGORY_SEARCH_QUERIES: Record<string, string> = {
  web_mobile_dev: 'web development OR mobile app',
  ai_data_automation: 'ai OR python OR automation OR n8n',
  ui_ux_graphic: 'ui ux design OR graphic design',
  video_audio_motion: 'video editing OR motion graphics',
  digital_marketing_seo: 'digital marketing OR seo',
  writing_translation: 'content writing OR translation',
  business_accounting_legal: 'accounting OR business plan',
  sales_customer_support: 'customer support OR virtual assistant',
  it_cybersecurity_devops: 'devops OR cybersecurity OR cloud',
  ecommerce_stores: 'shopify OR ecommerce',
  other: 'freelance',
};

export async function scrapeUpworkCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 20
): Promise<UnifiedProject[]> {
  const query = CATEGORY_SEARCH_QUERIES[categorySlug] || 'software development';

  try {
    const jobs = await fetchFromScrapling('upwork', { query, limit });
    if (!jobs || jobs.length === 0) {
      return [];
    }
    return mapScraplingJobsToUnified(jobs, 'upwork');
  } catch (error: any) {
    console.warn('[Upwork Scraper] Failed to fetch Upwork jobs from sidecar:', error.message);
    return [];
  }
}
