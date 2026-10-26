// ==============================================================================
// src/app/api/onboarding/route.ts
// First-run setup: saves the user's specializations/skills to their profile,
// replaces the generic default filter with one built from their answers, and marks
// onboarding done (auth user_metadata.onboarded, so no extra column is needed).
//   POST { categories, skills, title?, min_budget_usd? }  -> finish setup
//   POST { skip: true }                                    -> mark done, change nothing
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CATEGORIES_METADATA } from "@/lib/scrapers/types";

export const dynamic = "force-dynamic";

// Filter the database trigger creates for every new account (migration 0008)
const DEFAULT_FILTER_NAME = "تطوير البرمجيات (افتراضي)";
const MAX_CATEGORIES = 3;
const MAX_SKILLS = 15;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (!body.skip) {
    const validIds = new Set(CATEGORIES_METADATA.map((c) => c.id as string));
    const categories: string[] = (Array.isArray(body.categories) ? body.categories : [])
      .filter((c: unknown) => typeof c === "string" && validIds.has(c))
      .slice(0, MAX_CATEGORIES);
    const skills: string[] = Array.from(
      new Set<string>(
        (Array.isArray(body.skills) ? body.skills : [])
          .filter((s: unknown) => typeof s === "string")
          .map((s: string) => s.trim())
          .filter(Boolean)
      )
    ).slice(0, MAX_SKILLS);

    if (categories.length === 0) {
      return NextResponse.json({ error: "اختار تخصص واحد على الأقل" }, { status: 400 });
    }

    const profileUpdate: Record<string, any> = { skills, updated_at: new Date().toISOString() };
    if (typeof body.title === "string" && body.title.trim()) profileUpdate.title = body.title.trim();

    const { error: profileError } = await (supabase.from("freelancer_profiles") as any)
      .update(profileUpdate)
      .eq("user_id", user.id);
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    // Turn off the generic default filter (no keywords, programming only) so it doesn't flood alerts
    await (supabase.from("user_filters") as any)
      .update({ is_active: false })
      .eq("user_id", user.id)
      .eq("filter_name", DEFAULT_FILTER_NAME);

    const firstLabel = CATEGORIES_METADATA.find((c) => c.id === categories[0])?.label_ar || "مشاريعي";
    const { error: filterError } = await (supabase.from("user_filters") as any).insert({
      user_id: user.id,
      filter_name: `${firstLabel}${categories.length > 1 ? ` +${categories.length - 1}` : ""}`,
      platforms: [], // every freelance platform; job boards stay opt-in
      categories,
      // Skills go to the profile (used for proposals), not the filter: as required keywords they
      // left a new user's first filter with almost no matches (an e2e test got 0 of ~190 programming
      // projects for "ووردبريس"). Narrowing is left to the filter page / AI criteria.
      include_keywords: [],
      exclude_keywords: [],
      min_budget_usd: Math.max(0, Number(body.min_budget_usd) || 0),
      is_active: true,
      notify_telegram: true,
    });
    if (filterError) {
      return NextResponse.json({ error: filterError.message }, { status: 500 });
    }
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: { onboarded: true, onboarded_at: new Date().toISOString() },
  });
  if (metaError) {
    return NextResponse.json({ error: metaError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
