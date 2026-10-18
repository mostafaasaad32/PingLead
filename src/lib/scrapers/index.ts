// ==============================================================================
// src/lib/scrapers/index.ts
// Aggregator Orchestrator: 9 Core Platforms & 14 Full Categories (Vollna Engine)
// Coordinates 100% freelance client projects across 9 Arabic & Global platforms:
//   5 Arab: Mostaql, Nafezly, Khamsat, Kafiil, Baeed
//   4 Global: Freelancer, RemoteOK, PPH, WWR
// Zero Social Media - Zero AI Filter Costs ($0 Cost) - 100% Stability
// ==============================================================================

import { UnifiedProject, FreelancePlatform } from './types';
import { scrapeMostaqlCategory } from './mostaql';
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

  // 1. Arab Platforms (5)
  if (batch === 'all' || batch === 'arab') {
    promises.push(
      scrapeMostaqlCategory(categorySlug, 20),
      scrapeNafezlyCategory(categorySlug, 20),
      scrapeKhamsatCategory(categorySlug, 15),
      scrapeKafiilCategory(categorySlug, 15),
      scrapeBaeedCategory(categorySlug, 15)
    );
  }

  // 2. Global Platforms (4)
  if (batch === 'all' || batch === 'global') {
    promises.push(
      scrapeFreelancerCategory(categorySlug, 20),
      scrapeRemoteOkCategory(categorySlug, 20),
      scrapeWwrCategory(categorySlug, 20),
      scrapePphCategory(categorySlug, 15)
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

    // 3A. Persist into the Vollna Architecture `projects` table
    try {
      const projectsPayload = deduplicatedProjects.map((p) => ({
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
      }));

      const { data: projData, error: projError } = await (supabaseAdmin
        .from('projects') as any)
        .upsert(projectsPayload, {
          onConflict: 'platform,external_id',
          ignoreDuplicates: false,
        })
        .select('id');

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
