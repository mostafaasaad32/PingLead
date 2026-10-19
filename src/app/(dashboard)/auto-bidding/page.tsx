"use client";

import { useEffect, useState } from "react";
import {
  Zap,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  X,
  Plus,
  Trash2,
  AlertCircle,
  Eye,
  TrendingUp,
  FileText,
  Paperclip,
  RotateCcw,
  SlidersHorizontal,
  Bot,
  Percent,
} from "lucide-react";
import { SmartAttachment } from "@/lib/auto-bidder/engine";

interface AutoBidQueueItem {
  id: string;
  match_score: number;
  status: "pending_review" | "approved" | "rejected" | "auto_sent";
  generated_proposal: string;
  template_name?: string | null;
  template_variant?: string | null;
  selected_attachment?: SmartAttachment | null;
  title: string;
  platform: string;
  budget?: string | null;
  platform_url: string;
  created_at: string;
}

interface ProposalTemplateOption {
  id: string;
  name: string;
  hourly_rate?: number | null;
}

const DAYS_OF_WEEK = [
  { id: "saturday", label: "السبت" },
  { id: "sunday", label: "الأحد" },
  { id: "monday", label: "الاثنين" },
  { id: "tuesday", label: "الثلاثاء" },
  { id: "wednesday", label: "الأربعاء" },
  { id: "thursday", label: "الخميس" },
  { id: "friday", label: "الجمعة" },
];

