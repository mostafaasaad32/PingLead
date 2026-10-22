// ==============================================================================
// src/app/api/tracker/route.ts
// Vollna Proposal CRM Tracker API - 100% Real Supabase Database Persistence
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

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "all";

    // Query user_project_actions joined with projects table
    let query = supabase
      .from("user_project_actions")
      .select(`
        id,
        project_id,
        status,
        generated_proposal,
        notes,
        matched_filter_id,
        created_at,
        updated_at,
        projects (
          id,
          title,
          description,
          url,
          platform,
          category,
          budget,
          budget_usd_estimate,
          published_at
        )
      `)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter as any);
    }

    const { data, error } = await query;
    if (error) throw error;

    const trackedItems = (data || []).map((item: any) => {
      // A project is ONLY 'saved' if the user explicitly clicked save (notes === 'user_saved')
      let effectiveStatus = item.status;
      if (effectiveStatus === "saved" && item.notes !== "user_saved") {
        effectiveStatus = "matched";
      }

      return {
        id: item.id,
        project_id: item.project_id,
        status: effectiveStatus,
        generated_proposal: item.generated_proposal,
        notes: item.notes,
        matched_filter_id: item.matched_filter_id,
        title: item.projects?.title || "مشروع عمل حر",
        description: item.projects?.description || "",
        url: item.projects?.url || "",
        platform: item.projects?.platform || "mostaql",
        category: item.projects?.category || "web_dev",
        budget: item.projects?.budget || null,
        budget_usd_estimate: item.projects?.budget_usd_estimate || null,
        published_at: item.projects?.published_at || item.created_at,
        tracked_at: item.created_at,
        updated_at: item.updated_at,
      };
    });

    // Filter by effective status if requested
    const filteredItems =
      statusFilter === "all"
        ? trackedItems
        : trackedItems.filter((i) => i.status === statusFilter);

    // Calculate real CRM metrics
    const savedCount = trackedItems.filter((i) => i.status === "saved").length;
    const proposalsCount = trackedItems.filter((i) => Boolean(i.generated_proposal)).length;
    const totalCount = trackedItems.length;

    return NextResponse.json({
      ok: true,
      items: filteredItems,
      metrics: {
        total: totalCount,
        saved: savedCount,
        proposals_generated: proposalsCount,
      },
    });
  } catch (err: any) {
    console.error("[Tracker API] GET error:", err);
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
    const { project_id, status, generated_proposal, notes } = body;

    if (!project_id) {
      return NextResponse.json(
        { error: "project_id مطلوب" },
        { status: 400 }
      );
    }

    const targetStatus = status || "saved";

    const payload: any = {
      user_id: user.id,
      project_id,
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (targetStatus === "saved") {
      payload.notes = notes || "user_saved";
    } else if (targetStatus === "ignored") {
      payload.notes = null;
    } else if (notes !== undefined) {
      payload.notes = notes;
    }

    const { data: action, error } = await supabase
      .from("user_project_actions")
      .upsert(payload, { onConflict: "user_id,project_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, action });
  } catch (err: any) {
    console.error("[Tracker API] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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
    const { id, project_id, status, generated_proposal, notes } = body;

    const updates: any = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      updates.status = status;
      if (status === "saved" && notes === undefined) {
        updates.notes = "user_saved";
      }
    }
    if (generated_proposal !== undefined) updates.generated_proposal = generated_proposal;
    if (notes !== undefined) updates.notes = notes;

    let query = (supabase.from("user_project_actions") as any).update(updates);

    if (id) {
      query = query.eq("id", id).eq("user_id", user.id);
    } else if (project_id) {
      query = query.eq("project_id", project_id).eq("user_id", user.id);
    } else {
      return NextResponse.json({ error: "معرف السجل مطلوب" }, { status: 400 });
    }

    const { data: updated, error } = await query.select().single();
    if (error) throw error;

    return NextResponse.json({ ok: true, action: updated });
  } catch (err: any) {
    console.error("[Tracker API] PATCH error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
