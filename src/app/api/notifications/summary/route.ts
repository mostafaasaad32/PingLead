// ==============================================================================
// src/app/api/notifications/summary/route.ts
// Daily Telegram summary preference (migration 0019):
//   GET -> { enabled, telegramLinked }
//   PUT -> { enabled }
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function currentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });

  const { data, error } = await (supabaseAdmin.from("freelancer_profiles") as any)
    .select("telegram_summary, telegram_chat_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    enabled: error ? false : data?.telegram_summary ?? true,
    telegramLinked: Boolean(data?.telegram_chat_id),
    migrationMissing: Boolean(error),
  });
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "اختيار غير صحيح." }, { status: 400 });
  }

  const { error } = await (supabaseAdmin.from("freelancer_profiles") as any)
    .update({ telegram_summary: body.enabled })
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, enabled: body.enabled });
}
