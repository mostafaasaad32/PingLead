"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Bot,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Info,
  Unlink,
  Loader2,
  Copy,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import OtherChannelsSettings from "@/components/notifications/OtherChannelsSettings";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

export default function NotificationsSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [waitingForStart, setWaitingForStart] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectLink, setConnectLink] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [startCopied, setStartCopied] = useState(false);

  // Telegram Web drops the ?start= payload, so offer the same command to paste manually
  const startToken = connectLink.split("?start=")[1] || "";
  const startCommand = startToken ? `/start ${startToken}` : "";

  const copyStartCommand = async () => {
    try {
      await navigator.clipboard.writeText(startCommand);
      setStartCopied(true);
      setTimeout(() => setStartCopied(false), 2000);
    } catch {
      setErrorMessage("تعذر النسخ تلقائياً. حدّد الرسالة وانسخها يدوياً.");
    }
  };

  // Waits for the bot to confirm the link (used by both the button and the manual command)
  const startWaitingForLink = () => {
    setErrorMessage(null);
    setWaitingForStart(true);
    const startedAt = Date.now();

    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      try {
        const data = await fetchConnection();
        if (data.connected) {
          stopPolling();
          showToast("تم ربط تليجرام بحسابك بنجاح!");
        } else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          stopPolling();
          setErrorMessage("لم يصل تأكيد من البوت. افتح البوت واضغط Start، ثم اضغط «ربط تليجرام» مرة أخرى.");
        }
      } catch {
        // keep polling; transient network errors are fine
      }
    }, POLL_INTERVAL_MS);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchConnection = useCallback(async () => {
    const res = await fetch("/api/telegram/connect", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "تعذر قراءة حالة ربط تليجرام");
    setConnected(!!data.connected);
    setConnectLink(data.link || "");
    setBotUsername(data.botUsername || "");
    return data as { connected: boolean };
  }, []);

  const stopPolling = () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = null;
    setWaitingForStart(false);
  };

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
          .select("notifications_enabled")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profile) setNotificationsEnabled(profile.notifications_enabled ?? true);

        await fetchConnection();
      } catch (err: any) {
        console.error("Error loading notification settings:", err);
        setErrorMessage(err.message || "تعذر قراءة إعدادات الإشعارات.");
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [supabase, router, fetchConnection]);

  // Opens the bot with this account's one-time code, then waits for the user to press Start
  const handleConnect = () => {
    if (!connectLink) return;
    window.open(connectLink, "_blank", "noopener,noreferrer");
    startWaitingForLink();
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/telegram/connect", { method: "DELETE" });
      if (!res.ok) throw new Error("تعذر فصل تليجرام");
      await fetchConnection();
      showToast("تم فصل تليجرام عن حسابك.");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    if (!userId) return;
    const { error } = await (supabase
      .from("freelancer_profiles") as any)
      .update({ notifications_enabled: enabled, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) {
      setNotificationsEnabled(!enabled);
      setErrorMessage("تعذر حفظ إعداد التنبيهات.");
    } else {
      showToast(enabled ? "تم تفعيل التنبيهات اللحظية." : "تم إيقاف التنبيهات اللحظية.");
    }
  };

  const handleSendTestNotification = async () => {
    setTesting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/notifications/test-telegram", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إرسال الإشعار التجريبي");
      showToast(data.message || "تم إرسال إشعار تجريبي إلى تليجرام!");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="vollna-card p-10 text-center bg-white border border-slate-200 rounded-2xl">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">جاري قراءة إعدادات تليجرام...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-3 border border-emerald-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Connection Card */}
      <div
        className={`vollna-card p-6 sm:p-8 rounded-2xl border transition ${
          connected ? "bg-emerald-50/60 border-emerald-200/80" : "bg-white border-slate-200"
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                connected
                  ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30"
                  : "bg-slate-900 text-emerald-400"
              }`}
            >
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">
                  {connected ? "تليجرام مربوط بحسابك" : "اربط تليجرام لتصلك المشاريع فوراً"}
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    connected ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {connected ? "متصل" : "غير مربوط"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {connected
                  ? `التنبيهات تصلك من البوت @${botUsername}`
                  : waitingForStart
                  ? "في انتظار ضغطك على Start في البوت..."
                  : "اضغط الزر، وسيفتح البوت. اضغط Start وسيتم الربط تلقائياً."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {connected ? (
              <>
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  disabled={testing}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50 shadow-sm shadow-emerald-600/20"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{testing ? "جاري الإرسال..." : "إرسال إشعار تجريبي"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>{disconnecting ? "جاري الفصل..." : "فصل تليجرام"}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={!connectLink}
                className="py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition flex items-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {waitingForStart ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                ) : (
                  <Bot className="w-4 h-4 text-emerald-400" />
                )}
                <span>{waitingForStart ? "فتح البوت مرة أخرى" : "ربط تليجرام"}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Instant notifications toggle */}
      <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-600" />
            <span>تفعيل التنبيهات اللحظية عبر تليجرام</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            إرسال بطاقة المشروع وروابط التقديم المباشرة لحظة رصده.
          </p>
        </div>

        <label className="relative inline-flex items-center cursor-pointer shrink-0">
          <input
            id="notifications-enabled"
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => handleToggleNotifications(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
        </label>
      </div>

      {/* Browser notifications + email digest (for users without Telegram) */}
      <OtherChannelsSettings onToast={showToast} />

      {/* Guide */}
      {!connected && (
        <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl">
          <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-emerald-600" />
            <span>الربط في خطوتين:</span>
          </h4>
          <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside pr-1">
            <li>اضغط زر <strong>ربط تليجرام</strong> بالأعلى، وسيفتح البوت في تليجرام.</li>
            <li>اضغط <strong>Start</strong> في البوت. ستتحول هذه الصفحة إلى «متصل» خلال ثوانٍ.</li>
          </ol>

          {startCommand && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
              <p className="text-xs text-slate-700 font-bold">
                لم يتم الربط؟ (يحدث غالباً مع تليجرام ويب)
              </p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                افتح البوت{" "}
                <a
                  href={`https://t.me/${botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-emerald-700 hover:underline"
                  dir="ltr"
                >
                  @{botUsername}
                </a>{" "}
                وأرسل له هذه الرسالة كما هي:
              </p>
              <div className="flex items-stretch rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                <code
                  dir="ltr"
                  className="flex-1 min-w-0 px-3 py-2 text-[11px] font-mono text-slate-800 overflow-x-auto whitespace-nowrap select-all"
                >
                  {startCommand}
                </code>
                <button
                  type="button"
                  onClick={() => {
                    copyStartCommand();
                    if (!waitingForStart) startWaitingForLink();
                  }}
                  className="px-3 text-[11px] font-bold text-emerald-700 bg-white border-r border-slate-200 hover:bg-emerald-50 transition flex items-center gap-1.5 shrink-0"
                >
                  {startCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{startCopied ? "تم النسخ" : "نسخ"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
