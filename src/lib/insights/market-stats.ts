// ==============================================================================
// src/lib/insights/market-stats.ts
// Median budget (USD) of recent projects per platform + category, used as the
// "similar projects" anchor for price suggestions. Cached for an hour.
// Server-side only.
// ==============================================================================

import { supabaseAdmin } from '@/lib/supabase/admin';

const WINDOW_DAYS = 30;
const CACHE_MS = 60 * 60 * 1000;
const MIN_SAMPLES = 5;
const MAX_ROWS = 5000;

let cache: Map<string, number> | null = null;
let cachedAt = 0;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function loadStats(): Promise<Map<string, number>> {
  if (cache && Date.now() - cachedAt < CACHE_MS) return cache;

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await (supabaseAdmin.from('projects') as any)
    .select('platform, category, budget_usd_estimate')
    .gte('published_at', since)
    .not('budget_usd_estimate', 'is', null)
    .gt('budget_usd_estimate', 0)
    .limit(MAX_ROWS);

  const groups = new Map<string, number[]>();
  if (!error) {
    for (const row of data || []) {
      for (const key of [`${row.platform}|${row.category}`, `*|${row.category}`]) {
        groups.set(key, [...(groups.get(key) || []), Number(row.budget_usd_estimate)]);
      }
    }
  }

  const stats = new Map<string, number>();
  for (const [key, values] of groups) {
    if (values.length >= MIN_SAMPLES) stats.set(key, median(values));
  }

  cache = stats;
  cachedAt = Date.now();
  return stats;
}

/** Median budget for this platform + category, falling back to the category across platforms. */
export async function getMarketMedianUsd(platform: string, category: string): Promise<number | null> {
  const stats = await loadStats();
  return stats.get(`${platform}|${category}`) ?? stats.get(`*|${category}`) ?? null;
}
