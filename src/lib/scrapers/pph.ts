// ==============================================================================
// src/lib/scrapers/pph.ts
// Global Freelance Platform Scraper (PeoplePerHour)
// PPH's RSS feed now returns an HTML page, so this reads the job listing page's
// embedded state (window.PPHReact.initialState -> entities.projects), which carries
// the full job: description, budget, currency, posted date, proposal count, client.
// ==============================================================================

import { UnifiedProject, createUnifiedProject } from './types';
import { classifyProjectCategory } from '../filters/categorizer';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const BASE_URL = 'https://www.peopleperhour.com/freelance-jobs';

const CATEGORY_PATH: Record<string, string> = {
  web_mobile_dev: 'technology-programming',
  web_dev: 'technology-programming',
  ai_data_automation: 'technology-programming',
  it_cybersecurity_devops: 'technology-programming',
  game_ar_vr: 'technology-programming',
  ecommerce_stores: 'technology-programming',
  ui_ux_graphic: 'design',
  ui_ux: 'design',
  design: 'design',
  engineering_architecture: 'design',
  video_audio_motion: 'video-photography',
  digital_marketing_seo: 'marketing-branding-sales',
  marketing: 'marketing-branding-sales',
  writing_translation: 'writing-translation',
  writing: 'writing-translation',
  business_accounting_legal: 'business-support',
  accounting: 'business-support',
  sales_customer_support: 'business-support',
};

interface PphJob {
  proj_id: number;
  title: string;
  proj_desc?: string;
  budget?: number;
  currency?: string;
  project_type?: 'fixed_price' | 'hourly' | string;
  duration?: string | null;
  posted_dt?: string;
  url?: string;
  open?: boolean;
  proposalCount?: number;
  client?: { country?: string; reg_dt?: string; shortName?: string };
  category?: { cate_name?: string; slug?: string };
  sub_category?: { subcate_name?: string } | string;
}

/** Pulls the job objects out of the page's `window.PPHReact.initialState = {...};` script. */
function extractJobs(html: string): PphJob[] {
  const marker = 'window.PPHReact.initialState=';
  const start = html.indexOf(marker);
  if (start < 0) return [];
  const scriptEnd = html.indexOf('</script>', start);
  let json = html.slice(start + marker.length, scriptEnd);
  const statementEnd = json.search(/;\s*(window\.|$)/);
  if (statementEnd > 0) json = json.slice(0, statementEnd);

  try {
    const state = JSON.parse(json);
    const projects = state?.entities?.projects || {};
    return Object.values(projects)
      .map((p: any) => p?.attributes)
      .filter((j: any) => j && j.proj_id && j.title);
  } catch (err: any) {
    console.warn('[PPH Scraper] Could not parse page state:', err.message);
    return [];
  }
}

export async function scrapePphCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 20
): Promise<UnifiedProject[]> {
  const path = CATEGORY_PATH[categorySlug];
  const url = path ? `${BASE_URL}/${path}` : BASE_URL;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      console.warn(`[PPH Scraper] HTTP ${res.status} from ${url}`);
      return [];
    }

    const jobs = extractJobs(await res.text());
    const projects: UnifiedProject[] = [];

    for (const job of jobs) {
      if (projects.length >= limit) break;
      if (job.open === false) continue;

      const description = (job.proj_desc || job.title).replace(/<[^>]*>/g, '').replace(/\r/g, '').trim();
      const budget = job.budget && job.budget > 0 ? job.budget : null;
      const currency = job.currency || 'USD';
      const isHourly = job.project_type === 'hourly';

      projects.push(
        createUnifiedProject({
          external_id: String(job.proj_id),
          platform: 'pph',
          title: job.title,
          description,
          url: job.url || `${BASE_URL}/${job.proj_id}`,
          budget: budget ? `${budget} ${currency}${isHourly ? ' / ساعة' : ''}` : null,
          // Hourly rates aren't a project total; keep them out of the budget bounds
          budget_min: isHourly ? null : budget,
          budget_max: isHourly ? null : budget,
          currency,
          language: 'en',
          // PPH's own category ("Technology & Programming", ...) is the best hint
          category: classifyProjectCategory(`${job.title} ${description}`, job.category?.cate_name || categorySlug),
          // posted_dt is "YYYY-MM-DD HH:mm:ss" (UK time); treat as UTC
          published_at: job.posted_dt
            ? new Date(job.posted_dt.replace(' ', 'T') + 'Z').toISOString()
            : new Date().toISOString(),
          author: job.client?.shortName || 'PPH Client',
          insights: {
            job_type: isHourly ? 'hourly' : 'fixed',
            bids_count: typeof job.proposalCount === 'number' ? job.proposalCount : null,
            client_country: job.client?.country || null,
            client_registered_at: job.client?.reg_dt || null,
            duration_text: job.duration || null,
          },
        })
      );
    }

    console.log(`[PPH Scraper] Extracted ${projects.length} live jobs for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error('[PPH Scraper] Error:', err.message);
    return [];
  }
}
