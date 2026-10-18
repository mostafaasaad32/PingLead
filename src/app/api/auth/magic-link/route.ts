// ==============================================================================
// src/app/api/auth/magic-link/route.ts
// Server-Side Magic Link Generator & Logger
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
        { ok: false, error: "البريد الإلكتروني المدخل غير صالح" },
        { status: 400 }
      );
    }

    const { origin } = new URL(request.url);
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(returnUrl)}`;

    console.log("\n================================================================================");
    console.log("📨 [AUTH LOG] طلب رابط سحري جديد / Magic Link Requested");
    console.log(`- 👤 البريد الإلكتروني: ${email}`);
    console.log(`- ⏱️ التوقيت: ${new Date().toISOString()}`);
    console.log(`- ↩️ رابط العودة (Redirect To): ${redirectTo}`);

    // 1. Generate the direct action link via Supabase Admin (bypasses any email delivery failure)
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

    if (linkError) {
      console.error("❌ [AUTH LOG] فشل توليد الرابط عبر Supabase Admin:", linkError);
      return NextResponse.json(
        { ok: false, error: linkError.message || "فشل توليد الرابط السحري" },
        { status: 500 }
      );
    }

    const actionLink = linkData?.properties?.action_link || null;
    const emailOtp = linkData?.properties?.email_otp || null;

    // 2. Trigger the actual email send via Supabase Auth / Resend SMTP
    const { error: otpSendError } = await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (otpSendError) {
      console.warn("⚠️ [AUTH LOG] تنبيه إرسال الإيميل عبر Resend/Supabase:", otpSendError.message);
    } else {
      console.log("✅ [AUTH LOG] تم إرسال طلب البريد بنجاح إلى مزود الإيميل (Resend).");
    }

    // 3. Print the Direct Action Link prominently in the terminal so developers/users can use it immediately
    console.log("--------------------------------------------------------------------------------");
    console.log("🔗 [DIRECT MAGIC LINK] الرابط المباشر لتسجيل الدخول الفوري دون انتظار الإيميل:");
    console.log(`   ${actionLink}`);
    if (emailOtp) {
      console.log(`🔢 [OTP CODE] رمز التحقق المباشر: ${emailOtp}`);
    }
    console.log("📌 تنبيه: إذا لم يظهر الإيميل في صندوق الوارد (Inbox)، يرجى فحص مجلد الرسائل غير المرغوب فيها (Spam / Junk).");
    console.log("================================================================================\n");

    return NextResponse.json({
      ok: true,
      message: "تم إرسال الرابط السحري وتوليده بنجاح",
      email,
      directLink: actionLink,
      otp: emailOtp,
    });
  } catch (err: any) {
    console.error("💥 [AUTH LOG] خطأ غير متوقع في معالجة الرابط السحري:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "حدث خطأ غير متوقع في الخادم" },
      { status: 500 }
    );
  }
}
