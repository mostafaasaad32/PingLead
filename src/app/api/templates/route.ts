// ==============================================================================
// src/app/api/templates/route.ts
// Proposal Templates CRUD API with 100% Supabase Persistence
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

    // 1. Fetch user templates
    const { data: templates, error } = await (supabase
      .from("proposal_templates") as any)
      .select(`
        *,
        user_filters (
          id,
          filter_name
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, templates: templates || [] });
  } catch (err: any) {
    console.error("[Templates API] GET error:", err);
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
      name,
      sender_name,
      hourly_rate,
      pricing_type,
      filter_id,
      template_body,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "اسم القالب مطلوب" },
        { status: 400 }
      );
    }

    const payload = {
      user_id: user.id,
      name: name.trim(),
      sender_name: sender_name ? sender_name.trim() : null,
      hourly_rate: Number(hourly_rate) || 30,
      pricing_type: pricing_type || "job_terms",
      filter_id: filter_id || null,
      template_body: template_body ? template_body.trim() : null,
    };

    const { data: inserted, error } = await (supabase
      .from("proposal_templates") as any)
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, template: inserted });
  } catch (err: any) {
    console.error("[Templates API] POST error:", err);
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
      return NextResponse.json(
        { error: "معرف القالب مطلوب" },
        { status: 400 }
      );
    }

    const payload: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.sender_name !== undefined) payload.sender_name = updates.sender_name ? updates.sender_name.trim() : null;
    if (updates.hourly_rate !== undefined) payload.hourly_rate = Number(updates.hourly_rate);
    if (updates.pricing_type !== undefined) payload.pricing_type = updates.pricing_type;
    if (updates.filter_id !== undefined) payload.filter_id = updates.filter_id || null;
    if (updates.template_body !== undefined) payload.template_body = updates.template_body ? updates.template_body.trim() : null;

    const { data: updated, error } = await (supabase
      .from("proposal_templates") as any)
      .update(payload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, template: updated });
  } catch (err: any) {
    console.error("[Templates API] PUT error:", err);
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
      return NextResponse.json(
        { error: "معرف القالب مطلوب" },
        { status: 400 }
      );
    }

    const { error } = await (supabase
      .from("proposal_templates") as any)
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ ok: true, deleted_id: id });
  } catch (err: any) {
    console.error("[Templates API] DELETE error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
