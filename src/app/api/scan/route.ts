// ==============================================================================
// src/app/api/scan/route.ts
// Manual "Scan now" endpoint for signed-in users. Runs the ingestion cron
// server-side so the CRON_SECRET never reaches the browser.
// ==============================================================================

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { triggerIngest } from "@/lib/cron/trigger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
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

  const result = await triggerIngest(true);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "تعذر تشغيل الرادار" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, skipped: !!result.skipped });
}
