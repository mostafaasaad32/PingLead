// ==============================================================================
// src/app/api/telegram/connect/route.ts
// One-click Telegram linking for the signed-in user.
//   GET    -> connection status + deep link (t.me/<bot>?start=<connect_token>)
//   DELETE -> disconnect Telegram from this account
// The chat ID is only ever set by the bot webhook after the user presses Start,
// so nobody can point alerts at someone else's chat.
// ==============================================================================

import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getBotUsername } from "@/lib/telegram/bot-info";

export const dynamic = "force-dynamic";

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });
  }

  const { data: profile } = await (supabaseAdmin.from("freelancer_profiles") as any)
    .select("telegram_chat_id, telegram_connect_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json(
      { error: "لم يتم إنشاء ملفك الشخصي بعد. أكّد بريدك الإلكتروني ثم أعد المحاولة." },
      { status: 404 }
    );
  }

  let connectToken: string | null = profile.telegram_connect_token;
  if (!connectToken) {
    connectToken = randomBytes(16).toString("hex");
    await (supabaseAdmin.from("freelancer_profiles") as any)
      .update({ telegram_connect_token: connectToken })
      .eq("user_id", user.id);
  }

  const botUsername = await getBotUsername();

  return NextResponse.json({
    ok: true,
    connected: !!profile.telegram_chat_id,
    botUsername,
    link: `https://t.me/${botUsername}?start=${connectToken}`,
  });
}

export async function DELETE() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });
  }

  await (supabaseAdmin.from("freelancer_profiles") as any)
    .update({ telegram_chat_id: null })
    .eq("user_id", user.id);
  await (supabaseAdmin.from("profiles") as any)
    .update({ telegram_chat_id: null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, connected: false });
}
