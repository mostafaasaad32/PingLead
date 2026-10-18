// ==============================================================================
// src/app/api/auth/signup-link/route.ts
// Server-Side Signup Confirmation Link Logger
// ==============================================================================

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();
    const returnUrl = body.returnUrl || "/dashboard";

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "البريد الإلكتروني غير صالح" },
        { status: 400 }
      );
    }

    const { origin } = new URL(request.url);
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`;

    console.log("\n================================================================================");
    console.log("📨 [AUTH LOG] طلب رابط تأكيد الحساب / Signup Confirmation Link");
    console.log(`- 👤 البريد: ${email}`);
    console.log(`- ⏱️ التوقيت: ${new Date().toISOString()}`);

    // Generate direct confirmation link via Supabase Admin
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (linkError) {
      console.warn("⚠️ [AUTH LOG] تعذر توليد رابط التأكيد:", linkError.message);
      return NextResponse.json({ ok: false, error: linkError.message }, { status: 400 });
    }

    const actionLink = linkData?.properties?.action_link || null;
    console.log("🔗 [DIRECT SIGNUP LINK] رابط التأكيد المباشر:");
    console.log(`   ${actionLink}`);
    console.log("📌 تنبيه: إذا لم تجد رسالة Resend في صندوق الوارد، يرجى فحص Spam / Junk.");
    console.log("================================================================================\n");

    return NextResponse.json({
      ok: true,
      directLink: actionLink,
      email,
    });
  } catch (err: any) {
    console.error("💥 [AUTH LOG] خطأ:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
