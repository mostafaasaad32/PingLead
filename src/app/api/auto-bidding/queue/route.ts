// ==============================================================================
// src/app/api/auto-bidding/queue/route.ts
// Auto-Bid Pre-Screening Queue & 1-Click Approval API
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { evaluateProjectForAutoBidding } from "@/lib/auto-bidder/engine";
import { extractTitleFromPostText } from "@/lib/scrapers/types";

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

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "all";

    let query = (supabase.from("auto_bid_queue") as any)
      .select(`
        *,
        projects (
          id,
          title,
          description,
          platform,
          budget,
          url,
          published_at
        ),
        leads_pool (
          id,
          platform,
          post_text,
          post_url,
          published_at
        ),
        proposal_templates (
          id,
          name
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    const { data: queue, error } = await query;
    if (error) throw error;

    const formatted = (queue || []).map((item: any) => {
      let title = "مشروع عمل حر";
      let platform = "freelance";
      let budget = null;
      let url = item.platform_url;

      if (item.projects) {
        title = item.projects.title || title;
        platform = item.projects.platform || platform;
        budget = item.projects.budget;
        url = item.projects.url || url;
      } else if (item.leads_pool) {
        title = extractTitleFromPostText(item.leads_pool.post_text) || title;
        platform = item.leads_pool.platform || platform;
        url = item.leads_pool.post_url || url;
      }

      return {
        id: item.id,
        user_id: item.user_id,
        project_id: item.project_id,
        lead_id: item.lead_id,
        match_score: item.match_score,
        status: item.status,
        generated_proposal: item.generated_proposal,
        template_name: item.proposal_templates?.name || null,
        template_variant: item.template_variant,
        selected_attachment: item.selected_attachment,
        title,
        platform,
        budget,
        platform_url: url,
        created_at: item.created_at,
        processed_at: item.processed_at,
      };
    });

    return NextResponse.json({ ok: true, queue: formatted });
  } catch (err: any) {
    console.error("[Auto-Bidding Queue API] GET Error:", err);
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
    const { action, id } = body;

    // Action A: Approve & Execute 1-Click Auto-Fill
    if (action === "approve") {
      if (!id) {
        return NextResponse.json(
          { error: "معرف العرض مطلوب للموافقة" },
          { status: 400 }
        );
      }

      // 1. Fetch queue item
      const { data: item, error: itemErr } = await (supabase
        .from("auto_bid_queue") as any)
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();

      if (itemErr || !item) {
        return NextResponse.json({ error: "العرض غير موجود" }, { status: 404 });
      }

      // 2. Update status to approved
      await (supabase
        .from("auto_bid_queue") as any)
        .update({
          status: "approved",
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      // 3. Record in user_project_actions as 'applied'
      if (item.project_id) {
        await (supabase
          .from("user_project_actions") as any)
          .upsert(
            {
              user_id: user.id,
              project_id: item.project_id,
              status: "applied",
              generated_proposal: item.generated_proposal,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,project_id" }
          );
      }

      return NextResponse.json({
        ok: true,
        message: "تمت الموافقة وتجهيز العرض بنجاح",
        proposal: item.generated_proposal,
        platform_url: item.platform_url,
        attachment: item.selected_attachment,
      });
    }

    // Action B: Reject / Skip
    if (action === "reject") {
      if (!id) {
        return NextResponse.json({ error: "معرف العرض مطلوب" }, { status: 400 });
      }

      await (supabase
        .from("auto_bid_queue") as any)
        .update({
          status: "rejected",
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id);

      return NextResponse.json({ ok: true, message: "تم تخطي العرض" });
    }

    // Action C: Test Evaluation Trigger
    if (action === "trigger_test_evaluation") {
      // Find latest project or lead
      const { data: projs } = await (supabase.from("projects") as any)
        .select("*")
        .order("published_at", { ascending: false })
        .limit(1);

      if (projs && projs.length > 0) {
        const p = projs[0];
        const res = await evaluateProjectForAutoBidding({
          id: p.id,
          title: p.title,
          description: p.description,
          platform: p.platform,
          url: p.url,
          category: p.category,
        });

        return NextResponse.json({
          ok: true,
          message: "تم فحص المشروع عبر محرك الأتمتة",
          result: res,
        });
      }

      return NextResponse.json({
        ok: true,
        message: "لا توجد مشاريع للفحص حالياً.",
      });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (err: any) {
    console.error("[Auto-Bidding Queue API] POST Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
