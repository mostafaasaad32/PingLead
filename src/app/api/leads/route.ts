// ==============================================================================
// src/app/api/leads/route.ts
// Secure API endpoint for fetching scored leads for the Dashboard
// Bypasses RLS using supabaseAdmin so leads are instantly visible for all users
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PLATFORMS_METADATA } from '@/lib/scrapers/types';

const ALL_PLATFORM_IDS = PLATFORMS_METADATA.map((p) => p.id);

export const dynamic = 'force-dynamic';

let lastAutoScrapeTimestamp = 0;
let isAutoScrapingActive = false;

export async function GET(req: NextRequest) {
  try {
    // Non-blocking auto-scrape: keeps database fresh every 60 seconds automatically
    const now = Date.now();
    if (now - lastAutoScrapeTimestamp > 60_000 && !isAutoScrapingActive) {
      lastAutoScrapeTimestamp = now;
      isAutoScrapingActive = true;
      (async () => {
        try {
          const port = process.env.PORT || 3000;
          const secret = process.env.CRON_SECRET || 'pinglead_cron_secret_secure_9921';
          await fetch(`http://localhost:${port}/api/cron/ingest?secret=${secret}&scrape=true`);
        } catch (e) {
          // ignore
        } finally {
          isAutoScrapingActive = false;
        }
      })();
    }

    const category = req.nextUrl.searchParams.get('category');
    const platform = req.nextUrl.searchParams.get('platform');
    const minScore = req.nextUrl.searchParams.get('min_score');
    const sortBy = req.nextUrl.searchParams.get('sort_by') || 'newest';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '100', 10);

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

    // Also get overall counts for freelance platforms
    const { count: totalScanned } = await supabaseAdmin
      .from('leads_pool')
      .select('*', { count: 'exact', head: true })
      .in('platform', ALL_PLATFORM_IDS);

    const { count: highIntentCount } = await supabaseAdmin
      .from('leads_pool')
      .select('*', { count: 'exact', head: true })
      .in('platform', ALL_PLATFORM_IDS)
      .gte('intent_score', 8);

    return NextResponse.json({
      ok: true,
      leads: leads || [],
      totalScanned: totalScanned || 0,
      highIntentCount: highIntentCount || 0,
    });
  } catch (err: any) {
    console.error('[API Leads] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
