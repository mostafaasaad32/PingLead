// ==============================================================================
// src/lib/scrapers/index.ts
// Aggregator Orchestrator: 9 Core Platforms & 14 Full Categories (Vollna Engine)
// Coordinates 100% freelance client projects across 9 Arabic & Global platforms:
//   5 Arab: Mostaql, Nafezly, Khamsat, Kafiil, Baeed
//   4 Global: Freelancer, RemoteOK, PPH, WWR
// Zero Social Media - Zero AI Filter Costs ($0 Cost) - 100% Stability
// ==============================================================================

import { UnifiedProject, FreelancePlatform, PROJECT_INSIGHT_KEYS, buildPostText } from './types';
import { classifyProjectCategory } from '../filters/categorizer';
import { scrapeMostaqlCategory, fetchMostaqlProjectDetails } from './mostaql';
import { scrapeNafezlyCategory } from './nafezly';
import { scrapeKhamsatCategory } from './khamsat';
import { scrapeKafiilCategory } from './kafiil';
import { scrapeBaeedCategory } from './baeed';

import { scrapeFreelancerCategory } from './freelancer';
import { scrapeRemoteOkCategory } from './remoteok';
import { scrapePphCategory } from './pph';
import { scrapeWwrCategory } from './wwr';

import { supabaseAdmin } from '../supabase/admin';

export * from './types';
export * from './mostaql';
export * from './nafezly';
export * from './khamsat';
export * from './kafiil';
export * from './baeed';

export * from './freelancer';
export * from './remoteok';
export * from './pph';
export * from './wwr';

const BUDGET_KEYS = ['budget', 'budget_min', 'budget_max', 'currency', 'budget_usd_estimate'] as const;

// Flipped to false when the database doesn't have migration 0010's columns yet
let insightColumnsAvailable = true;

// Mostaql project pages read per cycle (each is one extra request to mostaql.com)
const MAX_DETAIL_FETCHES_PER_CYCLE = 8;
const DETAIL_FETCH_CONCURRENCY = 4;

function isMissingColumnError(err: { message?: string; code?: string }): boolean {
  return err.code === '42703' || err.code === 'PGRST204' || /column/i.test(err.message || '');
}

/**
 * 1. Carries forward insights (and the full description) saved by earlier cycles,
 *    so a listing scrape never wipes them.
 * 2. Reads the project page for Mostaql projects that were never enriched.
 * Mutates the projects in place so matching and Telegram alerts see the enriched data.
 */
async function mergeAndEnrichInsights(projects: UnifiedProject[]): Promise<void> {
  if (!insightColumnsAvailable || projects.length === 0) return;

  const existing = new Map<string, Record<string, any>>();
  const byPlatform = new Map<string, string[]>();
  for (const p of projects) {
    byPlatform.set(p.platform, [...(byPlatform.get(p.platform) || []), p.external_id]);
  }

  const lookups = await Promise.all(
    Array.from(byPlatform.entries()).map(async ([platform, ids]) => {
      const { data, error } = await (supabaseAdmin.from('projects') as any)
        .select(['external_id', 'description', ...BUDGET_KEYS, ...PROJECT_INSIGHT_KEYS].join(','))
        .eq('platform', platform)
        .in('external_id', ids);
      return { platform, data, error };
    })
  );

  for (const { platform, data, error } of lookups) {
    if (error) {
      if (isMissingColumnError(error)) {
        insightColumnsAvailable = false;
        console.warn('[Aggregator] Insight columns missing - apply migration 0010.');
        return;
      }
      continue;
    }
    for (const row of data || []) existing.set(`${platform}_${row.external_id}`, row);
  }

  // Carry forward: fresh listing values win, stored values fill the gaps
  for (const p of projects) {
    const prev = existing.get(`${p.platform}_${p.external_id}`);
    if (!prev) continue;
    for (const key of PROJECT_INSIGHT_KEYS) {
      if (p[key] == null && prev[key] != null) (p as any)[key] = prev[key];
    }
    if (prev.details_fetched_at && prev.description && prev.description.length > (p.description || '').length) {
      p.description = prev.description;
    }
    // Mostaql budgets come from the project page, not the listing - keep the stored ones.
    // (Other platforms' listings carry their own budget, so an empty one there is real.)
    if (p.platform === 'mostaql' && p.budget_max == null && prev.budget_max != null) {
      for (const key of BUDGET_KEYS) (p as any)[key] = prev[key];
    }
  }

  // Read Mostaql pages that were never enriched (or were enriched before budgets were read), newest first
  const pending = projects
    .filter((p) => p.platform === 'mostaql' && (!p.details_fetched_at || p.budget_max == null))
    .sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''))
    .slice(0, MAX_DETAIL_FETCHES_PER_CYCLE);

  for (let i = 0; i < pending.length; i += DETAIL_FETCH_CONCURRENCY) {
    const batch = pending.slice(i, i + DETAIL_FETCH_CONCURRENCY);
    const details = await Promise.all(batch.map((p) => fetchMostaqlProjectDetails(p.url)));
    batch.forEach((p, idx) => {
      const d = details[idx];
      if (!d) return;
      const { description, budget_min, budget_max, platform_category, ...insights } = d;
      Object.assign(p, insights);
      if (description && description.length > (p.description || '').length) p.description = description;
      // Re-classify with the full description, using Mostaql's own category when the text is vague
      if (platform_category) {
        p.category = classifyProjectCategory(`${p.title} ${p.description}`, platform_category);
        p.category_slug = p.category;
      }
      // The project page's budget range is authoritative
      if (budget_max) {
        p.budget_min = budget_min ?? budget_max;
        p.budget_max = budget_max;
        p.currency = 'USD';
        p.budget = p.budget_min !== budget_max ? `${p.budget_min} - ${budget_max} USD` : `${budget_max} USD`;
        p.budget_usd_estimate = budget_max;
      }
    });
  }

  // The leads_pool text (dashboard) embeds budget + description: rebuild it from the merged values
  for (const p of projects) {
    p.post_text = buildPostText(p.platform, p.title, p.budget, p.description);
  }
}

