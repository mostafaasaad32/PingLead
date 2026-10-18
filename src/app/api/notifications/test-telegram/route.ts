// ==============================================================================
// src/app/api/notifications/test-telegram/route.ts
// Test Telegram Notification Delivery for Settings
// ==============================================================================

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "غير مصرح - يرجى تسجيل الدخول أولاً" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let targetChatId = body.chatId;

    // If chatId not provided in body, fetch from profile
    if (!targetChatId) {
      const { data: profile } = await (supabase
        .from("freelancer_profiles") as any)
        .select("telegram_chat_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileData = profile as { telegram_chat_id: string | null } | null;
      targetChatId = profileData?.telegram_chat_id;
    }

    if (!targetChatId) {
      return NextResponse.json(
        {
          error:
            "لم يتم تحديد Telegram Chat ID. يرجى إدخال معرف المحادثة وحفظه أولاً.",
        },
        { status: 400 }
      );
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN غير مهيأ على الخادم." },
        { status: 500 }
      );
    }

    const now = new Date().toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    const testMessageText = `🔔 <b>إشعار اختبار ناجح من PingLead!</b>\n\n` +
      `مرحباً بك! رادار <b>PingLead</b> متصل الآن بنجاح بحسابك على تليجرام.\n\n` +
      `⏱️ <b>وقت الاختبار:</b> ${now}\n` +
      `🎯 <b>حالة الاتصال:</b> مفعّل ولحظي (0-second latency)\n` +
      `⚡ ستتلقى التنبيهات الفورية هنا فور رصد أي مشروع يطابق فلاترك الذكية.`;

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: testMessageText,
          parse_mode: "HTML",
        }),
      }
    );

    const telegramData = await telegramRes.json();

    if (!telegramRes.ok || !telegramData.ok) {
      const desc = telegramData.description || "فشل إرسال الرسالة إلى تليجرام";
      let hint = "";
      if (desc.includes("chat not found")) {
        hint =
          "تأكد من بدء محادثة مع البوت أولاً بالضغط على /start في @Ping_Lead22_bot";
      }
      return NextResponse.json(
        { error: `${desc}. ${hint}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "تم إرسال الإشعار التجريبي إلى تليجرام بنجاح!",
    });
  } catch (err: any) {
    console.error("[Test Telegram API Error]:", err);
    return NextResponse.json(
      { error: err.message || "حدث خطأ غير متوقع" },
      { status: 500 }
    );
  }
}
