"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Zap,
  Info,
  ShieldCheck,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Notifications State
  const [userId, setUserId] = useState("");
  const [chatId, setChatId] = useState("");
  const [connectToken, setConnectToken] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);

        const { data: profile } = await (supabase
          .from("freelancer_profiles") as any)
          .select("telegram_chat_id, telegram_connect_token, notifications_enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile) {
          setChatId(profile.telegram_chat_id || "");
          setConnectToken(profile.telegram_connect_token || "");
          setNotificationsEnabled(profile.notifications_enabled ?? true);
        }
      } catch (err: any) {
        console.error("Error loading notification settings:", err);
        setErrorMessage("تعذر قراءة إعدادات الإشعارات من قاعدة البيانات.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, [supabase, router]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setToastMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await (supabase
        .from("freelancer_profiles") as any)
        .update({
          telegram_chat_id: chatId.trim() || null,
          notifications_enabled: notificationsEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;

      setToastMessage("تم حفظ إعدادات إشعارات تليجرام بنجاح!");
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error("Error saving notification settings:", err);
      setErrorMessage(err.message || "حدث خطأ أثناء حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!chatId.trim()) {
      setErrorMessage("يرجى إدخال Telegram Chat ID وحفظه أولاً قبل إرسال الإشعار التجريبي.");
      return;
    }

    setTesting(true);
    setToastMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/notifications/test-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chatId.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "فشل إرسال الإشعار التجريبي");
      }

      setToastMessage(data.message || "تم إرسال إشعار تجريبي إلى حسابك على تليجرام بنجاح!");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Error testing telegram:", err);
      setErrorMessage(err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="vollna-card p-10 text-center bg-white border border-slate-200 rounded-2xl">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">جاري قراءة إعدادات تليجرام من Supabase...</p>
      </div>
    );
  }

  const isConnected = Boolean(chatId && chatId.trim().length > 0);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-3 border border-emerald-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Connection Status Banner */}
      <div
        className={`vollna-card p-5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isConnected
            ? "bg-emerald-50/60 border-emerald-200/80"
            : "bg-amber-50/60 border-amber-200/80"
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isConnected
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                : "bg-amber-500 text-white shadow-sm shadow-amber-500/30"
            }`}
          >
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-slate-900">
                {isConnected
                  ? "بوت تليجرام متصل بنجاح"
                  : "بوت تليجرام غير مربوط بعد"}
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isConnected
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {isConnected ? "متصل" : "مطلوب الربط"}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {isConnected
                ? `معرف المحادثة المربوط: ${chatId}`
                : "اربط حسابك لتصلك إشعارات المشاريع فور نشرها في أقل من ثانية."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <a
            href="https://t.me/Ping_Lead22_bot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition shadow-xs"
          >
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>فتح @Ping_Lead22_bot</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Telegram Chat ID Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-900">
                معرّف محادثة تليجرام (Chat ID)
              </label>
              <a
                href="https://t.me/userinfobot"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-700 font-bold hover:underline flex items-center gap-1"
              >
                <span>كيف أحصل على معرف المحادثة (Chat ID)؟</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="مثال: 2135285271"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition text-left dir-ltr"
              />
              <Bot className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              افتح البوت{" "}
              <a
                href="https://t.me/Ping_Lead22_bot"
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 font-bold hover:underline font-mono"
              >
                @Ping_Lead22_bot
              </a>{" "}
              واضغط <strong>/start</strong>، ثم ضع الـ Chat ID الخاص بك في الحقل أعلاه.
            </p>
          </div>

          {/* Toggle Instant Notifications */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>تفعيل التنبيهات اللحظية عبر تليجرام</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                إرسال بطاقة المشروع مع ملخص AI وروابط التقديم المباشرة لحظة رصده.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Action Buttons: Save & Test */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleSendTestNotification}
              disabled={testing || !chatId.trim()}
              className="py-2.5 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-emerald-600" />
              <span>{testing ? "جاري الإرسال التجريبي..." : "إرسال إشعار تجريبي فوري"}</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "جاري الحفظ في Supabase..." : "حفظ الإعدادات"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Guide Card */}
      <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl">
        <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
          <Info className="w-4 h-4 text-emerald-600" />
          <span>خطوات تشغيل تنبيهات تليجرام في 30 ثانية:</span>
        </h4>
        <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pr-1">
          <li>
            افتح البوت الرسمي على تليجرام:{" "}
            <a
              href="https://t.me/Ping_Lead22_bot"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-emerald-700 hover:underline"
            >
              @Ping_Lead22_bot
            </a>
          </li>
          <li>اضغط على زر <strong>Start</strong> أو أرسل <strong>/start</strong>.</li>
          <li>
            احصل على معرفك (Chat ID) من البوت أو من خلال بوت{" "}
            <a
              href="https://t.me/userinfobot"
              target="_blank"
              rel="noreferrer"
              className="text-slate-800 font-bold hover:underline"
            >
              @userinfobot
            </a>
            .
          </li>
          <li>الصق الرقم في الحقل أعلاه واضغط <strong>حفظ الإعدادات</strong> ثم اضغط <strong>إرسال إشعار تجريبي</strong> للتأكد.</li>
        </ol>
      </div>
    </div>
  );
}
