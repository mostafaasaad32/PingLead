// ==============================================================================
// src/app/api/auto-bidding/config/route.ts
// Auto-Bidding User Config API with 100% Supabase Persistence
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

    // 1. Fetch user config
    let { data: config, error } = await (supabase
      .from("auto_bidding_configs") as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    // 2. If no config exists, create default in Supabase
    if (!config) {
      const defaultConfig = {
        user_id: user.id,
        is_enabled: false,
        min_match_score: 80,
        schedule_start_hour: 8,
        schedule_end_hour: 23,
        active_days: [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ],
        review_mode: "require_approval",
        ab_testing_enabled: false,
        daily_limit: 10,
        smart_delay_minutes: 5,
        smart_attachments: [],
      };

      const { data: inserted, error: insErr } = await (supabase
        .from("auto_bidding_configs") as any)
        .insert(defaultConfig)
        .select()
        .single();

      if (!insErr && inserted) {
        config = inserted;
      }
    }

    // 3. Count today's bids
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { count: todayCount } = await (supabase
      .from("auto_bid_queue") as any)
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString());

    // 4. Calculate A/B Testing Stats
    const { data: queueItems } = await (supabase
      .from("auto_bid_queue") as any)
      .select("template_variant, status")
      .eq("user_id", user.id);

    let aTotal = 0;
    let aApproved = 0;
    let bTotal = 0;
    let bApproved = 0;

    (queueItems || []).forEach((item: any) => {
      if (item.template_variant === "A") {
        aTotal++;
        if (item.status === "approved" || item.status === "auto_sent") aApproved++;
      } else if (item.template_variant === "B") {
        bTotal++;
        if (item.status === "approved" || item.status === "auto_sent") bApproved++;
      }
    });

    return NextResponse.json({
      ok: true,
      config,
      today_bids_count: todayCount || 0,
      ab_stats: {
        variant_a: {
          total: aTotal,
          approved: aApproved,
          rate: aTotal > 0 ? Math.round((aApproved / aTotal) * 100) : 0,
        },
        variant_b: {
          total: bTotal,
          approved: bApproved,
          rate: bTotal > 0 ? Math.round((bApproved / bTotal) * 100) : 0,
        },
      },
    });
  } catch (err: any) {
    console.error("[Auto-Bidding Config API] GET Error:", err);
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
    const {
      is_enabled,
      min_match_score,
      schedule_start_hour,
      schedule_end_hour,
      active_days,
      review_mode,
      ab_testing_enabled,
      template_a_id,
      template_b_id,
      daily_limit,
      smart_delay_minutes,
      smart_attachments,
    } = body;

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (is_enabled !== undefined) payload.is_enabled = Boolean(is_enabled);
    if (min_match_score !== undefined) payload.min_match_score = Number(min_match_score);
    if (schedule_start_hour !== undefined) payload.schedule_start_hour = Number(schedule_start_hour);
    if (schedule_end_hour !== undefined) payload.schedule_end_hour = Number(schedule_end_hour);
    if (active_days !== undefined) payload.active_days = active_days;
    if (review_mode !== undefined) payload.review_mode = review_mode;
    if (ab_testing_enabled !== undefined) payload.ab_testing_enabled = Boolean(ab_testing_enabled);
    if (template_a_id !== undefined) payload.template_a_id = template_a_id || null;
    if (template_b_id !== undefined) payload.template_b_id = template_b_id || null;
    if (daily_limit !== undefined) payload.daily_limit = Number(daily_limit);
    if (smart_delay_minutes !== undefined) payload.smart_delay_minutes = Number(smart_delay_minutes);
    if (smart_attachments !== undefined) payload.smart_attachments = smart_attachments;

    const { data: updated, error } = await (supabase
      .from("auto_bidding_configs") as any)
      .upsert({ user_id: user.id, ...payload }, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, config: updated });
  } catch (err: any) {
    console.error("[Auto-Bidding Config API] PUT Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
