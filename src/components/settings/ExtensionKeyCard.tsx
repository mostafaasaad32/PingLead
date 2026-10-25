"use client";

// Personal key for the PingLead Copilot browser extension (shown once when generated).

import { useEffect, useState } from "react";
import { KeyRound, Copy, Check, Loader2 } from "lucide-react";

export default function ExtensionKeyCard() {
  const [hasKey, setHasKey] = useState(false);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [available, setAvailable] = useState(true);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/extension/key")
      .then((r) => r.json())
      .then((data) => {
        if (!data?.ok) return;
        setAvailable(!data.migrationMissing);
        setHasKey(Boolean(data.hasKey));
        setCreatedAt(data.createdAt);
      })
      .catch(() => {});
  }, []);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/extension/key", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "تعذر إنشاء المفتاح");
      setNewKey(data.key);
      setHasKey(true);
      setCreatedAt(new Date().toISOString());
      setCopied(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    setBusy(true);
    await fetch("/api/extension/key", { method: "DELETE" }).catch(() => null);
    setHasKey(false);
    setNewKey(null);
    setCreatedAt(null);
    setBusy(false);
  };

  const copy = async () => {
    if (!newKey) return;
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
    } catch {
      setError("انسخ المفتاح يدوي من الخانة.");
    }
  };

  if (!available) return null;

  return (
    <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl space-y-3">
      <div>
        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-emerald-600" />
          <span>مفتاح إضافة المتصفح (PingLead Copilot)</span>
        </div>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          الإضافة بتستخدم المفتاح ده عشان تكتب عروض بملفك وأعمالك، وكل عرض بيخصم من رصيدك. حطه في إعدادات الإضافة. متشاركهوش مع
          حد: أي حد معاه المفتاح يقدر يولّد عروض على رصيدك.
        </p>
      </div>

      {newKey ? (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-amber-700">انسخه دلوقتي: مش هيظهر تاني.</p>
          <div className="flex items-stretch rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
            <code dir="ltr" className="flex-1 min-w-0 px-3 py-2 text-[11px] font-mono text-slate-800 overflow-x-auto whitespace-nowrap select-all">
              {newKey}
            </code>
            <button
              type="button"
              onClick={copy}
              className="px-3 text-[11px] font-bold text-emerald-700 bg-white border-r border-slate-200 hover:bg-emerald-50 transition flex items-center gap-1.5 shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? "اتنسخ" : "نسخ"}</span>
            </button>
          </div>
        </div>
      ) : hasKey ? (
        <p className="text-[11px] text-slate-600">
          عندك مفتاح شغال{createdAt ? ` من ${new Date(createdAt).toLocaleDateString("ar-EG")}` : ""}. لو ضاع منك، اعمل واحد جديد،
          والقديم هيتلغي.
        </p>
      ) : null}

      {error && <p className="text-[11px] text-rose-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {hasKey ? "اعمل مفتاح جديد (القديم هيتلغي)" : "اعمل مفتاح"}
        </button>
        {hasKey && (
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            className="py-2 px-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition disabled:opacity-50"
          >
            الغي المفتاح
          </button>
        )}
      </div>
    </div>
  );
}