export interface IngestionCategoryConfig {
  slug: string;
  name_ar: string;
  reddit_subreddits?: string[];
  boolean_query_ar?: string;
  boolean_query_en?: string;
}

export interface IngestionStats {
  categorySlug: string;
  totalFetched: number;
  droppedByFilter: number;
  survivingPending: number;
  insertedIntoDb: number;
  platformBreakdown: Record<string, number>;
  projects: UnifiedProject[];
}

/**
 * Scrapes all 9 platforms or a specific batch with strict timeouts and error isolation
 */
export async function scrapeAllPlatforms(
  categorySlug: string = 'web_mobile_dev',
  batch: 'all' | 'arab' | 'global' = 'all'
): Promise<UnifiedProject[]> {
  const promises: Promise<UnifiedProject[]>[] = [];
  // 'all' reads each platform's newest page across every category, so take the whole page
  const everything = categorySlug === 'all';

  // 1. Arab Platforms (5)
  if (batch === 'all' || batch === 'arab') {
    promises.push(
      scrapeMostaqlCategory(categorySlug, everything ? 25 : 20),
      scrapeNafezlyCategory(categorySlug, everything ? 30 : 20),
      scrapeKhamsatCategory(categorySlug, everything ? 40 : 15),
      scrapeKafiilCategory(categorySlug, everything ? 20 : 15),
      scrapeBaeedCategory(categorySlug, everything ? 20 : 15)
    );
  }

  // 2. Global Platforms (4)
  if (batch === 'all' || batch === 'global') {
    promises.push(
      scrapeFreelancerCategory(categorySlug, everything ? 50 : 20),
      scrapeRemoteOkCategory(categorySlug, everything ? 30 : 20),
      scrapeWwrCategory(categorySlug, everything ? 30 : 20),
      scrapePphCategory(categorySlug, 20)
    );
  }

  const results = await Promise.allSettled(promises);
  const collected: UnifiedProject[] = [];

  for (const res of results) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      collected.push(...res.value);
    }
  }

  return collected;
}

/**
 * Runs the Multi-Platform Aggregator for a given category:
 * 1. Concurrently scrapes platforms via Promise.allSettled
 * 2. Deduplicates by (platform, external_id)
 * 3. Upserts projects into Supabase `projects` table & `leads_pool`
 */
