// ==============================================================================
// src/app/api/projects/route.ts
// Direct Projects API for Vollna Split-Screen Filters & Instant Workspace
// Reads from 100% authentic multi-platform `projects` pool with instant search
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  // The project feed is the product: signed-in users only (same as /api/leads)
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || "200", 10) || 200));
    const platformsParam = searchParams.get("platforms");
    const categoriesParam = searchParams.get("categories");
    const minBudgetParam = searchParams.get("min_budget");
    const includeNoBudget = searchParams.get("include_no_budget") !== "false";
    const languageParam = searchParams.get("language");
    const timeRangeParam = searchParams.get("time_range");
    const searchParam = searchParams.get("search");

    let query: any = (supabaseAdmin
      .from("projects") as any)
      .select("*")
      .order("published_at", { ascending: false })
      .limit(limit);

    // 1. Platform filter
    if (platformsParam && platformsParam !== "all") {
      const platformList = platformsParam.split(",").map((p) => p.trim()).filter(Boolean);
      if (platformList.length > 0) {
        query = query.in("platform", platformList);
      }
    }

    // 2. Category filter
    if (categoriesParam && categoriesParam !== "all") {
      const rawCategories = categoriesParam.split(",").map((c) => c.trim()).filter(Boolean);
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

      const expandedCategories = new Set<string>();
      rawCategories.forEach((cat) => {
        const aliases = categoryAliases[cat] || [cat];
        aliases.forEach((a) => expandedCategories.add(a));
      });

      if (expandedCategories.size > 0) {
        query = query.in("category", Array.from(expandedCategories));
      }
    }

    // 3. Language filter
    if (languageParam && languageParam !== "all") {
      query = query.eq("language", languageParam);
    }

    // 4. Time Range filter
    if (timeRangeParam && timeRangeParam !== "all") {
      const now = Date.now();
      let cutoff: Date | null = null;
      if (timeRangeParam === "24h") {
        cutoff = new Date(now - 24 * 60 * 60 * 1000);
      } else if (timeRangeParam === "3d") {
        cutoff = new Date(now - 3 * 24 * 60 * 60 * 1000);
      } else if (timeRangeParam === "7d") {
        cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
      }
      if (cutoff) {
        query = query.gte("published_at", cutoff.toISOString());
      }
    }

    // 5. Min Budget filter
    const minBudget = Number(minBudgetParam) || 0;
    if (minBudget > 0) {
      if (includeNoBudget) {
        // Either budget is >= minBudget OR budget is null/0
        query = query.or(`budget_usd_estimate.gte.${minBudget},budget_usd_estimate.is.null,budget_usd_estimate.eq.0`);
      } else {
        query = query.gte("budget_usd_estimate", minBudget);
      }
    }

    // 6. Search keyword
    if (searchParam && searchParam.trim()) {
      query = query.ilike("title", `%${searchParam.trim()}%`);
    }

    const { data: rawProjects, error } = await query;

    if (error) {
      console.error("[Projects API] Query error:", error);
      throw error;
    }

    // Transform and compute quality score (1 to 5)
    const projects = (rawProjects || []).map((p: any) => {
      // Calculate quality score (1 to 5) based on description depth & budget clarity
      let score = 2;
      const descLen = (p.description || "").length;
      if (descLen > 300) score += 2;
      else if (descLen > 100) score += 1;

      if (p.budget && p.budget.toLowerCase() !== "not specified") {
        score += 1;
      }

      const qualityScore = Math.min(5, Math.max(1, score));

      return {
        id: p.id,
        external_id: p.external_id,
        platform: p.platform,
        title: p.title,
        description: p.description,
        url: p.url,
        budget: p.budget || "not specified",
        budget_usd_estimate: p.budget_usd_estimate || 0,
        currency: p.currency || "USD",
        category: p.category,
        language: p.language || "ar",
        author: p.author || "صاحب مشروع",
        published_at: p.published_at,
        quality_score: qualityScore,
      };
    });

    return NextResponse.json({
      ok: true,
      count: projects.length,
      projects,
    });
  } catch (err: any) {
    console.error("[Projects API] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
