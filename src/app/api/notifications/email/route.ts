// ==============================================================================
// src/app/api/notifications/email/route.ts
// Email digest preference for the signed-in user:
//   GET -> { configured, digest: 'off' | 'hourly' | 'daily', email }
//   PUT -> { digest }
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isEmailConfigured } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

const DIGESTS = ["off", "hourly", "daily"];

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
    .select("email_digest")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    configured: isEmailConfigured(),
    digest: data?.email_digest || "off",
    email: user.email || null,
    migrationMissing: Boolean(error),
  });
}

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (!DIGESTS.includes(body?.digest)) {
    return NextResponse.json({ error: "اختيار غير صحيح." }, { status: 400 });
  }

  const { error } = await (supabaseAdmin.from("freelancer_profiles") as any)
    .update({
      email_digest: body.digest,
      // Start the window now, so the first digest doesn't summarize old matches
      email_digest_sent_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, digest: body.digest });
}
