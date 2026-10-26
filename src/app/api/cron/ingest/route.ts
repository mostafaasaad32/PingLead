// ==============================================================================
// src/app/api/cron/ingest/route.ts
// Phase 3: Cron Ingestion & Smart Filtering Pipeline (Vollna Architecture)
// Runs every 1-3 minutes:
// 1. Concurrently scrapes all 9 Arabic & Global Freelance Platforms ($0 API Cost)
// 2. Stores projects in `projects` (and `leads_pool` for backwards compatibility)
// 3. Evaluates active `user_filters` using the in-memory smart matching engine:
//    - Platforms check
//    - Categories check
//    - Minimum USD budget check
//    - Include keywords check (Arabic normalized & diacritic-insensitive)
//    - Exclude keywords check (Instant negative rejection)
// 4. Queues matching records in `user_project_actions` (Mini-CRM)
// 5. Dispatches Vollna-style interactive Telegram alerts with proposal action buttons
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ingestCategoryPosts } from '@/lib/scrapers';
import { PLATFORMS_METADATA, UnifiedProject, UserFilter } from '@/lib/scrapers/types';
import { getPushSubscriptions, projectPushPayload, sendPushToSubscriptions } from '@/lib/notifications/web-push';
import { detectScam } from '@/lib/filters/scam-detector';
import { batchMatchProjects } from '@/lib/matching/filter-matcher';
import { sendSmartFilterTelegramAlert, dispatchLeadToSubscribers } from '@/lib/telegram/dispatcher';
import { evaluateProjectForAutoBidding } from '@/lib/auto-bidder/engine';
import { getProjectPricing, type ProjectPricing } from '@/lib/insights/pricing';
import { performProjectRetentionCleanup } from '@/lib/cleanup/retention';
import {
  DEFAULT_AI_MIN_SCORE,
  qualifyProjects,
  releaseEvaluations,
  reserveEvaluations,
  type QualifierResult,
} from '@/lib/ai/project-qualifier';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max execution time for serverless/Edge

// The auto-bidding queue page was removed (it redirects to the dashboard), so queued projects
// can't be acted on and its Telegram message would point to a dead page. Every match already
// gets a regular alert with an AI-proposal button. Re-enable together with a queue UI.
const AUTO_BIDDING_ENABLED = false;

// Max time the AI qualifier may hold up a cycle's alerts
const QUALIFIER_BUDGET_MS = 6000;

// Projects published longer ago than this never trigger a Telegram alert
const ALERT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/** Runs fn over items with at most `limit` in flight; results keep input order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]).catch(() => undefined as unknown as R);
    }
  });
  await Promise.all(workers);
  return results;
}

interface QualifierJob {
  action: { id: string; user_id: string; project_id: string };
  item: { project: UnifiedProject };
  match: { userId: string; filterId: string };
}

interface ActionAiResult {
  result: QualifierResult | null;
  quotaExhausted: boolean;
}

/**
 * Scores this cycle's new matches whose filter has AI criteria, one Gemini batch per
 * (filter, 10 projects), all in parallel. Saves ai_score/ai_reason on the CRM rows.
 * Projects over the user's monthly quota, or whose AI call failed, stay unscored.
 */
