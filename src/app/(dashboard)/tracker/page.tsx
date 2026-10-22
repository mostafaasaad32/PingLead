"use client";

import { useEffect, useState } from "react";
import {
  Bookmark,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { getPlatformTheme, PlatformBadge, PlatformLogo } from "@/lib/platform-themes";

interface TrackedProject {
  id: string;
  project_id: string;
  status: "saved" | "applied" | "replied" | "won" | "ignored";
  generated_proposal?: string | null;
  notes?: string | null;
  title: string;
  description: string;
  url: string;
  platform: string;
  category: string;
  budget?: string | null;
  budget_usd_estimate?: number | null;
  published_at?: string;
  tracked_at?: string;
}

interface CrmMetrics {
  total: number;
  saved: number;
  proposals_generated: number;
}

function formatRelativeTime(dateStr?: string) {
  if (!dateStr) return "مؤخراً";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  return `منذ ${Math.floor(diffHours / 24)} يوم`;
}

export default function TrackerPage() {
  const [items, setItems] = useState<TrackedProject[]>([]);
  const [metrics, setMetrics] = useState<CrmMetrics>({
    total: 0,
    saved: 0,
    proposals_generated: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);

  const fetchTrackerData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tracker?status=saved`);
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackerData();
  }, []);

  const handleUnsaveProject = async (id: string, projectId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id && item.project_id !== projectId));
    setMetrics((prev) => ({
      ...prev,
      saved: Math.max(0, prev.saved - 1),
    }));

    try {
      await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, status: "ignored", notes: null }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCopyProposal = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      (item.description && item.description.toLowerCase().includes(q)) ||
      item.platform.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-orange-950/20 to-transparent p-6 rounded-2xl border border-white/10 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Bookmark className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              المشاريع المحفوظة ومتابعة الفرص
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
            قائمة بالمشاريع التي قمت بحفظها يدوياً من الرادار ومسودات العروض الذكية المُولدة عبر الذكاء الاصطناعي.
          </p>
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0b101e] border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 font-bold">
            {metrics.saved}
          </div>
          <div>
            <div className="text-base font-bold text-amber-400">{metrics.saved}</div>
            <div className="text-[11px] text-gray-400">مشاريع محفوظة</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b101e] border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 font-bold">
            {metrics.proposals_generated}
          </div>
          <div>
            <div className="text-base font-bold text-emerald-400">{metrics.proposals_generated}</div>
            <div className="text-[11px] text-gray-400">عروض تم توليدها</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b101e] border border-white/10 flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 font-bold">
            ⚡
          </div>
          <div>
            <div className="text-base font-bold text-sky-400">حفظ دائم</div>
            <div className="text-[11px] text-gray-400">مستثناة من الحذف التلقائي</div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Search */}
      <div className="flex items-center justify-between gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/10">
        <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
          <span>المشاريع المحفوظة</span>
          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
            {filteredItems.length}
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في المشاريع المحفوظة..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pr-9 pl-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Saved Projects List */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-xs">جاري تحميل المشاريع المحفوظة...</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
          <Bookmark className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-xs text-gray-400">لا توجد مشاريع محفوظة حالياً.</p>
          <p className="text-[11px] text-gray-500 mt-1">
            اضغط على زر الحفظ (🔖) في الرادار المباشر لحفظ المشاريع التي تهمك.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const theme = getPlatformTheme(item.platform);
            const isExpanded = expandedProposalId === item.id;

            return (
              <div
                key={item.id}
                className={`relative overflow-hidden rounded-xl bg-[#0b101e] border transition-all duration-200 shadow-sm ${theme.cardBorder} ${theme.cardHoverBorder} hover:shadow-md ${theme.cardGlow}`}
              >
                {/* Platform Top Accent Stripe */}
                <div className={`h-1 w-full bg-gradient-to-r ${theme.topStripeGradient}`} />

                <div className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Project Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <PlatformBadge platform={item.platform} />

                        {item.budget && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                            💰 {item.budget}
                          </span>
                        )}

                        <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(item.published_at)}
                        </span>

                        <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-medium">
                          📌 محفوظ
                        </span>
                      </div>

                      <h3 className="text-xs sm:text-sm font-bold text-white transition">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex items-center gap-1.5 ${theme.titleHover}`}
                        >
                          <span>{item.title}</span>
                          <ExternalLink className="w-3 h-3 opacity-60 inline" />
                        </a>
                      </h3>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                      {item.generated_proposal && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProposalId(isExpanded ? null : item.id)
                          }
                          className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition flex items-center gap-1"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-400" />
                          <span>عرض التقديم</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}

                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5"
                      >
                        <PlatformLogo platform={theme.id} size={13} />
                        <span>فتح في {theme.nameAr}</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => handleUnsaveProject(item.id, item.project_id)}
                        title="إلغاء الحفظ"
                        className="text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>إلغاء الحفظ</span>
                      </button>
                    </div>
                  </div>

                  {/* Generated Proposal Accordion */}
                  {item.generated_proposal && isExpanded && (
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-2 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between text-xs text-gray-300 font-bold">
                        <span className="flex items-center gap-1.5 text-indigo-300">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          العرض الذكي المُولد
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyProposal(item.id, item.generated_proposal!)}
                          className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300 flex items-center gap-1 text-[11px] transition border border-white/10"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ العرض</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-xs text-gray-300 whitespace-pre-line leading-relaxed font-sans">
                        {item.generated_proposal}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
