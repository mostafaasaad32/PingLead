"use client";

// Browser notifications (Web Push) + email digest, for users who don't use Telegram.
// Used on /settings/notifications.

import { useCallback, useEffect, useState } from "react";
import { BellRing, Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

type Digest = "off" | "hourly" | "daily";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const DIGEST_OPTIONS: { id: Digest; label: string; hint: string }[] = [
  { id: "off", label: "مقفول", hint: "" },
  { id: "hourly", label: "كل ساعة", hint: "لو وصلك مشاريع جديدة في الساعة دي" },
  { id: "daily", label: "كل يوم الساعة 9 الصبح", hint: "ملخص آخر 24 ساعة بتوقيتك" },
];

export default function OtherChannelsSettings({ onToast }: { onToast: (msg: string) => void }) {
  // Browser push
  const [pushSupported, setPushSupported] = useState<boolean | null>(null);
  const [pushConfigured, setPushConfigured] = useState(true);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribedHere, setSubscribedHere] = useState(false);
  const [devices, setDevices] = useState(0);
  const [pushBusy, setPushBusy] = useState(false);

  // Email
  const [emailConfigured, setEmailConfigured] = useState(true);
  const [digest, setDigest] = useState<Digest>("off");
  const [email, setEmail] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const refreshPush = useCallback(async () => {
    const supported =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setPushSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
      const reg = await navigator.serviceWorker.getRegistration("/sw.js").catch(() => undefined);
      const sub = reg ? await reg.pushManager.getSubscription().catch(() => null) : null;
      setSubscribedHere(Boolean(sub));
    }
    const res = await fetch("/api/notifications/push").catch(() => null);
    const data = res ? await res.json().catch(() => null) : null;
    if (data?.ok) {
      setPushConfigured(Boolean(data.configured));
      setPublicKey(data.publicKey);
      setDevices(data.devices || 0);
    }
  }, []);

  useEffect(() => {
    refreshPush();
    fetch("/api/notifications/email")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) return;
        setEmailConfigured(Boolean(data.configured));
        setDigest(data.digest || "off");
        setEmail(data.email);
      })
      .catch(() => {});
  }, [refreshPush]);

  const enablePush = async () => {
    if (!publicKey) return;
    setPushBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        onToast("المتصفح رفض الإشعارات. فعّلها من إعدادات الموقع في المتصفح (أيقونة القفل جنب العنوان).");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource }));
      const res = await fetch("/api/notifications/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "تعذر تفعيل الإشعارات");
      onToast("🔔 إشعارات المتصفح اتفعّلت على الجهاز ده");
      await refreshPush();
    } catch (err: any) {
      onToast(err.message || "تعذر تفعيل الإشعارات");
    } finally {
      setPushBusy(false);
    }
  };

  const disablePush = async () => {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/notifications/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      onToast("الإشعارات اتقفلت على الجهاز ده");
      await refreshPush();
    } finally {
      setPushBusy(false);
    }
  };

  const testPush = async () => {
    setPushBusy(true);
    try {
      const res = await fetch("/api/notifications/push", { method: "PUT" });
      const data = await res.json().catch(() => ({}));
      onToast(data.ok ? "اتبعت إشعار تجريبي، المفروض يظهرلك دلوقتي" : data.error || "تعذر إرسال الإشعار");
    } finally {
      setPushBusy(false);
    }
  };

  const saveDigest = async (next: Digest) => {
    const previous = digest;
    setDigest(next);
    setEmailBusy(true);
    try {
      const res = await fetch("/api/notifications/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digest: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "تعذر الحفظ");
      onToast(next === "off" ? "ملخص الإيميل اتقفل" : `📧 هيوصلك ملخص ${next === "hourly" ? "كل ساعة" : "كل يوم الصبح"}`);
    } catch (err: any) {
      setDigest(previous);
      onToast(err.message || "تعذر الحفظ");
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <>
      {/* Browser notifications */}
      <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-emerald-600" />
              <span>إشعارات المتصفح</span>
              {subscribedHere && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> متفعّلة هنا
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
              إشعار على الكمبيوتر أو الموبايل لحظة ما مشروع يطابق فلترك، حتى لو الموقع مقفول. بديل لتليجرام، أو معاه.
              {devices > 0 && ` متفعّلة على ${devices} ${devices === 1 ? "جهاز" : "أجهزة"}.`}
            </p>
          </div>
        </div>

        {pushSupported === false ? (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              المتصفح ده مش بيدعم الإشعارات. على الآيفون: افتح الموقع من Safari، ودوس مشاركة ← «إضافة إلى الشاشة الرئيسية»، وافتحه من
              الأيقونة.
            </span>
          </p>
        ) : !pushConfigured ? (
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            إشعارات المتصفح لسه مش متفعّلة على السيرفر.
          </p>
        ) : permission === "denied" ? (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            الإشعارات مرفوضة للموقع ده في المتصفح. فعّلها من أيقونة القفل جنب عنوان الموقع، وبعدها ارجع هنا.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {subscribedHere ? (
              <>
                <button
                  type="button"
                  onClick={testPush}
                  disabled={pushBusy}
                  className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {pushBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  ابعت إشعار تجريبي
                </button>
                <button
                  type="button"
                  onClick={disablePush}
                  disabled={pushBusy}
                  className="py-2 px-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition disabled:opacity-50"
                >
                  اقفلها على الجهاز ده
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={enablePush}
                disabled={pushBusy || !publicKey || pushSupported === null}
                className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {pushBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                🔔 فعّل الإشعارات على الجهاز ده
              </button>
            )}
          </div>
        )}
      </div>

      {/* Email digest */}
      <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
        <div>
          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-600" />
            <span>ملخص بالإيميل</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
            قايمة بالمشاريع الجديدة اللي طابقت فلاترك، مترتبة من الأنسب ليك
            {email && (
              <>
                {" "}
                على <bdi dir="ltr" className="font-bold text-slate-700">{email}</bdi>
              </>
            )}
            .
          </p>
        </div>

        {!emailConfigured ? (
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            إرسال الإيميل لسه مش متفعّل على السيرفر.
          </p>
        ) : (
          <fieldset className="flex flex-wrap gap-2" disabled={emailBusy}>
            <legend className="sr-only">عدد مرات الملخص</legend>
            {DIGEST_OPTIONS.map((o) => (
              <label
                key={o.id}
                title={o.hint}
                className={`cursor-pointer py-2 px-3.5 rounded-xl border text-xs font-bold transition ${
                  digest === o.id
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="email-digest"
                  value={o.id}
                  checked={digest === o.id}
                  onChange={() => saveDigest(o.id)}
                  className="sr-only"
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </>
  );
}