async function qualifyNewMatches(jobs: QualifierJob[], filters: UserFilter[]): Promise<Map<string, ActionAiResult>> {
  const out = new Map<string, ActionAiResult>();
  const byFilter = new Map<string, QualifierJob[]>();
  for (const job of jobs) {
    const filter = filters.find((f) => f.id === job.match.filterId);
    if (!filter?.ai_criteria) continue;
    byFilter.set(filter.id, [...(byFilter.get(filter.id) || []), job]);
  }
  if (byFilter.size === 0) return out;

  // Skills give the model context for criteria like "مناسب لمهاراتي"
  const userIds = Array.from(new Set(Array.from(byFilter.values()).flat().map((j) => j.match.userId)));
  const { data: profileRows } = await (supabaseAdmin.from('freelancer_profiles') as any)
    .select('user_id, skills')
    .in('user_id', userIds);
  const skillsByUser = new Map<string, string[]>((profileRows || []).map((p: any) => [p.user_id, p.skills || []]));

  await Promise.all(
    Array.from(byFilter.entries()).map(async ([filterId, group]) => {
      const filter = filters.find((f) => f.id === filterId)!;
      const userId = filter.user_id;
      const granted = await reserveEvaluations(userId, group.length).catch(() => 0);
      const scored = group.slice(0, granted);
      for (const job of group.slice(granted)) out.set(job.action.id, { result: null, quotaExhausted: true });
      if (!scored.length) return;

      const { results, failed } = await qualifyProjects(
        filter.ai_criteria!,
        scored.map((j) => ({
          title: j.item.project.title,
          description: j.item.project.description,
          platform: j.item.project.platform,
          budget: j.item.project.budget,
          budget_usd: j.item.project.budget_usd_estimate,
        })),
        skillsByUser.get(userId),
        // Alerts wait for the scores: unscored projects (slow AI) still alert, just without a score
        QUALIFIER_BUDGET_MS
      );
      // Failed calls and projects the model skipped don't count against the quota
      const unscored = results.filter((r) => !r).length;
      if (unscored > 0) await releaseEvaluations(userId, unscored).catch(() => {});
      if (failed) console.warn(`[Cron Ingest] AI qualifier: ${failed} projects unscored for filter ${filterId}`);

      scored.forEach((job, i) => out.set(job.action.id, { result: results[i], quotaExhausted: false }));
    })
  );

  // Persist scores (dashboard shows them, including below-threshold matches that got no alert)
  const toSave = Array.from(out.entries()).filter(([, v]) => v.result);
  await mapWithConcurrency(toSave, 10, ([actionId, v]) =>
    (supabaseAdmin.from('user_project_actions') as any)
      .update({ ai_score: v.result!.score, ai_reason: v.result!.reason })
      .eq('id', actionId)
  );

  return out;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // 1. Authenticate Cron Trigger
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  const isAuthorized =
    process.env.NODE_ENV === 'development' ||
    (!!cronSecret && authHeader === `Bearer ${cronSecret}`);

  if (!isAuthorized) {
    return NextResponse.json({ error: 'Unauthorized: Invalid CRON_SECRET' }, { status: 401 });
  }

  try {
    // 2. Fetch all active categories from Supabase
    const { data: categories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('*')
      .eq('is_active', true);

    if (catError) {
      console.error('[Cron Ingest] Error fetching categories:', catError.message);
      return NextResponse.json({ error: catError.message }, { status: 500 });
    }

    const activeCategories =
      categories && categories.length > 0
        ? categories
        : [{ slug: 'web_dev', name_ar: 'تطوير البرمجيات والمواقع' }];

    const ingestionStats: any[] = [];
    const shouldScrape = req.nextUrl.searchParams.get('scrape') !== 'false';
    const allIngestedProjects: UnifiedProject[] = [];

    // 3. Ingest projects concurrently across categories
    if (shouldScrape) {
      // Each platform's newest-projects page across ALL categories, every cycle.
      // Page 1 covers hours of postings on every platform, so nothing is missed and
      // new projects alert within one cycle; projects are categorized locally.
      // ?category=<slug> still scrapes a single category (manual debugging).
      const targetCategorySlug = req.nextUrl.searchParams.get('category');
      const categoriesToScrape = targetCategorySlug
        ? activeCategories.filter((c) => c.slug === targetCategorySlug)
        : [{ slug: 'all', name_ar: 'كل التخصصات' }];

      const categoryPromises = categoriesToScrape.map((cat) => ingestCategoryPosts(cat));
      const categoryResults = await Promise.allSettled(categoryPromises);

      categoryResults.forEach((res, idx) => {
        if (res.status === 'fulfilled' && res.value) {
          ingestionStats.push(res.value);
          if (Array.isArray(res.value.projects)) {
            allIngestedProjects.push(...res.value.projects);
          }
        } else {
          console.warn(
            `[Cron Ingest] Failed ingestion for category ${categoriesToScrape[idx]?.slug || 'unknown'}:`,
            res.status === 'rejected' ? res.reason : 'Unknown'
          );
        }
      });
    }

    // 4. Fetch active user filters for Vollna Smart Matching
    const { data: rawFilters, error: filtersError } = await supabaseAdmin
      .from('user_filters')
      .select('*')
      .eq('is_active', true);

    const activeFilters: UserFilter[] = (rawFilters || []).map((f: any) => ({
      id: f.id,
      user_id: f.user_id,
      filter_name: f.filter_name,
      platforms: f.platforms || [],
      categories: f.categories || [],
      include_keywords: f.include_keywords || [],
      exclude_keywords: f.exclude_keywords || [],
      min_budget_usd: Number(f.min_budget_usd) || 0,
      is_active: f.is_active,
      notify_telegram: f.notify_telegram ?? true,
      max_bids: f.max_bids ?? null,
      min_client_hire_rate: f.min_client_hire_rate ?? null,
      exclude_new_clients: f.exclude_new_clients ?? false,
      job_type: f.job_type ?? 'any',
      client_countries: f.client_countries || [],
      ai_criteria: f.ai_criteria?.trim() || null,
      ai_min_score: f.ai_min_score ?? DEFAULT_AI_MIN_SCORE,
      created_at: f.created_at,
      updated_at: f.updated_at,
    }));

    // 5. Fetch Telegram Chat IDs for all users with active filters
    const filterUserIds = Array.from(new Set(activeFilters.map((f) => f.user_id)));
    const userTelegramMap = new Map<string, string>();

    if (filterUserIds.length > 0) {
      // Check freelancer_profiles first
      const { data: profiles } = await supabaseAdmin
        .from('freelancer_profiles')
        .select('user_id, telegram_chat_id')
        .in('user_id', filterUserIds)
        .not('telegram_chat_id', 'is', null);

      if (profiles) {
        for (const p of profiles) {
          if (p.telegram_chat_id) userTelegramMap.set(p.user_id, p.telegram_chat_id);
        }
      }

      // Fallback check in profiles table if not found in freelancer_profiles
      const missingUserIds = filterUserIds.filter((uid) => !userTelegramMap.has(uid));
      if (missingUserIds.length > 0) {
        const { data: legacyProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, telegram_chat_id')
          .in('id', missingUserIds)
          .not('telegram_chat_id', 'is', null);

        if (legacyProfiles) {
          for (const lp of legacyProfiles) {
            if (lp.telegram_chat_id) userTelegramMap.set(lp.id, lp.telegram_chat_id);
          }
        }
      }
    }

    // 6. Run In-Memory Smart Matching on all newly ingested projects
    const matchMap = batchMatchProjects(allIngestedProjects, activeFilters);

    let matchesFound = 0;
    let actionsCreated = 0;
    let smartTelegramDispatched = 0;
    let pushDispatched = 0;

    if (matchMap.size > 0) {
      const items = Array.from(matchMap.values());

      // 6a. Resolve DB project ids: one query per platform instead of one per project
      const projectIdByKey = new Map<string, string>();
      const idsByPlatform = new Map<string, string[]>();
      for (const { project } of items) {
        idsByPlatform.set(project.platform, [...(idsByPlatform.get(project.platform) || []), project.external_id]);
      }
      await Promise.all(
        Array.from(idsByPlatform.entries()).map(async ([platform, externalIds]) => {
          const { data } = await (supabaseAdmin.from('projects') as any)
            .select('id, external_id')
            .eq('platform', platform)
            .in('external_id', externalIds);
          for (const row of data || []) projectIdByKey.set(`${platform}_${row.external_id}`, row.id);
        })
      );

      // 6b. One new CRM row per (user, project). Bulk upsert with ignoreDuplicates returns only
      //     rows that didn't exist yet, so existing matches (already alerted) are skipped in one round trip.
      const candidates = new Map<string, { user_id: string; project_id: string; matched_filter_id: string }>();
      const matchByCandidate = new Map<string, { item: (typeof items)[number]; match: (typeof items)[number]['matches'][number] }>();
      for (const item of items) {
        const projectId = projectIdByKey.get(`${item.project.platform}_${item.project.external_id}`);
        if (!projectId) continue;
        for (const match of item.matches) {
          matchesFound++;
          const key = `${match.userId}_${projectId}`;
          if (candidates.has(key)) continue; // same user matched by two filters: alert once
          candidates.set(key, { user_id: match.userId, project_id: projectId, matched_filter_id: match.filterId });
          matchByCandidate.set(key, { item, match });
        }
      }

      const newActions: { id: string; user_id: string; project_id: string }[] = [];
      const rows = Array.from(candidates.values()).map((c) => ({ ...c, status: 'matched' }));
      for (let i = 0; i < rows.length; i += 500) {
        let { data, error } = await (supabaseAdmin.from('user_project_actions') as any)
          .upsert(rows.slice(i, i + 500), { onConflict: 'user_id,project_id', ignoreDuplicates: true })
          .select('id, user_id, project_id');
        if (error && (error as any).code === '23514') {
          // Check constraint fallback: tag as 'ignored' with auto_matched notes so it never masquerades as 'saved'
          const fallbackRows = rows.slice(i, i + 500).map((r) => ({ ...r, status: 'ignored', notes: 'auto_matched' }));
          const res = await (supabaseAdmin.from('user_project_actions') as any)
            .upsert(fallbackRows, { onConflict: 'user_id,project_id', ignoreDuplicates: true })
            .select('id, user_id, project_id');
          data = res.data;
          error = res.error;
        }
        if (error) console.warn('[Cron Ingest] CRM insert error:', (error as any).message);
        newActions.push(...(data || []));
      }
      actionsCreated = newActions.length;

      // 6c. Alerts for new matches only, 10 at a time
      const pricingByProject = new Map<string, Promise<ProjectPricing | null>>();
      const pricingFor = (project: UnifiedProject) => {
        const key = `${project.platform}_${project.external_id}`;
        if (!pricingByProject.has(key)) {
          pricingByProject.set(
            key,
            getProjectPricing({
              platform: project.platform,
              category: project.category,
              budget_min: project.budget_min,
              budget_max: project.budget_max,
              currency: project.currency,
              bids_count: project.bids_count,
              bids_avg: project.bids_avg,
              duration_text: project.duration_text,
            }).catch(() => null)
          );
        }
        return pricingByProject.get(key)!;
      };

      // 6c-0. AI qualifier: new matches of filters with criteria get a 0-100 score + reason
      const aiByAction = await qualifyNewMatches(
        newActions.map((action) => ({ action, ...matchByCandidate.get(`${action.user_id}_${action.project_id}`)! })),
        activeFilters
      );

      // Matches worth notifying about (any channel); Telegram and browser push each take their share
      const notifyJobs = newActions
        .map((action) => ({ action, ...matchByCandidate.get(`${action.user_id}_${action.project_id}`)! }))
        .filter(({ action, item, match }) => {
          const filter = activeFilters.find((f) => f.id === match.filterId);
          // A project still listed after retention cleanup deleted it comes back as "new": don't re-alert
          const publishedAt = new Date(item.project.published_at).getTime();
          if (publishedAt && Date.now() - publishedAt > ALERT_MAX_AGE_MS) return false;
          // Below the filter's AI threshold: kept in the dashboard with its score, no alert.
          // Unscored (AI failed / quota used up) still alerts, so no project is lost.
          const ai = aiByAction.get(action.id);
          if (ai?.result && ai.result.score < (filter?.ai_min_score ?? DEFAULT_AI_MIN_SCORE)) return false;
          // notify_telegram is the filter's "alerts on" switch for every channel
          return Boolean(filter?.notify_telegram);
        });
      const alertJobs = notifyJobs.filter(({ match }) => userTelegramMap.has(match.userId));

      const results = await mapWithConcurrency(alertJobs, 10, async ({ action, item, match }) => {
        const project = item.project;
        const ai = aiByAction.get(action.id);
        return sendSmartFilterTelegramAlert(
          userTelegramMap.get(match.userId)!,
          {
            ai_score: ai?.result?.score ?? null,
            ai_reason: ai?.result?.reason ?? null,
            ai_quota_exhausted: ai?.quotaExhausted ?? false,
            title: project.title,
            description: project.description,
            url: project.url,
            platform: project.platform,
            category: project.category,
            budget: project.budget,
            budget_usd_estimate: project.budget_usd_estimate,
            currency: project.currency,
            pricing: await pricingFor(project),
            source_created_at: project.published_at,
            bids_count: project.bids_count,
            bids_avg: project.bids_avg,
            client_hire_rate: project.client_hire_rate,
            client_open_projects: project.client_open_projects,
            client_in_progress: project.client_in_progress,
            client_registered_at: project.client_registered_at,
            client_country: project.client_country,
            duration_text: project.duration_text,
            details_fetched_at: project.details_fetched_at,
          },
          match.filterName,
          action.id
        );
      });
      smartTelegramDispatched = results.filter(Boolean).length;

      // 6c-2. Browser notifications (Web Push) for every device the user allowed
      const pushSubs = await getPushSubscriptions(Array.from(new Set(notifyJobs.map((j) => j.match.userId))));
      if (pushSubs.size) {
        const pushResults = await mapWithConcurrency(
          notifyJobs.filter((j) => pushSubs.has(j.match.userId)),
          10,
          ({ action, item, match }) =>
            sendPushToSubscriptions(
              pushSubs.get(match.userId)!,
              projectPushPayload({
                id: action.project_id,
                title: item.project.title,
                url: item.project.url,
                platformLabel: PLATFORMS_METADATA.find((p) => p.id === item.project.platform)?.label_ar || item.project.platform,
                budget: item.project.budget,
                aiScore: aiByAction.get(action.id)?.result?.score ?? null,
                scam: detectScam(item.project.title, item.project.description),
              })
            )
        );
        pushDispatched = pushResults.reduce((n, r) => n + (r || 0), 0);
      }

      // 6d. Auto-Bidding: only projects that are new matches this cycle
      // Awaited: on Vercel un-awaited work can be frozen as soon as the response is sent
      const newProjectIds = new Set(newActions.map((a) => a.project_id));
      const autoBidJobs: Promise<unknown>[] = [];
      for (const item of AUTO_BIDDING_ENABLED ? items : []) {
        const projectId = projectIdByKey.get(`${item.project.platform}_${item.project.external_id}`);
        if (!projectId || !newProjectIds.has(projectId)) continue;
        autoBidJobs.push(
          evaluateProjectForAutoBidding({
            id: projectId,
            title: item.project.title,
            description: item.project.description,
            platform: item.project.platform,
            url: item.project.url,
            category: item.project.category,
          }).catch((err) => console.error('[AutoBidder Ingest Hook Error]:', err))
        );
      }
      await Promise.all(autoBidJobs);
    }

    // 7. Fallback: If no custom user filters are configured yet, dispatch high-intent projects to global subscribers
    let legacyDispatched = 0;
    if (activeFilters.length === 0) {
      const { data: recentLeads } = await supabaseAdmin
        .from('leads_pool')
        .select('id, platform, post_text, post_url, category_slug, intent_score, ai_reason_short')
        .eq('status', 'scored')
        .eq('is_buyer', true)
        .gte('intent_score', 8)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentLeads && recentLeads.length > 0) {
        for (const lead of recentLeads) {
          const count = await dispatchLeadToSubscribers({
            id: lead.id,
            platform: lead.platform,
            post_text: lead.post_text,
            post_url: lead.post_url,
            category_slug: lead.category_slug || 'web_dev',
            intent_score: lead.intent_score ?? 10,
            ai_reason_short: lead.ai_reason_short || 'مشروع معتمد',
          });
          legacyDispatched += count;
        }
      }
    }

    // 72-hour retention cleanup, once an hour (the cron runs every minute). Awaited: serverless
    // functions can be frozen right after the response, killing un-awaited work.
    if (new Date().getUTCMinutes() === 0) {
      await performProjectRetentionCleanup(72).catch((cleanupErr) =>
        console.warn('[Cron Ingest] 72h cleanup warning:', cleanupErr.message)
      );
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      duration_ms: durationMs,
      categoriesCount: activeCategories.length,
      categoriesScraped: ingestionStats.map((s) => s.categorySlug),
      totalProjectsIngested: allIngestedProjects.length,
      activeFiltersCount: activeFilters.length,
      matchesFound,
      actionsCreated,
      smartTelegramDispatched,
      pushDispatched,
      legacyDispatched,
      // Counts only: the scraped projects themselves made the response too large for cron services
      ingestionStats: ingestionStats.map(({ projects, ...stats }) => stats),
    });
  } catch (err: any) {
    console.error('[Cron Ingest] Pipeline failure:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
