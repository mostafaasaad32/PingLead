// ==============================================================================
// src/lib/scrapers/scrapling-bridge.ts
// PingLead Next.js to Python Scrapling Microservice Bridge (The Connector)
// Connects Next.js scrapers to the Python FastAPI sidecar powered by Scrapling
// to bypass Cloudflare and 403 bot blocks with 15s timeout and resilient fallback.
// ==============================================================================

import { UnifiedProject, createUnifiedProject, FreelancePlatform } from './types';
import { classifyProjectCategory } from '../filters/categorizer';

export const SCRAPLING_SERVICE_URL =
  process.env.SCRAPLING_SERVICE_URL || 'http://127.0.0.1:8000';

export interface ScraplingJob {
  id: string;
  platform: string;
  title: string;
  description: string;
  url: string;
  budget?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string | null;
  published_at?: string | null;
  client_hire_rate?: number | null;
  payment_verified?: boolean | null;
  total_spent?: string | null;
  bids_count?: number | null;
  client_country?: string | null;
  client_open_projects?: number | null;
  client_in_progress?: number | null;
  client_registered_at?: string | null;
  duration_text?: string | null;
  raw_data?: Record<string, any> | null;
}

/**
 * Check if the Python Scrapling microservice is running and healthy
 */
export async function isScraplingHealthy(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${SCRAPLING_SERVICE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Sends a scraping request to the Python Scrapling microservice.
 * Enforces a 15-second timeout and fails gracefully to [] without crashing.
 */
export async function fetchFromScrapling(
  platform: string,
  payload: Record<string, any> = {}
): Promise<ScraplingJob[]> {
  const endpoint = `${SCRAPLING_SERVICE_URL}/scrape/${platform.toLowerCase()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`[Scrapling Bridge] ${platform} returned HTTP ${res.status}: ${res.statusText}`);
      return [];
    }

    const data = (await res.json()) as ScraplingJob[];
    return Array.isArray(data) ? data : [];
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[Scrapling Bridge] Timeout (15s) while scraping ${platform} via sidecar.`);
    } else {
      console.warn(`[Scrapling Bridge] Failed to contact Scrapling sidecar for ${platform}:`, error.message);
    }
    return [];
  }
}

/**
 * Maps raw jobs returned by the Python microservice to unified PingLead projects
 */
export function mapScraplingJobsToUnified(
  jobs: ScraplingJob[],
  defaultPlatform: FreelancePlatform
): UnifiedProject[] {
  return jobs.map((job) => {
    const lang = /[\u0600-\u06FF]/.test(job.title + ' ' + job.description) ? 'ar' : 'en';
    const category = classifyProjectCategory(job.title, job.description);

    return createUnifiedProject({
      external_id: job.id,
      platform: (job.platform as FreelancePlatform) || defaultPlatform,
      title: job.title,
      description: job.description || job.title,
      url: job.url,
      budget: job.budget,
      budget_min: job.budget_min,
      budget_max: job.budget_max,
      currency: job.currency || (lang === 'ar' ? 'USD' : '$'),
      language: lang,
      category,
      published_at: job.published_at || new Date().toISOString(),
      author: job.raw_data?.author || (lang === 'ar' ? 'صاحب مشروع' : 'Client'),
      insights: {
        client_hire_rate: job.client_hire_rate,
        payment_verified: job.payment_verified,
        total_spent: job.total_spent,
        bids_count: job.bids_count,
        client_country: job.client_country,
        client_open_projects: job.client_open_projects,
        client_in_progress: job.client_in_progress,
        client_registered_at: job.client_registered_at,
        duration_text: job.duration_text,
        details_fetched_at: new Date().toISOString(),
      },
    });
  });
}
