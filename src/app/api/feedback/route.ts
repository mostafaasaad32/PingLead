// ==============================================================================
// src/app/api/feedback/route.ts
// "رأيك" button: POST { kind, message, page } from signed-in users (migration 0021).
// At most 20 messages per user per day.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const KINDS = ["bug", "idea", "praise", "other"];
const DAILY_LIMIT = 20;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
  if (message.length < 3) return NextResponse.json({ error: "اكتب رأيك الأول." }, { status: 400 });

  const table = () => supabaseAdmin.from("feedback") as any;
  const { count } = await table()
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 86400e3).toISOString());
  if ((count || 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: "وصلت لحد الرسايل النهارده. شكراً على اهتمامك!" }, { status: 429 });
  }

  const { error } = await table().insert({
    user_id: user.id,
    kind: KINDS.includes(body.kind) ? body.kind : "other",
    message,
    page: typeof body.page === "string" ? body.page.slice(0, 200) : null,
    user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
