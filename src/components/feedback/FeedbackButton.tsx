"use client";

// Floating "رأيك" button on every dashboard page (beta feedback, migration 0021).

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquareText, X, Loader2 } from "lucide-react";

const KINDS = [
  { id: "bug", label: "🐞 مشكلة" },
  { id: "idea", label: "💡 اقتراح" },
  { id: "praise", label: "👍 حاجة عجبتني" },
  { id: "other", label: "💬 حاجة تانية" },
] as const;

type Kind = (typeof KINDS)[number]["id"];

export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("bug");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async () => {
    if (message.trim().length < 3) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, page: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error || "تعذر الإرسال");
      setMessage("");
      setResult({ ok: true, text: "وصلتنا، شكراً! بنقرا كل رسالة." });
      setTimeout(() => {
        setOpen(false);
        setResult(null);
      }, 1800);
    } catch (err: any) {
      setResult({ ok: false, text: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-40 left-4 bottom-4 flex items-center gap-1.5 rounded-full bg-slate-900 text-white text-xs font-bold px-4 py-2.5 shadow-lg hover:bg-slate-800 transition"
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)", marginLeft: "env(safe-area-inset-left, 0px)" }}
      >
        <MessageSquareText className="w-4 h-4" />
        <span>رأيك</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            dir="rtl"
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="feedback-title" className="text-sm font-extrabold text-slate-900">
                  قولّنا رأيك
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  PingLead لسه في التجربة. أي مشكلة أو فكرة بتفرق معانا جداً.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">نوع الرسالة</legend>
              {KINDS.map((k) => (
                <label
                  key={k.id}
                  className={`cursor-pointer text-[11px] font-bold px-3 py-1.5 rounded-full border transition ${
                    kind === k.id
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="feedback-kind"
                    value={k.id}
                    checked={kind === k.id}
                    onChange={() => setKind(k.id)}
                    className="sr-only"
                  />
                  {k.label}
                </label>
              ))}
            </fieldset>

            <div>
              <label htmlFor="feedback-message" className="sr-only">
                رسالتك
              </label>
              <textarea
                id="feedback-message"
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                rows={4}
                placeholder={
                  kind === "bug"
                    ? "إيه اللي حصل؟ وكنت متوقع يحصل إيه؟"
                    : kind === "idea"
                      ? "إيه اللي لو اتضاف هيفرق معاك؟"
                      : "اكتب اللي في بالك…"
                }
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-y"
              />
              <p className="text-[10px] text-slate-400 mt-1">الصفحة اللي انت فيها بتتبعت مع الرسالة عشان نفهم المشكلة.</p>
            </div>

            {result && (
              <p role="status" className={`text-[11px] font-bold ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>
                {result.text}
              </p>
            )}

            <button
              type="button"
              onClick={send}
              disabled={sending || message.trim().length < 3}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              ابعت
            </button>
          </div>
        </div>
      )}
    </>
  );
}
