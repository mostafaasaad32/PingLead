// ==============================================================================
// src/app/api/filters/route.ts
// Vollna Smart Filters API - 100% Real Supabase Database Persistence
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "غير مصرح - يرجى تسجيل الدخول" },
        { status: 401 }
      );
    }

    // 1. Fetch user filters strictly for the authenticated user
    const { data: filters, error } = await supabase
      .from("user_filters")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, filters: filters || [] });
  } catch (err: any) {
    console.error("[Filters API] GET error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "غير مصرح - يرجى تسجيل الدخول" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      filter_name,
      platforms,
      categories,
      include_keywords,
      exclude_keywords,
      min_budget_usd,
      is_active,
      notify_telegram,
    } = body;

    if (!filter_name || !filter_name.trim()) {
      return NextResponse.json({ error: "اسم الفلتر مطلوب" }, { status: 400 });
    }

    const payload = {
      user_id: user.id,
      filter_name: filter_name.trim(),
      platforms: Array.isArray(platforms) ? platforms : [],
      categories: Array.isArray(categories) ? categories : ["web_dev"],
      include_keywords: Array.isArray(include_keywords) ? include_keywords : [],
      exclude_keywords: Array.isArray(exclude_keywords) ? exclude_keywords : [],
      min_budget_usd: Number(min_budget_usd) || 0,
      is_active: is_active ?? true,
      notify_telegram: notify_telegram ?? true,
    };

    const { data: inserted, error } = await (supabase
      .from("user_filters") as any)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, filter: inserted });
  } catch (err: any) {
    console.error("[Filters API] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "غير مصرح - يرجى تسجيل الدخول" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "معرف الفلتر مطلوب" }, { status: 400 });
    }

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.filter_name !== undefined) payload.filter_name = updates.filter_name.trim();
    if (updates.platforms !== undefined) payload.platforms = updates.platforms;
    if (updates.categories !== undefined) payload.categories = updates.categories;
    if (updates.include_keywords !== undefined) payload.include_keywords = updates.include_keywords;
    if (updates.exclude_keywords !== undefined) payload.exclude_keywords = updates.exclude_keywords;
    if (updates.min_budget_usd !== undefined) payload.min_budget_usd = Number(updates.min_budget_usd);
    if (updates.is_active !== undefined) payload.is_active = Boolean(updates.is_active);
    if (updates.notify_telegram !== undefined) payload.notify_telegram = Boolean(updates.notify_telegram);

    const { data: updated, error } = await (supabase
      .from("user_filters") as any)
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, filter: updated });
  } catch (err: any) {
    console.error("[Filters API] PUT error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "غير مصرح - يرجى تسجيل الدخول" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "معرف الفلتر مطلوب" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_filters")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ ok: true, deleted_id: id });
  } catch (err: any) {
    console.error("[Filters API] DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