export async function ingestCategoryPosts(
  category: IngestionCategoryConfig
): Promise<IngestionStats> {
  const startTime = Date.now();

  const rawProjects = await scrapeAllPlatforms(category.slug, 'all');

  const platformBreakdown: Record<string, number> = {};
  for (const p of rawProjects) {
    platformBreakdown[p.platform] = (platformBreakdown[p.platform] || 0) + 1;
  }

  // Filter out corrupted/empty projects (< 8 characters)
  const survivingProjects = rawProjects.filter((p) => {
    const textLen = (p.title || '').trim().length + (p.description || '').trim().length;
    return textLen >= 8 && !!p.url;
  });
  const droppedCount = rawProjects.length - survivingProjects.length;

  let insertedCount = 0;

  if (survivingProjects.length > 0) {
    // Deduplicate in memory by (platform, external_id)
    const dedupProjectMap = new Map<string, UnifiedProject>();
    for (const p of survivingProjects) {
      const key = `${p.platform}_${p.external_id}`;
      if (!dedupProjectMap.has(key)) {
        dedupProjectMap.set(key, p);
      }
    }
    const deduplicatedProjects = Array.from(dedupProjectMap.values());

    // 2B. Competition & client signals: keep what earlier cycles stored, read new Mostaql pages
    await mergeAndEnrichInsights(deduplicatedProjects);

    // 3A. Persist into the Vollna Architecture `projects` table
    try {
      const projectsPayload = deduplicatedProjects.map((p) => {
        const row: Record<string, any> = {
          external_id: p.external_id,
          platform: p.platform,
          title: p.title,
          description: p.description,
          url: p.url,
          budget: p.budget,
          budget_min: p.budget_min || null,
          budget_max: p.budget_max || null,
          currency: p.currency || 'USD',
          budget_usd_estimate: p.budget_usd_estimate || null,
          category: p.category,
          language: p.language || 'ar',
          author: p.author || 'صاحب عمل',
          published_at: p.published_at || new Date().toISOString(),
        };
        if (insightColumnsAvailable) {
          for (const key of PROJECT_INSIGHT_KEYS) row[key] = p[key] ?? null;
        }
        return row;
      });

      let { data: projData, error: projError } = await (supabaseAdmin
        .from('projects') as any)
        .upsert(projectsPayload, {
          onConflict: 'platform,external_id',
          ignoreDuplicates: false,
        })
        .select('id');

      // Migration 0010 not applied yet: save without the insight columns
      if (projError && insightColumnsAvailable && isMissingColumnError(projError)) {
        insightColumnsAvailable = false;
        console.warn('[Aggregator] Insight columns missing - apply migration 0010. Saving projects without them.');
        for (const row of projectsPayload) {
          for (const key of PROJECT_INSIGHT_KEYS) delete row[key];
        }
        ({ data: projData, error: projError } = await (supabaseAdmin
          .from('projects') as any)
          .upsert(projectsPayload, { onConflict: 'platform,external_id', ignoreDuplicates: false })
          .select('id'));
      }

      if (!projError && projData) {
        insertedCount = projData.length;
      } else if (projError) {
        console.warn('[Aggregator] Note on projects upsert:', projError.message);
      }
    } catch (err: any) {
      console.warn('[Aggregator] projects table insert skipped:', err.message);
    }

    // 3B. Persist into `leads_pool` table for backward compatibility
    try {
      const leadsPayload = deduplicatedProjects.map((p) => ({
        platform: p.platform,
        external_post_id: p.external_post_id || `${p.platform}_${p.external_id}`,
        author_handle: p.author_handle || p.author || 'صاحب مشروع',
        post_text: p.post_text,
        post_url: p.post_url || p.url,
        category_slug: p.category_slug || p.category,
        intent_score: 10,
        is_buyer: true,
        ai_reason_short: `[${p.platform.toUpperCase()}] مشروع معتمد من صاحب العمل مباشرة${p.budget ? ` بميزانية ${p.budget}` : ''}`,
        status: 'scored',
        published_at: p.published_at,
      }));

      const dedupLeadMap = new Map<string, typeof leadsPayload[0]>();
      for (const r of leadsPayload) {
        dedupLeadMap.set(`${r.platform}_${r.external_post_id}`, r);
      }
      const deduplicatedLeads = Array.from(dedupLeadMap.values());

      const { data: leadData } = await (supabaseAdmin
        .from('leads_pool') as any)
        .upsert(deduplicatedLeads, {
          onConflict: 'platform,external_post_id',
          ignoreDuplicates: false,
        })
        .select('id');

      if (insertedCount === 0 && leadData) {
        insertedCount = leadData.length;
      }
    } catch (err: any) {
      console.warn('[Aggregator] leads_pool insert notice:', err.message);
    }
  }

  console.log(
    `[Aggregator] Cycle complete for #${category.slug} in ${Date.now() - startTime}ms. Fetched: ${rawProjects.length}, Valid: ${survivingProjects.length}, Upserted: ${insertedCount}`
  );

  return {
    categorySlug: category.slug,
    totalFetched: rawProjects.length,
    droppedByFilter: droppedCount,
    survivingPending: survivingProjects.length,
    insertedIntoDb: insertedCount,
    platformBreakdown,
    projects: survivingProjects,
  };
}