export default function AutoBiddingPage() {
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Stats & State
  const [isEnabled, setIsEnabled] = useState(false);
  const [todayBidsCount, setTodayBidsCount] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [minMatchScore, setMinMatchScore] = useState(80);
  const [scheduleStart, setScheduleStart] = useState(8);
  const [scheduleEnd, setScheduleEnd] = useState(23);
  const [activeDays, setActiveDays] = useState<string[]>([
    "saturday",
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]);
  const [reviewMode, setReviewMode] = useState<"require_approval" | "full_auto">(
    "require_approval"
  );
  const [abTestingEnabled, setAbTestingEnabled] = useState(false);
  const [templateAId, setTemplateAId] = useState<string>("");
  const [templateBId, setTemplateBId] = useState<string>("");
  const [smartDelay, setSmartDelay] = useState(5);
  const [smartAttachments, setSmartAttachments] = useState<SmartAttachment[]>([]);

  // A/B stats
  const [abStats, setAbStats] = useState({
    variant_a: { total: 0, approved: 0, rate: 0 },
    variant_b: { total: 0, approved: 0, rate: 0 },
  });

  // Pre-Screening Queue
  const [queue, setQueue] = useState<AutoBidQueueItem[]>([]);
  const [templates, setTemplates] = useState<ProposalTemplateOption[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New Attachment Modal
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [newAttTitle, setNewAttTitle] = useState("");
  const [newAttUrl, setNewAttUrl] = useState("");
  const [newAttConditions, setNewAttConditions] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch Config, Queue & Templates
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Config
      const configRes = await fetch("/api/auto-bidding/config");
      const configData = await configRes.json();
      if (configData.ok && configData.config) {
        const c = configData.config;
        setIsEnabled(c.is_enabled ?? false);
        setMinMatchScore(c.min_match_score ?? 80);
        setScheduleStart(c.schedule_start_hour ?? 8);
        setScheduleEnd(c.schedule_end_hour ?? 23);
        setActiveDays(c.active_days ?? []);
        setReviewMode(c.review_mode ?? "require_approval");
        setAbTestingEnabled(c.ab_testing_enabled ?? false);
        setTemplateAId(c.template_a_id || "");
        setTemplateBId(c.template_b_id || "");
        setDailyLimit(c.daily_limit ?? 10);
        setSmartDelay(c.smart_delay_minutes ?? 5);
        setSmartAttachments(c.smart_attachments || []);
        setTodayBidsCount(configData.today_bids_count || 0);
        if (configData.ab_stats) setAbStats(configData.ab_stats);
      }

      // 2. Fetch Queue
      const queueRes = await fetch("/api/auto-bidding/queue?status=pending_review");
      const queueData = await queueRes.json();
      if (queueData.ok) {
        setQueue(queueData.queue || []);
      }

      // 3. Fetch Templates
      const tplRes = await fetch("/api/templates");
      const tplData = await tplRes.json();
      if (tplData.ok && Array.isArray(tplData.templates)) {
        setTemplates(tplData.templates);
      }
    } catch (err) {
      console.error("Error loading auto-bidding data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Configuration to Supabase
  const handleSaveConfig = async (overrideEnabled?: boolean) => {
    setSavingConfig(true);
    const targetEnabled =
      typeof overrideEnabled === "boolean" ? overrideEnabled : isEnabled;

    const payload = {
      is_enabled: targetEnabled,
      min_match_score: minMatchScore,
      schedule_start_hour: scheduleStart,
      schedule_end_hour: scheduleEnd,
      active_days: activeDays,
      review_mode: reviewMode,
      ab_testing_enabled: abTestingEnabled,
      template_a_id: templateAId || null,
      template_b_id: templateBId || null,
      daily_limit: dailyLimit,
      smart_delay_minutes: smartDelay,
      smart_attachments: smartAttachments,
    };

    try {
      const res = await fetch("/api/auto-bidding/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        showToast("تم حفظ إعدادات الأتمتة بنجاح في قاعدة البيانات!");
      } else {
        alert(data.error || "فشل حفظ الإعدادات");
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء الحفظ: " + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle Activation Button
  const handleToggleActivation = async () => {
    const nextState = !isEnabled;
    setIsEnabled(nextState);
    await handleSaveConfig(nextState);
  };

  // Generate the proposal for one queued project (the only place the AI runs; 1 credit)
  const handleGenerate = async (item: AutoBidQueueItem) => {
    setGeneratingId(item.id);
    try {
      const res = await fetch("/api/auto-bidding/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", id: item.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.proposal) {
        showToast("⚠️ " + (data.error || "تعذر توليد العرض"));
        return;
      }
      setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, generated_proposal: data.proposal } : q)));
      showToast(
        typeof data.remaining_credits === "number"
          ? `✍️ العرض جاهز. رصيدك المتبقي: ${data.remaining_credits}`
          : "✍️ العرض جاهز"
      );
    } catch {
      showToast("⚠️ تعذر الاتصال بمولد العروض.");
    } finally {
      setGeneratingId(null);
    }
  };

  // Copy the proposal, mark as applied, and open the project page (the user submits it)
  const handleApprove1Click = async (item: AutoBidQueueItem) => {
    setProcessingId(item.id);

    try {
      // 1. Copy proposal to clipboard
      await navigator.clipboard.writeText(item.generated_proposal);
      setCopiedId(item.id);

      // 2. Approve via API
      const res = await fetch("/api/auto-bidding/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", id: item.id }),
      });

      const data = await res.json();
      if (data.ok) {
        // Remove from pending queue
        setQueue((prev) => prev.filter((q) => q.id !== item.id));
        setTodayBidsCount((prev) => prev + 1);

        showToast("🚀 تم نسخ العرض والموافقة! جاري فتح صفحة المشروع لتقديمه فوراً...");

        // 3. Open project page in new tab
        window.open(item.platform_url, "_blank");
      } else {
        alert(data.error || "فشلت الموافقة على العرض");
      }
    } catch (err: any) {
      alert("حدث خطأ: " + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Reject / Skip Queue Item
  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await fetch("/api/auto-bidding/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", id }),
      });
      if (res.ok) {
        setQueue((prev) => prev.filter((q) => q.id !== id));
        showToast("تم تخطي العرض بنجاح.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProcessingId(null);
    }
  };

  // Toggle Active Day
  const toggleDay = (dayId: string) => {
    setActiveDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  // Add Smart Attachment
  const handleAddAttachment = () => {
    if (!newAttTitle.trim() || !newAttUrl.trim()) return;

    const newAtt: SmartAttachment = {
      id: "att-" + Date.now(),
      title: newAttTitle.trim(),
      url_or_file: newAttUrl.trim(),
      trigger_conditions: newAttConditions.trim() || undefined,
    };

    setSmartAttachments((prev) => [...prev, newAtt]);
    setNewAttTitle("");
    setNewAttUrl("");
    setNewAttConditions("");
    setShowAttachmentModal(false);
    showToast("تمت إضافة المرفق الذكي بنجاح. اضغط حفظ الإعدادات لتثبيته.");
  };

  // Delete Smart Attachment
  const handleDeleteAttachment = (id: string) => {
    setSmartAttachments((prev) => prev.filter((a) => a.id !== id));
    showToast("تم مسح المرفق.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-3 border border-emerald-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: HERO & QUICK ACTIVATION BAR                                    */}
      {/* ========================================================================= */}
      <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-lg shadow-slate-900/10 shrink-0">
              <Zap className="w-7 h-7 fill-emerald-400 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  أتمتة صيد المشاريع وتوليد العروض على مدار الساعة
                </h1>
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  نظام التقديم الآلي الذكي
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1.5 max-w-2xl leading-relaxed">
                محرك ذكي متوافق 100% مع معايير الأمان، يحلل المشاريع فور نشرها ويصيغ عروضاً مخصصة مع الاستشهاد بسابقة أعمالك، لتكون أول من يقدم في أقل من دقيقة.
              </p>
            </div>
          </div>

          {/* Quick Activation & Daily Stats */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 self-start lg:self-auto">
            <div className="px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center sm:text-right">
              <span className="text-[10px] text-slate-400 font-bold block">
                عروض اليوم الآلية
              </span>
              <div className="flex items-baseline justify-center sm:justify-start gap-1 font-mono mt-0.5">
                <span className="text-lg font-black text-slate-900">
                  {todayBidsCount}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  / {dailyLimit} حد يومي
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleActivation}
              disabled={savingConfig}
              className={`py-3 px-6 rounded-2xl font-extrabold text-xs transition shadow-md flex items-center justify-center gap-2 ${
                isEnabled
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                  : "bg-slate-900 hover:bg-slate-800 text-white"
              }`}
            >
              <Zap
                className={`w-4 h-4 ${
                  isEnabled ? "fill-white" : "text-emerald-400"
                }`}
              />
              <span>
                {isEnabled ? "نظام الأتمتة: مفعّل" : "تفعيل نظام الأتمتة"}
              </span>
            </button>
          </div>
        </div>

        {/* Pre-Screening Queue (The Vollna 1-Click Approval Queue) */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-slate-900">
                طابور المراجعة السريعة للعروض الجاهزة
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
                {queue.length} عروض تنتظر موافقتك
              </span>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              اضغط على الزر الأخضر لنسخ العرض فوراً وفتح صفحة المشروع لتقديمه بنقرة واحدة!
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">جاري فحص الطابور...</p>
            </div>
          ) : queue.length === 0 ? (
            <div className="p-8 text-center bg-slate-50/70 rounded-2xl border border-slate-100">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-slate-700">الطابور فارغ حالياً — كل شيء تحت السيطرة!</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                عندما يرصد الرادار مشروعاً جديداً يتجاوز {minMatchScore}% توافق، سيظهر هنا. ولّد العرض بالـ AI بضغطة، راجعه، وقدّم بنفسك.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {queue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/90 hover:border-slate-300 transition flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-emerald-400 uppercase">
                        {item.platform}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                        {item.match_score}% درجة التوافق
                      </span>
                      {item.template_variant && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                          قالب {item.template_variant} ({item.template_name || "مخصص"})
                        </span>
                      )}
                      {item.selected_attachment && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          <span>{item.selected_attachment.title}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      <a
                        href={item.platform_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-emerald-700 transition"
                      >
                        {item.title}
                      </a>
                    </h3>

                    {item.generated_proposal ? (
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-white p-2.5 rounded-xl border border-slate-100 whitespace-pre-line">
                        {item.generated_proposal}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-500 bg-white p-2.5 rounded-xl border border-dashed border-slate-200">
                        العرض لسه متكتبش. اضغط «ولّد العرض» لما تقرر تقدّم (رصيد واحد).
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReject(item.id)}
                      disabled={processingId === item.id || generatingId === item.id}
                      className="py-2.5 px-3.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>تخطي</span>
                    </button>

                    {item.generated_proposal ? (
                      <button
                        type="button"
                        onClick={() => handleApprove1Click(item)}
                        disabled={processingId === item.id}
                        className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
                      >
                        <Zap className="w-3.5 h-3.5 fill-white" />
                        <span>{processingId === item.id ? "جاري المعالجة..." : "📋 انسخ العرض وافتح المشروع"}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleGenerate(item)}
                        disabled={generatingId === item.id}
                        className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-60"
                      >
                        <span>{generatingId === item.id ? "جاري كتابة العرض..." : "✍️ ولّد العرض بالـ AI"}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: INTERACTIVE CONTROL PANEL                                      */}
      {/* ========================================================================= */}
      <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100 mb-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
              <span>لوحة التحكم في قواعد الأتمتة</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              اضبط معايير الفلترة، ساعات العمل، اختبارات A/B، ومرفقات سابقة الأعمال بدقة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleSaveConfig()}
            disabled={savingConfig}
            className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition self-start sm:self-auto"
          >
            {savingConfig ? "جاري الحفظ..." : "حفظ التعديلات في Supabase"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Rule 1: AI Job Scoring */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-600" />
                <span>1. فحص ملاءمة المشروع (درجة التوافق)</span>
              </span>
              <span className="text-xs font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-lg font-mono">
                {minMatchScore}% فأعلى
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              يقوم المحرك بتقدير مدى تطابق المشروع مع خبرتك قبل كتابة أي عرض لحماية رصيدك من الهدر.
            </p>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={minMatchScore}
              onChange={(e) => setMinMatchScore(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-bold">
              <span>50% (متساهل)</span>
              <span>80% (موصى به)</span>
              <span>95% (دقيق وصارم جداً)</span>
            </div>
          </div>

          {/* Rule 2: Smart Scheduling */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>2. الجدولة وساعات العمل اليومية</span>
              </span>
              <span className="text-[10px] font-bold text-slate-500 font-mono">
                {scheduleStart}:00 إلى {scheduleEnd}:00
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              تحديد ساعات وأيام التشغيل حتى لا تُرسل عروض في أوقات نومك أو إجازتك.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  بداية العمل (صباحاً)
                </label>
                <select
                  value={scheduleStart}
                  onChange={(e) => setScheduleStart(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {i < 10 ? `0${i}:00` : `${i}:00`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  نهاية العمل (مساءً)
                </label>
                <select
                  value={scheduleEnd}
                  onChange={(e) => setScheduleEnd(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {i < 10 ? `0${i}:00` : `${i}:00`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Active Days */}
            <div className="flex items-center gap-1 flex-wrap pt-1">
              {DAYS_OF_WEEK.map((d) => {
                const isActive = activeDays.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDay(d.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                      isActive
                        ? "bg-slate-900 text-emerald-400"
                        : "bg-white text-slate-400 border border-slate-200"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rule 3: A/B Testing */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>3. اختبار القوالب وتدوير الصياغات (A/B)</span>
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={abTestingEnabled}
                  onChange={(e) => setAbTestingEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              المقارنة التلقائية بين أداء قالبين مختلفين لمعرفة أي صياغة تحقق نسبة قبول ومحادثات أعلى.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  القالب الأول (النموذج أ)
                </label>
                <select
                  value={templateAId}
                  onChange={(e) => setTemplateAId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                >
                  <option value="">(افتراضي الرادار)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  معدل الاعتماد: {abStats.variant_a.rate}% ({abStats.variant_a.approved} موافقات)
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  القالب الثاني (النموذج ب)
                </label>
                <select
                  value={templateBId}
                  onChange={(e) => setTemplateBId(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs"
                >
                  <option value="">(اختر قالب للمقارنة)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  معدل الاعتماد: {abStats.variant_b.rate}% ({abStats.variant_b.approved} موافقات)
                </span>
              </div>
            </div>
          </div>

          {/* Rule 4: Daily Limits & Smart Delays */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <span>4. الحدود اليومية ومحاكاة السلوك البشري</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              وضع فواصل زمنية ذكية بين العروض لمنع أي اشتباه بحسابك من أنظمة المنصات.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  الحد الأقصى للعروض يومياً ({dailyLimit} عرض)
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  فاصل التأخير الذكي ({smartDelay} دقائق)
                </label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={smartDelay}
                  onChange={(e) => setSmartDelay(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Review Mode Toggle */}
            {/* Proposals are never sent automatically: Arab platforms have no official way to
                submit for the user, and automated submissions can get accounts banned. */}
            <div className="pt-2 border-t border-slate-200">
              <span className="text-xs font-bold text-slate-800">المراجعة قبل التقديم:</span>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                دايماً انت اللي بتقدّم. الإرسال التلقائي ممكن يقفل حسابك على المنصات، عشان كده العرض بيتجهز ويستناك.
              </p>
            </div>
          </div>
        </div>

        {/* Rule 5: Smart Attachments Vault */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-emerald-600" />
                <span>مستودع المرفقات وسابقة الأعمال الذكية</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                أضف روابط سابقة أعمالك أو ملفات PDF مع تحديد الكلمات المفتاحية ليقوم الـ AI بإرفاقها عند التطابق.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowAttachmentModal(true)}
              className="py-1.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مرفق ذكي</span>
            </button>
          </div>

          {smartAttachments.length === 0 ? (
            <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">
              لم تتم إضافة أي مرفقات بعد. أضف روابط مشاريعك السابقة لتعزيز فرص فوزك بالعروض.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {smartAttachments.map((att) => (
                <div
                  key={att.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-start justify-between gap-2"
                >
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {att.title}
                    </span>
                    <a
                      href={att.url_or_file}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-emerald-700 hover:underline block truncate max-w-[200px]"
                    >
                      {att.url_or_file}
                    </a>
                    {att.trigger_conditions && (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded block truncate">
                        الشرط: {att.trigger_conditions}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAttachment(att.id)}
                    className="p-1 rounded text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: SAFETY, CONTROL & POWER FEATURES GRID (4 COLUMNS / VOLLNA)     */}
      {/* ========================================================================= */}
      <div>
        <div className="text-center mb-6">
          <h2 className="text-lg font-black text-slate-900">
            لماذا صُمم نظام الأتمتة ليكون الأقوى والأكثر أماناً؟
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تمت هندسة PingLead Auto-Bidding ليمنحك قوة وسرعة الذكاء الاصطناعي دون تعريض حساباتك للخطر.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 mb-1">
                أمان تام دون كلمات مرور
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                لا نطلب أبداً كلمات مرور حساباتك في مستقل أو خمسات أو نفذلي، ونلتزم بأعلى معايير الحماية لضمان سلامة حساباتك 100%.
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center mb-3">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 mb-1">
                تقييم ذكي لملاءمة المشاريع
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                تقييم فوري لملاءمة المشروع لخبراتك قبل كتابة العرض حتى لا تضيع وقتك ورصيدك على مشاريع غير مناسبة.
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 fill-blue-600" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 mb-1">
                مراجعة واعتماد بنقرة واحدة
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                تصلك العروض الجاهزة على تليجرام أو لوحة التحكم، وبنقرة زر واحدة يُنسخ العرض وتُفتح صفحة المشروع لتقديمه فوراً.
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-slate-900 mb-1">
                تحليلات واختبارات مقارنة للأداء
              </h3>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                اختبر أكثر من أسلوب في الصياغة والتسعير لتعرف أي القوالب يحقق لك أعلى نسبة ردود وتوظيف من أصحاب المشاريع.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Attachment Modal */}
      {showAttachmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-emerald-600" />
                <span>إضافة مرفق ذكي جديد</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAttachmentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  اسم أو عنوان المرفق
                </label>
                <input
                  type="text"
                  placeholder="مثال: معرض نماذج المواقع والمتاجر"
                  value={newAttTitle}
                  onChange={(e) => setNewAttTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  رابط المرفق أو الملف الحي (URL)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... أو https://myportfolio.com"
                  value={newAttUrl}
                  onChange={(e) => setNewAttUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 text-left dir-ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  شروط الإرفاق التلقائي (كلمات مفتاحية)
                </label>
                <input
                  type="text"
                  placeholder="Next.js, متجر, شوبيفاي, React"
                  value={newAttConditions}
                  onChange={(e) => setNewAttConditions(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <span className="text-[10px] text-slate-400">
                  إذا احتوى المشروع على أي من هذه الكلمات، سيتم تضمين هذا المرفق بالعرض.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAttachmentModal(false)}
                  className="py-2 px-4 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
