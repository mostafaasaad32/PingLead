// ==============================================================================
// src/app/api/leads/route.ts
// Secure API endpoint for fetching scored leads for the Dashboard
// Bypasses RLS using supabaseAdmin so leads are instantly visible for all users
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PLATFORMS_METADATA, PROJECT_INSIGHT_KEYS } from '@/lib/scrapers/types';
import { triggerIngest, pageLoadTriggersEnabled } from '@/lib/cron/trigger';
import { getRates } from '@/lib/currency/rates';
import { getProjectPricing } from '@/lib/insights/pricing';

const ALL_PLATFORM_IDS = PLATFORMS_METADATA.map((p) => p.id);

export const dynamic = 'force-dynamic';

/**
 * Adds competition & client signals, the EGP budget and a suggested bid from `projects` to each lead.
 * leads_pool.external_post_id is "<platform>_<external_id>" (see createUnifiedProject).
 * Returns leads unchanged if the insight columns don't exist yet (migration 0010).
 */
async function attachProjectInsights(leads: any[]): Promise<any[]> {
  const idsByPlatform = new Map<string, string[]>();
  for (const lead of leads) {
    const prefix = `${lead.platform}_`;
    if (!lead.external_post_id?.startsWith(prefix)) continue;
    const externalId = lead.external_post_id.slice(prefix.length);
    idsByPlatform.set(lead.platform, [...(idsByPlatform.get(lead.platform) || []), externalId]);
  }

  const PRICING_KEYS = ['budget_min', 'budget_max', 'currency', 'category'];
  const rowsByKey = new Map<string, Record<string, any>>();
  await Promise.all(
    Array.from(idsByPlatform.entries()).map(async ([platform, ids]) => {
      const { data, error } = await (supabaseAdmin.from('projects') as any)
        .select(['id', 'external_id', ...PRICING_KEYS, ...PROJECT_INSIGHT_KEYS].join(','))
        .eq('platform', platform)
        .in('external_id', ids);
      if (!error) {
        for (const row of data || []) rowsByKey.set(`${platform}_${row.external_id}`, row);
      }
    })
  );

  const rates = await getRates();

  return Promise.all(
    leads.map(async (lead) => {
      const row = rowsByKey.get(lead.external_post_id);
      if (!row) return { ...lead, project_id: null, insights: null, pricing: null };

      const { id: project_id, external_id, budget_min, budget_max, currency, category, ...insights } = row;
      const pricing = await getProjectPricing(
        {
          platform: lead.platform,
          category,
          budget_min,
          budget_max,
          currency,
          bids_count: insights.bids_count,
          bids_avg: insights.bids_avg,
          duration_text: insights.duration_text,
        },
        rates
      ).catch(() => null);

      return { ...lead, project_id, insights, pricing };
    })
  );
}

export async function GET(req: NextRequest) {
  try {
    // Signed-in users only: this reads with the service key and returns the whole project feed
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'غير مصرح - يرجى تسجيل الدخول' }, { status: 401 });
    }

    const category = req.nextUrl.searchParams.get('category');
    const platform = req.nextUrl.searchParams.get('platform');
    const minScore = req.nextUrl.searchParams.get('min_score');
    const sortBy = req.nextUrl.searchParams.get('sort_by') || 'newest';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '60', 10);

    let query = supabaseAdmin
      .from('leads_pool')
      .select('*')
      .in('status', ['scored', 'dispatched', 'pending']);

    // Sort by publication date (newest first) by default
    if (sortBy === 'score') {
      query = query
        .order('intent_score', { ascending: false, nullsFirst: false })
        .order('published_at', { ascending: false, nullsFirst: false });
    } else {
      query = query
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    }

    query = query.limit(limit);

    if (category && category !== 'all') {
      const categoryAliases: Record<string, string[]> = {
        web_mobile_dev: ['web_mobile_dev', 'web_dev'],
        web_dev: ['web_mobile_dev', 'web_dev'],
        ui_ux_graphic: ['ui_ux_graphic', 'ui_ux', 'design'],
        ui_ux: ['ui_ux_graphic', 'ui_ux', 'design'],
        design: ['ui_ux_graphic', 'ui_ux', 'design'],
        digital_marketing_seo: ['digital_marketing_seo', 'marketing'],
        marketing: ['digital_marketing_seo', 'marketing'],
        business_accounting_legal: ['business_accounting_legal', 'accounting', 'business'],
        accounting: ['business_accounting_legal', 'accounting', 'business'],
        business: ['business_accounting_legal', 'accounting', 'business'],
        writing_translation: ['writing_translation', 'writing'],
        writing: ['writing_translation', 'writing'],
        sales_customer_support: ['sales_customer_support', 'support'],
        support: ['sales_customer_support', 'support'],
        ecommerce_stores: ['ecommerce_stores'],
        ai_data_automation: ['ai_data_automation'],
        video_audio_motion: ['video_audio_motion'],
        engineering_architecture: ['engineering_architecture'],
        it_cybersecurity_devops: ['it_cybersecurity_devops'],
        education_training: ['education_training'],
        game_ar_vr: ['game_ar_vr'],
        other: ['other'],
      };
      const validCategories = categoryAliases[category] || [category];
      query = query.in('category_slug', validCategories);
    }
    if (platform && platform !== 'all') {
      query = query.eq('platform', platform);
    } else {
      query = query.in('platform', ALL_PLATFORM_IDS);
    }
    if (minScore) {
      query = query.gte('intent_score', parseInt(minScore, 10));
    }

    const { data: leads, error } = await query;

    if (error) {
      console.error('[API Leads] Database error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Run insights attachment and overall count queries concurrently in parallel
    const [leadsWithInsights, totalScannedRes, highIntentRes] = await Promise.all([
      attachProjectInsights(leads || []),
      supabaseAdmin
        .from('leads_pool')
        .select('*', { count: 'exact', head: true })
        .in('platform', ALL_PLATFORM_IDS),
      supabaseAdmin
        .from('leads_pool')
        .select('*', { count: 'exact', head: true })
        .in('platform', ALL_PLATFORM_IDS)
        .gte('intent_score', 8),
    ]);

    return NextResponse.json({
      ok: true,
      leads: leadsWithInsights,
      totalScanned: totalScannedRes.count || 0,
      highIntentCount: highIntentRes.count || 0,
    });
  } catch (err: any) {
    console.error('[API Leads] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
