// ==============================================================================
// src/app/api/portfolio/route.ts
// AI Portfolio Vault API - 100% Real Supabase Database Persistence
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

    // 1. Fetch user profile
    const { data: profile } = await (supabase
      .from("freelancer_profiles") as any)
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // 2. Fetch user portfolio items from portfolio_items table
    const { data: dbItems, error } = await supabase
      .from("portfolio_items")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const items: any[] = dbItems || [];

    return NextResponse.json({
      ok: true,
      profile: profile || {
        user_id: user.id,
        full_name: user.user_metadata?.full_name || "مستقل محترف",
        title: "Senior Full-Stack Specialist",
        bio: "مطور برمجيات مستقل متخصص في إنجاز المشاريع التقنية المعقدة.",
        skills: ["React", "Next.js", "TypeScript", "Supabase"],
        tone_of_voice: "confident",
      },
      portfolio_items: items,
    });
  } catch (err: any) {
    console.error("[Portfolio API] GET error:", err);
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
    const { action } = body;

    // Action A: Add new Portfolio Item
    if (action === "add_item") {
      const { project_title, description, live_url, tags, category } = body;

      if (!project_title || !project_title.trim()) {
        return NextResponse.json(
          { error: "عنوان المشروع مطلوب" },
          { status: 400 }
        );
      }

      const payload = {
        user_id: user.id,
        project_title: project_title.trim(),
        description: (description || "").trim(),
        live_url: live_url ? live_url.trim() : null,
        tags: Array.isArray(tags) ? tags : [],
        category: category || "web_dev",
      };

      const { data: newItem, error } = await (supabase
        .from("portfolio_items") as any)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ ok: true, item: newItem });
    }

    // Action B: Edit / Update existing Portfolio Item
    if (action === "edit_item") {
      const { id, project_title, description, live_url, tags, category } = body;

      if (!id) {
        return NextResponse.json(
          { error: "معرف المشروع مطلوب للتعديل" },
          { status: 400 }
        );
      }

      const payload = {
        project_title: project_title?.trim(),
        description: description?.trim(),
        live_url: live_url ? live_url.trim() : null,
        tags: Array.isArray(tags) ? tags : [],
        category: category || "web_dev",
        updated_at: new Date().toISOString(),
      };

      const { data: updatedItem, error } = await (supabase
        .from("portfolio_items") as any)
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ ok: true, item: updatedItem });
    }

    // Action C: Delete Portfolio Item
    if (action === "delete_item") {
      const { id } = body;
      if (!id) {
        return NextResponse.json(
          { error: "معرف المشروع مطلوب للحذف" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("portfolio_items")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      return NextResponse.json({ ok: true, deleted_id: id });
    }

    // Action D: Update Persona / Profile Bio
    if (action === "save_persona") {
      const { full_name, bio, skills, tone_of_voice } = body;

      const { error } = await (supabase
        .from("freelancer_profiles") as any)
        .update({
          full_name: full_name?.trim(),
          bio: bio?.trim(),
          skills: Array.isArray(skills) ? skills : [],
          tone_of_voice: tone_of_voice || "confident",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      return NextResponse.json({ ok: true, message: "تم تحديث الملف الشخصي" });
    }

    return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  } catch (err: any) {
    console.error("[Portfolio API] POST error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
