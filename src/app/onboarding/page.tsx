"use client";

// ==============================================================================
// src/app/onboarding/page.tsx
// First-run setup: specialization -> skills -> Telegram -> first filter.
// Replaces the generic default filter (no keywords) that flooded new users.
// ==============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, Check, Copy, ExternalLink, Loader2, Plus, X } from "lucide-react";
import { CATEGORIES_METADATA } from "@/lib/scrapers/types";

const MAX_CATEGORIES = 3;
const POLL_INTERVAL_MS = 3000;

// Words clients actually write in projects (Arabic + the English tool names they use)
const SKILL_SUGGESTIONS: Record<string, string[]> = {
  web_mobile_dev: ["ووردبريس", "WordPress", "React", "Next.js", "Laravel", "PHP", "Flutter", "تطبيق جوال", "Node.js", "Python"],
  ai_data_automation: ["ذكاء اصطناعي", "ChatGPT", "بوت", "n8n", "أتمتة", "Python", "تحليل بيانات", "Excel", "Power BI", "scraping"],
  ui_ux_graphic: ["تصميم شعار", "هوية بصرية", "Figma", "UI/UX", "فوتوشوب", "Illustrator", "سوشيال ميديا", "بنر", "Canva"],
  video_audio_motion: ["مونتاج", "موشن جرافيك", "Premiere", "After Effects", "ريلز", "تعليق صوتي", "انيميشن"],
  digital_marketing_seo: ["تسويق", "إعلانات ممولة", "فيسبوك", "SEO", "إدارة صفحات", "Google Ads", "تيك توك"],
  writing_translation: ["كتابة محتوى", "مقالات", "ترجمة", "تدقيق لغوي", "copywriting", "تفريغ", "سيناريو"],
  business_accounting_legal: ["محاسبة", "قوائم مالية", "دراسة جدوى", "خطة عمل", "ضرائب", "عقود"],
  sales_customer_support: ["خدمة عملاء", "مساعد افتراضي", "إدخال بيانات", "مبيعات", "دعم فني"],
  engineering_architecture: ["أوتوكاد", "تصميم داخلي", "3D Max", "Revit", "رندر", "مخططات", "SketchUp"],
  it_cybersecurity_devops: ["سيرفر", "Linux", "Docker", "AWS", "أمن سيبراني", "شبكات", "VPS"],
  ecommerce_stores: ["سلة", "زد", "شوبيفاي", "ووكومرس", "متجر إلكتروني", "رفع منتجات", "دروب شيبينج"],
  education_training: ["تدريس", "شرح", "رياضيات", "بحث علمي", "إنجليزي", "حقيبة تدريبية"],
  game_ar_vr: ["Unity", "ألعاب", "Blender", "3D", "Unreal", "نمذجة"],
};

