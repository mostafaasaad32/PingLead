"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  Filter,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Briefcase,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import { getPlatformTheme, PlatformBadge, PlatformLogo } from "@/lib/platform-themes";

interface TrackedProject {
  id: string;
  project_id: string;
  status: "saved" | "applied" | "replied" | "won" | "ignored";
  generated_proposal?: string | null;
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
  applied: number;
  won: number;
  saved: number;
  proposals_generated: number;
  conversion_rate: number;
}

function getPlatformBadge(platform: string) {
  const p = (platform || "").toLowerCase();
  if (p === "mostaql") return { label: "مستقل", bg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" };
  if (p === "nafezly") return { label: "نفذلي", bg: "bg-sky-500/10 text-sky-300 border-sky-500/20" };
  if (p === "khamsat") return { label: "خمسات", bg: "bg-amber-500/10 text-amber-300 border-amber-500/20" };
  if (p === "kafiil") return { label: "كفيل", bg: "bg-purple-500/10 text-purple-300 border-purple-500/20" };
  if (p === "baeed") return { label: "بعيد", bg: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" };
  if (p === "freelancer") return { label: "فريلانسر (Freelancer)", bg: "bg-blue-500/10 text-blue-300 border-blue-500/20" };
  if (p === "wwr") return { label: "وي وورك ريموتلي (WeWorkRemotely)", bg: "bg-rose-500/10 text-rose-300 border-rose-500/20" };
  if (p === "remoteok") return { label: "ريموت أوك (RemoteOK)", bg: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20" };
  if (p === "pph") return { label: "بيبول بير أور (PeoplePerHour)", bg: "bg-orange-500/10 text-orange-300 border-orange-500/20" };
  return { label: platform.toUpperCase(), bg: "bg-gray-500/10 text-gray-300 border-gray-500/20" };
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
    applied: 0,
    won: 0,
    saved: 0,
    proposals_generated: 0,
    conversion_rate: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedProposalId, setExpandedProposalId] = useState<string | null>(null);

  const fetchTrackerData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tracker?status=${statusFilter}`);
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
  }, [statusFilter]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: newStatus as any } : item))
    );

    try {
      await fetch("/api/tracker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
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
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              متتبع العروض وإدارة الفرص
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
            لوحة تحكم مصغرة (Mini-CRM) لمتابعة المشاريع التي قمت بحفظها، العروض التي ولدها الذكاء
            الاصطناعي، ومعدل فوزك بالمشاريع عبر الـ 9 منصات.
          </p>
        </div>
      </div>

      {/* CRM Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#0b101e] border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 text-gray-300 flex items-center justify-center border border-white/10 font-bold">
            {metrics.total}
          </div>
          <div>
            <div className="text-base font-bold text-white">{metrics.total}</div>
            <div className="text-[11px] text-gray-400">إجمالي الفرص المرصودة</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b101e] border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20 font-bold">
            {metrics.applied}
          </div>
          <div>
            <div className="text-base font-bold text-sky-400">{metrics.applied}</div>
            <div className="text-[11px] text-gray-400">عروض تم التقديم عليها</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b101e] border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 font-bold">
            {metrics.won}
          </div>
          <div>
            <div className="text-base font-bold text-emerald-400">{metrics.won}</div>
            <div className="text-[11px] text-gray-400">مشاريع فائزة</div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0b101e] border border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 font-bold">
            {metrics.conversion_rate}%
          </div>
          <div>
            <div className="text-base font-bold text-amber-400">{metrics.conversion_rate}%</div>
            <div className="text-[11px] text-gray-400">معدل التقديم والتفاعل</div>
          </div>
        </div>
      </div>

      {/* Controls Bar: Filter Status & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/[0.02] p-3 rounded-xl border border-white/10">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "الكل" },
            { id: "saved", label: "المحفوظة" },
            { id: "applied", label: "تم التقديم" },
            { id: "replied", label: "العميل رد 💬" },
            { id: "won", label: "فائزة 🎉" },
            { id: "ignored", label: "مستبعدة" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/20"
                  : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في المشاريع..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pr-9 pl-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Tracked Projects List */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 text-xs">جاري تحميل سجل الـ CRM...</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
          <BarChart3 className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-xs text-gray-400">لا توجد مشاريع في هذه الفئة حالياً.</p>
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

                    {/* Actions & Status Dropdown */}
                    <div className="flex items-center gap-2 self-end sm:self-center flex-wrap">
                      {/* Status Selector */}
                      <select
                        value={item.status}
                        onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold focus:outline-none ${
                          item.status === "applied"
                            ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            : item.status === "replied"
                            ? "bg-violet-500/10 text-violet-300 border-violet-500/30"
                            : item.status === "won"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : item.status === "ignored"
                            ? "bg-gray-500/10 text-gray-400 border-gray-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        <option value="saved">💾 محفوظ</option>
                        <option value="applied">✅ تم التقديم</option>
                        <option value="replied">💬 العميل رد</option>
                        <option value="won">🎉 فوز بالمشروع</option>
                        <option value="ignored">🚫 مستبعد</option>
                      </select>

                      {item.generated_proposal && (
                        <button
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
                    </div>
                  </div>

                {/* Expanded Proposal Drawer */}
                {isExpanded && item.generated_proposal && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-indigo-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        نص العرض المولد بالذكاء الاصطناعي:
                      </span>

                      <button
                        onClick={() => handleCopyProposal(item.id, item.generated_proposal!)}
                        className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] px-2.5 py-1 rounded-md transition"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-300" />
                            <span>تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>نسخ العرض</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-xs text-gray-300 bg-black/40 p-3 rounded-lg border border-white/5 whitespace-pre-line leading-relaxed font-sans">
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
