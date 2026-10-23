// ==============================================================================
// src/app/api/notifications/push/route.ts
// Browser notifications for the signed-in user:
//   GET    -> is push configured, the public VAPID key, how many devices are on
//   POST   -> save this browser's subscription { subscription }
//   DELETE -> remove it { endpoint }
//   PUT    -> send a test notification to all of the user's devices
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isWebPushConfigured, sendPushToSubscriptions } from "@/lib/notifications/web-push";

export const dynamic = "force-dynamic";

const table = () => supabaseAdmin.from("push_subscriptions") as any;

async function currentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const unauthorized = () => NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { count, error } = await table().select("id", { count: "exact", head: true }).eq("user_id", user.id);
  return NextResponse.json({
    ok: true,
    configured: isWebPushConfigured(),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
    devices: error ? 0 : count || 0,
    migrationMissing: Boolean(error),
  });
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "إشعارات المتصفح مش متفعّلة على السيرفر (مفاتيح VAPID ناقصة)." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const sub = body?.subscription;
  const endpoint: string = sub?.endpoint || "";
  const p256dh: string = sub?.keys?.p256dh || "";
  const auth: string = sub?.keys?.auth || "";
  if (!endpoint.startsWith("https://") || endpoint.length > 1000 || !p256dh || !auth) {
    return NextResponse.json({ error: "بيانات الاشتراك مش صحيحة." }, { status: 400 });
  }

  // An endpoint belongs to one browser: re-subscribing from another account moves it
  const { error } = await table().upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: (req.headers.get("user-agent") || "").slice(0, 300),
    },
    { onConflict: "endpoint" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  if (!body?.endpoint) return NextResponse.json({ error: "endpoint مطلوب" }, { status: 400 });

  await table().delete().eq("user_id", user.id).eq("endpoint", body.endpoint);
  return NextResponse.json({ ok: true });
}

export async function PUT() {
  const user = await currentUser();
  if (!user) return unauthorized();

  const { data: subs } = await table().select("id, endpoint, p256dh, auth").eq("user_id", user.id);
  if (!subs?.length) return NextResponse.json({ error: "مفيش جهاز متفعّل عليه الإشعارات." }, { status: 400 });

  const sent = await sendPushToSubscriptions(subs, {
    title: "🎯 PingLead: إشعار تجريبي",
    body: "الإشعارات شغالة. أول مشروع يطابق فلترك هيوصلك هنا.",
    url: "/dashboard",
    tag: "pinglead-test",
  });
  if (!sent) return NextResponse.json({ error: "الإشعار موصلش. جرّب تفعّل الإشعارات تاني." }, { status: 502 });
  return NextResponse.json({ ok: true, sent });
}