const STEPS = ["تخصصك", "مهاراتك", "تليجرام", "أول فلتر"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState("");
  const [title, setTitle] = useState("");
  const [minBudget, setMinBudget] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Telegram step
  const [connected, setConnected] = useState(false);
  const [connectLink, setConnectLink] = useState("");
  const [botUsername, setBotUsername] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectableCategories = CATEGORIES_METADATA.filter((c) => c.id !== "other");
  const suggestions = useMemo(
    () => Array.from(new Set(categories.flatMap((c) => SKILL_SUGGESTIONS[c] || []))),
    [categories]
  );
  const startCommand = connectLink.split("?start=")[1] ? `/start ${connectLink.split("?start=")[1]}` : "";

  const fetchConnection = useCallback(async () => {
    const res = await fetch("/api/telegram/connect", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setConnected(!!data.connected);
      setConnectLink(data.link || "");
      setBotUsername(data.botUsername || "");
    }
    return data as { connected?: boolean };
  }, []);

  useEffect(() => {
    fetchConnection().catch(() => {});
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [fetchConnection]);

  const waitForLink = () => {
    setWaiting(true);
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      const data = await fetchConnection().catch(() => ({ connected: false }));
      if (data.connected) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setWaiting(false);
      }
    }, POLL_INTERVAL_MS);
  };

  const toggleCategory = (id: string) => {
    setCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < MAX_CATEGORIES ? [...prev, id] : prev
    );
  };

  const toggleSkill = (skill: string) => {
    setSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  };

  const addCustomSkill = () => {
    const value = customSkill.trim();
    if (value && !skills.includes(value)) setSkills((prev) => [...prev, value]);
    setCustomSkill("");
  };

  const submit = async (skip = false) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(skip ? { skip: true } : { categories, skills, title, min_budget_usd: minBudget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر حفظ الإعداد");
      router.replace("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  };

  const canContinue = step === 0 ? categories.length > 0 : true;

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:py-14">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-black text-slate-900">PingLead</span>
          <button
            type="button"
            onClick={() => submit(true)}
            disabled={saving}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            تخطي الإعداد
          </button>
        </div>

        {/* Progress */}
        <ol className="grid grid-cols-4 gap-2" aria-label="خطوات الإعداد">
          {STEPS.map((label, i) => (
            <li key={label} className="space-y-1.5">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-emerald-600" : "bg-slate-200"}`} />
              <span className={`text-[11px] font-bold ${i === step ? "text-slate-900" : "text-slate-400"}`}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 space-y-5">
          {step === 0 && (
            <>
              <div>
                <h1 className="text-xl font-black text-slate-900">بتشتغل في إيه؟</h1>
                <p className="text-xs text-slate-500 mt-1">اختار لحد {MAX_CATEGORIES} تخصصات، وهنجيبلك مشاريعها من 9 منصات أول ما تنزل.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectableCategories.map((c) => {
                  const active = categories.includes(c.id);
                  const disabled = !active && categories.length >= MAX_CATEGORIES;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggleCategory(c.id)}
                      disabled={disabled}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-right transition ${
                        active
                          ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                          : "border-slate-200 hover:border-slate-300 text-slate-700"
                      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                    >
                      <span className="text-xl" aria-hidden="true">{c.icon}</span>
                      <span className="text-xs font-bold flex-1">{c.label_ar}</span>
                      {active && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h1 className="text-xl font-black text-slate-900">إيه مهاراتك؟</h1>
                <p className="text-xs text-slate-500 mt-1">
                  الـ AI هيستخدمها وهو بيكتب عروضك. مش هتقلّل المشاريع اللي بتوصلك: هيوصلك كل مشاريع تخصصك.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => {
                  const active = skills.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSkill(s)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                        active
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {active && <Check className="w-3 h-3 inline -mt-0.5 ml-1" />}
                      {s}
                    </button>
                  );
                })}
                {skills
                  .filter((s) => !suggestions.includes(s))
                  .map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSkill(s)}
                      className="px-3 py-1.5 rounded-full border bg-emerald-600 border-emerald-600 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      {s}
                      <X className="w-3 h-3" />
                    </button>
                  ))}
              </div>
              <div className="flex gap-2">
                <input
                  id="custom-skill"
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomSkill())}
                  placeholder="مهارة تانية… مثلاً: Shopify"
                  className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={addCustomSkill}
                  className="px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة
                </button>
              </div>
              <div>
                <label htmlFor="title" className="text-xs font-bold text-slate-700">
                  المسمى المهني <span className="font-normal text-slate-400">(اختياري)</span>
                </label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: مطور متاجر سلة وشوبيفاي"
                  className="mt-1.5 w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
              {skills.length === 0 && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  من غير مهارات هيوصلك كل مشاريع التخصص، وده ممكن يبقى كتير.
                </p>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <h1 className="text-xl font-black text-slate-900">اربط تليجرام</h1>
                <p className="text-xs text-slate-500 mt-1">
                  هنا بيوصلك المشروع أول ما ينزل، ومعاه زرار يكتبلك العرض بالـ AI.
                </p>
              </div>
              {connected ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-900">تليجرام مربوط بحسابك</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={!connectLink}
                    onClick={() => {
                      window.open(connectLink, "_blank", "noopener,noreferrer");
                      waitForLink();
                    }}
                    className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {waiting ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Bot className="w-4 h-4 text-emerald-400" />}
                    <span>{waiting ? "في انتظار ضغطك على Start…" : "افتح البوت واضغط Start"}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {startCommand && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-slate-500">
                        بتستخدم تليجرام ويب؟ ابعت الرسالة دي لـ <b dir="ltr">@{botUsername}</b>:
                      </p>
                      <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
                        <code dir="ltr" className="flex-1 min-w-0 px-3 py-2 text-[11px] font-mono overflow-x-auto whitespace-nowrap select-all">
                          {startCommand}
                        </code>
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(startCommand).catch(() => {});
                            setCopied(true);
                            setTimeout(() => setCopied(false), 2000);
                            if (!waiting) waitForLink();
                          }}
                          className="px-3 text-[11px] font-bold text-emerald-700 bg-white border-r border-slate-200 flex items-center gap-1"
                        >
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? "تم" : "نسخ"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <h1 className="text-xl font-black text-slate-900">فلترك الأول جاهز</h1>
                <p className="text-xs text-slate-500 mt-1">تقدر تعدّله أو تعمل فلاتر تانية في أي وقت من صفحة الفلاتر.</p>
              </div>
              <dl className="divide-y divide-slate-100 border border-slate-200 rounded-xl text-xs">
                <div className="flex justify-between gap-4 p-3">
                  <dt className="text-slate-500">التخصصات</dt>
                  <dd className="font-bold text-slate-900 text-left">
                    {categories.map((c) => CATEGORIES_METADATA.find((m) => m.id === c)?.label_ar).join("، ")}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 p-3">
                  <dt className="text-slate-500">المشاريع</dt>
                  <dd className="font-bold text-slate-900 text-left">كل المشاريع الجديدة في تخصصك</dd>
                </div>
                <div className="flex justify-between gap-4 p-3">
                  <dt className="text-slate-500">مهاراتك (للعروض)</dt>
                  <dd className="font-bold text-slate-900 text-left">{skills.length ? skills.join("، ") : "—"}</dd>
                </div>
                <div className="flex justify-between gap-4 p-3">
                  <dt className="text-slate-500">المنصات</dt>
                  <dd className="font-bold text-slate-900">6 منصات فريلانس (عربي وعالمي)</dd>
                </div>
                <div className="flex justify-between gap-4 p-3">
                  <dt className="text-slate-500">التنبيهات</dt>
                  <dd className="font-bold text-slate-900">{connected ? "تليجرام ✅" : "اربط تليجرام بعدين من الإعدادات"}</dd>
                </div>
              </dl>
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="min-budget" className="text-xs font-bold text-slate-700">أقل ميزانية للمشروع</label>
                  <span className="text-xs font-bold text-emerald-700" dir="ltr">{minBudget === 0 ? "أي ميزانية" : `$${minBudget}+`}</span>
                </div>
                <input
                  id="min-budget"
                  type="range"
                  min={0}
                  max={500}
                  step={25}
                  value={minBudget}
                  onChange={(e) => setMinBudget(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-600 mt-2"
                />
              </div>
            </>
          )}

          {error && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</p>}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:invisible"
            >
              رجوع
            </button>
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-40"
              >
                {step === 2 && !connected ? "بعدين، كمّل" : "التالي"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                ابدأ استقبال المشاريع
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
