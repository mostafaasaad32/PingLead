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
import { UnifiedProject, UserFilter } from '@/lib/scrapers/types';
import { batchMatchProjects } from '@/lib/matching/filter-matcher';
import { sendSmartFilterTelegramAlert, dispatchLeadToSubscribers } from '@/lib/telegram/dispatcher';
import { evaluateProjectForAutoBidding } from '@/lib/auto-bidder/engine';
import { getProjectPricing, type ProjectPricing } from '@/lib/insights/pricing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max execution time for serverless/Edge

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

    if (matchMap.size > 0) {
      for (const [_, item] of matchMap.entries()) {
        const project = item.project;

        // Retrieve the DB project id (or fallback to leads_pool id)
        let dbProjectId: string | null = null;
        const { data: existingProj } = await supabaseAdmin
          .from('projects')
          .select('id')
          .eq('platform', project.platform)
          .eq('external_id', project.external_id)
          .maybeSingle();

        if (existingProj?.id) {
          dbProjectId = existingProj.id;
        } else {
          const { data: existingLead } = await supabaseAdmin
            .from('leads_pool')
            .select('id')
            .eq('platform', project.platform)
            .eq('external_post_id', project.external_post_id || `${project.platform}_${project.external_id}`)
            .maybeSingle();
          if (existingLead?.id) dbProjectId = existingLead.id;
        }

        if (!dbProjectId) continue;

        // EGP equivalent + suggested bid, computed lazily once per project (only if an alert goes out)
        let pricing: ProjectPricing | null | undefined;
        const getPricing = async () => {
          if (pricing === undefined) {
            pricing = await getProjectPricing({
              platform: project.platform,
              category: project.category,
              budget_min: project.budget_min,
              budget_max: project.budget_max,
              currency: project.currency,
              bids_count: project.bids_count,
              bids_avg: project.bids_avg,
              duration_text: project.duration_text,
            }).catch(() => null);
          }
          return pricing;
        };

        for (const match of item.matches) {
          matchesFound++;

          // Check if an action already exists in user_project_actions
          const { data: existingAction } = await supabaseAdmin
            .from('user_project_actions')
            .select('id')
            .eq('user_id', match.userId)
            .eq('project_id', dbProjectId)
            .maybeSingle();

          let actionId = existingAction?.id;
          let isNewAction = false;

          if (!actionId) {
            const { data: newAction, error: actionError } = await supabaseAdmin
              .from('user_project_actions')
              .insert({
                user_id: match.userId,
                project_id: dbProjectId,
                status: 'saved',
                matched_filter_id: match.filterId,
              })
              .select('id')
              .single();

            if (!actionError && newAction) {
              actionId = newAction.id;
              isNewAction = true;
              actionsCreated++;
            }
          }

          // Dispatch Smart Telegram Alert only the first time this user matches this project;
          // scrapers return the same listings every cycle, so existing actions were already alerted.
          const targetFilter = activeFilters.find((f) => f.id === match.filterId);
          const chatId = userTelegramMap.get(match.userId);

          if (actionId && isNewAction && targetFilter?.notify_telegram && chatId) {
            const sent = await sendSmartFilterTelegramAlert(
              chatId,
              {
                title: project.title,
                description: project.description,
                url: project.url,
                platform: project.platform,
                category: project.category,
                budget: project.budget,
                budget_usd_estimate: project.budget_usd_estimate,
                currency: project.currency,
                pricing: await getPricing(),
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
              actionId
            );

            if (sent) smartTelegramDispatched++;
          }
        }

        // 6b. Evaluate project for Auto-Bidding engine
        evaluateProjectForAutoBidding({
          id: dbProjectId,
          title: project.title,
          description: project.description,
          platform: project.platform,
          url: project.url,
          category: project.category,
        }).catch((err) => console.error('[AutoBidder Ingest Hook Error]:', err));
      }
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
      legacyDispatched,
      // Counts only: the scraped projects themselves made the response too large for cron services
      ingestionStats: ingestionStats.map(({ projects, ...stats }) => stats),
    });
  } catch (err: any) {
    console.error('[Cron Ingest] Pipeline failure:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
