"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ExternalLink,
  Filter,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  TrendingUp,
  Layers,
  RefreshCw,
  Clock,
  DollarSign,
  X,
  Send,
  Bookmark,
  BookmarkCheck,
  Download,
  BarChart3,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Award,
  Globe,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PLATFORMS_METADATA,
  CATEGORIES_METADATA,
  type ProjectInsights,
  extractTitleFromPostText,
  extractDetailsFromPostText,
} from "@/lib/scrapers/types";
import { getCompetitionVerdict, getClientVerdict } from "@/lib/insights/competition";
import type { ProjectPricing } from "@/lib/insights/pricing";
import { isCategoryMatch } from "@/lib/filters/categorizer";

interface Lead {
  id: string;
  platform: string;
  external_post_id?: string;
  author_handle?: string;
  post_text: string;
  post_url: string;
  category_slug?: string;
  intent_score?: number;
  is_buyer?: boolean;
  ai_reason_short?: string;
  status?: string;
  published_at: string;
  insights?: ProjectInsights | null;
  pricing?: ProjectPricing | null;
}

const COMPETITION_CHIP_STYLES: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-800 border-emerald-200/70",
  medium: "bg-amber-50 text-amber-800 border-amber-200/70",
  high: "bg-red-50 text-red-700 border-red-200/70",
};

const CLIENT_CHIP_STYLES: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-800 border-emerald-200/70",
  medium: "bg-slate-50 text-slate-700 border-slate-200",
  low: "bg-red-50 text-red-700 border-red-200/70",
  new: "bg-sky-50 text-sky-800 border-sky-200/70",
  unknown: "bg-slate-50 text-slate-700 border-slate-200",
};

function InsightChips({
  insights,
  pricing,
}: {
  insights?: ProjectInsights | null;
  pricing?: ProjectPricing | null;
}) {
  const suggestion = pricing?.suggestion;
  if (!insights && !suggestion) return null;
  const competition = getCompetitionVerdict(insights || {});
  const client = getClientVerdict(insights || {});
  const clientText = [client.label, ...client.details].filter(Boolean).join(" · ");

  if (competition.level === "unknown" && !clientText && !insights?.duration_text && !suggestion) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {suggestion && (
        <span
          className="text-[11px] font-bold px-2 py-0.5 rounded-md border bg-violet-50 text-violet-800 border-violet-200/70"
          title={suggestion.reasons.join(" · ")}
        >
          💡 مقترح: {suggestion.priceUsd}$
          {suggestion.priceEgpText ? ` (${suggestion.priceEgpText})` : ""} في {suggestion.daysText}
        </span>
      )}
      {competition.level !== "unknown" && (
        <span
          className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${COMPETITION_CHIP_STYLES[competition.level]}`}
          title={insights?.bids_avg ? `متوسط العروض $${insights.bids_avg}` : undefined}
        >
          {competition.emoji} {competition.label} · {competition.advice}
        </span>
      )}
      {clientText && (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${CLIENT_CHIP_STYLES[client.level]}`}>
          {client.emoji} {clientText}
        </span>
      )}
      {insights?.duration_text && (
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-slate-50 text-slate-700 border-slate-200">
          ⏳ {insights.duration_text}
        </span>
      )}
    </div>
  );
}

interface TrackedProjectAction {
  id: string;
  project_id: string;
  status: "saved" | "applied" | "ignored" | "won";
  generated_proposal?: string | null;
  notes?: string | null;
}

type DashboardSubTab = "live_overview" | "proposals" | "saved_jobs" | "statistics";

function formatLeadDate(dateStr: string): { relative: string; exact: string } {
  if (!dateStr) return { relative: "الآن", exact: "" };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { relative: dateStr, exact: "" };

  const exact = d.toLocaleString("ar-EG-u-nu-latn", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = "";
  if (diffMins < 2) relative = "منذ دقيقة";
  else if (diffMins < 60) relative = `منذ ${diffMins} دقيقة`;
  else if (diffHours === 1) relative = "منذ ساعة";
  else if (diffHours === 2) relative = "منذ ساعتين";
  else if (diffHours < 11) relative = `منذ ${diffHours} ساعات`;
  else if (diffHours < 24) relative = `منذ ${diffHours} ساعة`;
  else if (diffDays === 1) relative = "منذ يوم";
  else if (diffDays === 2) relative = "منذ يومين";
  else if (diffDays < 11) relative = `منذ ${diffDays} أيام`;
  else relative = `منذ ${diffDays} يوم`;

  return { relative, exact };
}

function extractBudgetBadge(text: string): string | null {
  if (!text) return null;
  const match = text.match(/الميزانية:\s*([^\n\r]+)/i);
  if (match && match[1]) return match[1].trim();
  const general = text.match(/(?:[$€£]\s*\d+[\s\d\-–toإلى$€£]+|\d+\s*(?:USD|SAR|EGP|درهم|ريال|دولار))/i);
  if (general) return general[0].trim();
  return null;
}

export default function DashboardPage() {
  const supabase = createClient();

  // Tab State
  const [currentTab, setCurrentTab] = useState<DashboardSubTab>("live_overview");
  const [statusFilter, setStatusFilter] = useState<"all" | "saved" | "applied" | "won">("all");

  // Leads & CRM Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trackedActions, setTrackedActions] = useState<Record<string, TrackedProjectAction>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [onlyHighIntent, setOnlyHighIntent] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync state
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [scanning, setScanning] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [autoSync, setAutoSync] = useState(true);

  // Proposal modal state
  const [proposalModalLead, setProposalModalLead] = useState<Lead | null>(null);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState("");
  const [proposalCopied, setProposalCopied] = useState(false);

  // User Profile
  const [userCredits, setUserCredits] = useState<number>(25);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch leads from database
  async function fetchLeads(isSilent = false) {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch("/api/leads?limit=300&sort_by=newest");
      const data = await res.json();
      if (data.ok && Array.isArray(data.leads)) {
        setLeads(data.leads);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }

  // 2. Fetch user project actions (CRM) from Supabase
  async function fetchActions() {
    try {
      const res = await fetch("/api/tracker");
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        const map: Record<string, TrackedProjectAction> = {};
        data.items.forEach((item: any) => {
          map[item.project_id] = {
            id: item.id,
            project_id: item.project_id,
            status: item.status,
            generated_proposal: item.generated_proposal,
            notes: item.notes,
          };
        });
        setTrackedActions(map);
      }
    } catch (err) {
      console.error("Error loading CRM actions:", err);
    }
  }

  // 3. Load user credits
  async function loadUserCredits() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await (supabase
        .from("freelancer_profiles") as any)
        .select("ai_credits")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prof && typeof prof.ai_credits === "number") {
        setUserCredits(prof.ai_credits);
      }
    }
  }

  useEffect(() => {
    fetchLeads(false);
    fetchActions();
    loadUserCredits();
  }, []);

  // Countdown timer for auto-sync
  useEffect(() => {
    if (!autoSync) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchLeads(true);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [autoSync]);

  // Handle Manual Scan
  const handleScanNow = async () => {
    setScanning(true);
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        showToast("اكتمل سحب وتحديث المشاريع من 20 منصة بنجاح!");
        await fetchLeads(false);
      } else {
        showToast("⚠️ " + (data.error || "خطأ أثناء السحب"));
      }
    } catch (e) {
      showToast("حدث خطأ في الاتصال بالرادار.");
    } finally {
      setScanning(false);
    }
  };

  // Handle Save / Bookmark Lead
  const handleToggleSaveLead = async (lead: Lead) => {
    const currentAction = trackedActions[lead.id];
    const newStatus = currentAction?.status === "saved" ? "ignored" : "saved";

    // Optimistic update
    setTrackedActions((prev) => ({
      ...prev,
      [lead.id]: {
        id: currentAction?.id || lead.id,
        project_id: lead.id,
        status: newStatus as any,
      },
    }));

    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: lead.id,
          status: newStatus,
        }),
      });

      if (res.ok) {
        showToast(
          newStatus === "saved"
            ? "تم حفظ المشروع في قائمة المشاريع المحفوظة بنجاح"
            : "تمت إزالة المشروع من المحفوظات"
        );
      }
    } catch (e) {
      fetchActions();
    }
  };

  // Handle Change Project Status (Applied, Won, etc.)
  const handleChangeStatus = async (
    leadId: string,
    newStatus: "saved" | "applied" | "won" | "ignored"
  ) => {
    setTrackedActions((prev) => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || { id: leadId, project_id: leadId }),
        status: newStatus,
      },
    }));

    try {
      await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: leadId, status: newStatus }),
      });
      const statusLabel =
        newStatus === "saved"
          ? "محفوظ"
          : newStatus === "applied"
          ? "تم التقديم"
          : newStatus === "won"
          ? "تم الفوز"
          : "مستبعد";
      showToast(`تم تحديث حالة المشروع إلى: ${statusLabel}`);
    } catch (e) {
      fetchActions();
    }
  };

  // Open Proposal Modal & Generate Proposal
  const handleOpenProposalModal = async (lead: Lead) => {
    setProposalModalLead(lead);
    setProposalCopied(false);
    setGeneratedProposal("");
    setGeneratingProposal(true);

    try {
      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: lead.id,
          project_title: extractTitleFromPostText(lead.post_text) || "مشروع عمل حر",
          project_description: extractDetailsFromPostText(lead.post_text),
        }),
      });

      const data = await res.json();
      if (data.ok && data.proposal) {
        setGeneratedProposal(data.proposal);
        if (typeof data.remaining_credits === "number") {
          setUserCredits(data.remaining_credits);
        }
        // Update status in CRM as applied
        setTrackedActions((prev) => ({
          ...prev,
          [lead.id]: {
            id: data.action_id || lead.id,
            project_id: lead.id,
            status: "applied",
            generated_proposal: data.proposal,
          },
        }));
        showToast("تم توليد العرض الذكي وحفظ حالة التقديم في Supabase!");
      } else {
        setGeneratedProposal("⚠️ تعذر توليد العرض: " + (data.error || "يرجى مراجعة الرصيد"));
      }
    } catch (err: any) {
      setGeneratedProposal("حدث خطأ في الاتصال بمولد العروض الذكي.");
    } finally {
      setGeneratingProposal(false);
    }
  };

  // Copy proposal text
  const handleCopyProposal = () => {
    if (!generatedProposal) return;
    navigator.clipboard.writeText(generatedProposal);
    setProposalCopied(true);
    setTimeout(() => setProposalCopied(false), 2500);
  };

  // Export CSV Functionality (with UTF-8 BOM for Arabic)
  const handleExportCSV = () => {
    const listToExport = filteredLeads;
    if (listToExport.length === 0) {
      alert("لا توجد مشاريع لتصديرها في التصفية الحالية.");
      return;
    }

    const headers = ["المنصة", "عنوان المشروع", "الميزانية", "تاريخ النشر", "رابط المشروع", "الحالة"];
    const rows = listToExport.map((l) => {
      const firstLine = extractTitleFromPostText(l.post_text).replace(/"/g, '""');
      const budget = extractBudgetBadge(l.post_text) || "";
      const status = trackedActions[l.id]?.status || "new";
      return [
        `"${l.platform}"`,
        `"${firstLine}"`,
        `"${budget}"`,
        `"${l.published_at}"`,
        `"${l.post_url}"`,
        `"${status}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `PingLead_Projects_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("تم تصدير ملف CSV بنجاح!");
  };

  // Filtered Leads based on current sub-tab, search, platform, and status
  const filteredLeads = leads.filter((lead) => {
    const action = trackedActions[lead.id];

    // Sub-tab filtering
    if (currentTab === "proposals") {
      if (!action?.generated_proposal && action?.status !== "applied") return false;
    } else if (currentTab === "saved_jobs") {
      if (action?.status !== "saved") return false;
    }

    // Status filter
    if (statusFilter !== "all") {
      if (action?.status !== statusFilter) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!lead.post_text.toLowerCase().includes(q)) return false;
    }

    // Platform filter
    if (selectedPlatform !== "all" && lead.platform !== selectedPlatform) {
      return false;
    }

    // Category filter
    if (selectedCategory !== "all" && !isCategoryMatch(lead.category_slug, selectedCategory)) {
      return false;
    }

    // High intent filter
    if (onlyHighIntent && (lead.intent_score || 0) < 8) {
      return false;
    }

    return true;
  });

  // Calculate quick stats
  const totalLeads = leads.length;
  const savedCount = Object.values(trackedActions).filter((a) => a.status === "saved").length;
  const appliedCount = Object.values(trackedActions).filter((a) => a.status === "applied").length;

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

      {/* Vollna Master Sub-Tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        {/* Vollna 4 Sub-Tabs */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {[
            { id: "live_overview", label: "الرادار المباشر", count: totalLeads },
            { id: "proposals", label: "العروض المقدمة", count: appliedCount },
            { id: "saved_jobs", label: "المشاريع المحفوظة", count: savedCount },
            { id: "statistics", label: "الإحصائيات والتقارير" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as DashboardSubTab)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                currentTab === tab.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    currentTab === tab.id
                      ? "bg-emerald-500 text-black"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Right side: Last sync & Refresh button & Export */}
        <div className="flex items-center gap-2.5 text-xs text-slate-500 self-start sm:self-auto">
          <span className="hidden md:inline text-[11px] text-slate-400">
            آخر سحب: {lastSyncTime.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
          </span>

          <button
            type="button"
            onClick={handleScanNow}
            disabled={scanning}
            title="سحب فوري لجميع المنصات التسع الآن"
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center gap-1.5 transition text-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${scanning ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{scanning ? "جاري السحب..." : "تحديث الرادار"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            title="تصدير النتائج كملف CSV يدعم اللغة العربية"
            className="p-2 sm:px-3 sm:py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-1.5 transition text-xs shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">تصدير كملف CSV</span>
          </button>
        </div>
      </div>

      {/* Render Statistics Sub-tab */}
      {currentTab === "statistics" ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl">
              <span className="text-xs font-bold text-slate-500">إجمالي المشاريع في المستودع</span>
              <div className="text-2xl font-black text-slate-900 mt-2">{totalLeads}</div>
              <p className="text-[11px] text-slate-400 mt-1">تحديث لحظي من 9 منصات عربية وعالمية</p>
            </div>
            <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl">
              <span className="text-xs font-bold text-slate-500">عروض تم توليدها</span>
              <div className="text-2xl font-black text-emerald-700 mt-2">{appliedCount}</div>
              <p className="text-[11px] text-slate-400 mt-1">محفوظة في جدول user_project_actions</p>
            </div>
            <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl">
              <span className="text-xs font-bold text-slate-500">مشاريع محفوظة (Saved)</span>
              <div className="text-2xl font-black text-slate-900 mt-2">{savedCount}</div>
              <p className="text-[11px] text-slate-400 mt-1">جاهزة للمراجعة والتقديم</p>
            </div>
            <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl">
              <span className="text-xs font-bold text-slate-500">رصيد عروض AI المتاح</span>
              <div className="text-2xl font-black text-emerald-600 mt-2">⚡ {userCredits}</div>
              <p className="text-[11px] text-slate-400 mt-1">تخصم نقطة واحدة لكل عرض</p>
            </div>
          </div>
        </div>
      ) : (
        /* Render Overview, Proposals, or Saved Jobs */
        <div className="space-y-4">
          {/* Search & Platform Filter Bar */}
          <div className="vollna-card p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="بحث في نصوص وعناوين المشاريع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto flex-wrap">
              {/* Category Selector - 14 Categories */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-bold"
              >
                <option value="all">كافة التخصصات (14 تخصصاً)</option>
                {CATEGORIES_METADATA.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label_ar}
                  </option>
                ))}
              </select>

              {/* Platform Selector - 9 Core Platforms */}
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-bold"
              >
                <option value="all">كافة المنصات (9 منصات)</option>
                <optgroup label="🇪🇬🇸🇦 منصات عربية (5)">
                  {PLATFORMS_METADATA.filter((p) => p.region === "arab").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label_ar}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="🌍 منصات عالمية (4)">
                  {PLATFORMS_METADATA.filter((p) => p.region === "global").map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label_ar}
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Status Filter Tabs */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                {[
                  { id: "all", label: "الكل" },
                  { id: "saved", label: "محفوظ" },
                  { id: "applied", label: "تم التقديم" },
                  { id: "won", label: "فوز 🎉" },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusFilter(s.id as any)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                      statusFilter === s.id
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Leads Cards Feed */}
          {loading ? (
            <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">جاري تحميل أحدث المشاريع من Supabase...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl">
              <p className="text-sm font-bold text-slate-700">لا توجد مشاريع تطابق هذه التصفية حالياً.</p>
              <p className="text-xs text-slate-400 mt-1">جرّب اختيار "كافة المنصات" أو إزالة شروط البحث.</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredLeads.map((lead) => {
                const dateInfo = formatLeadDate(lead.published_at);
                const budgetBadge = extractBudgetBadge(lead.post_text);
                const firstLine = extractTitleFromPostText(lead.post_text);
                const action = trackedActions[lead.id];
                const isSaved = action?.status === "saved";
                const isApplied = action?.status === "applied";

                return (
                  <div
                    key={lead.id}
                    className="vollna-card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-slate-300 transition"
                  >
                    {/* Top Row: Platform, Time, Budget, and Save Icon */}
                    <div className="flex items-center justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900 text-emerald-400 uppercase tracking-wide">
                          {lead.platform}
                        </span>

                        {budgetBadge && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            <bdi dir="ltr">{budgetBadge}</bdi>
                            {lead.pricing?.budgetEgpText && (
                              <span className="font-semibold text-emerald-700/80"> · {lead.pricing.budgetEgpText}</span>
                            )}
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400 flex items-center gap-1" title={dateInfo.exact}>
                          <Clock className="w-3 h-3" />
                          <span>{dateInfo.relative}</span>
                        </span>

                        {isApplied && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                            ✓ تم التقديم
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleSaveLead(lead)}
                          title={isSaved ? "إلغاء الحفظ" : "حفظ المشروع"}
                          className={`p-1.5 rounded-lg border transition ${
                            isSaved
                              ? "bg-amber-50 border-amber-200 text-amber-600"
                              : "border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Project Title */}
                    <h2 className="text-base font-bold text-slate-900 mb-2 leading-snug">
                      <a
                        href={lead.post_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-emerald-700 transition"
                      >
                        {firstLine || "مشروع عمل حر جديد"}
                      </a>
                    </h2>

                    <InsightChips insights={lead.insights} pricing={lead.pricing} />

                    {/* Project Description Snippet */}
                    <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4 whitespace-pre-line">
                      {extractDetailsFromPostText(lead.post_text)}
                    </p>

                    {/* Bottom Actions Row */}
                    <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenProposalModal(lead)}
                          className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>توليد عرض ذكي</span>
                        </button>

                        <a
                          href={lead.post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="py-2 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
                        >
                          <span>فتح المشروع بالمنصة</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </a>
                      </div>

                      {/* Status Selector */}
                      <div className="flex items-center gap-1 self-end sm:self-auto text-xs">
                        <span className="text-[11px] text-slate-400">الحالة:</span>
                        <select
                          value={action?.status || "new"}
                          onChange={(e) => handleChangeStatus(lead.id, e.target.value as any)}
                          className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 font-semibold focus:outline-none focus:border-emerald-600"
                        >
                          <option value="new">جديد</option>
                          <option value="saved">محفوظ</option>
                          <option value="applied">تم التقديم</option>
                          <option value="won">تم الفوز 🎉</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* AI Proposal Modal */}
      {proposalModalLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl text-right max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    العرض الذكي المُولد بالذكاء الاصطناعي
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    رصيدك الحالي: {userCredits} نقطة
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setProposalModalLead(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatingProposal ? (
              <div className="py-12 text-center">
                <div className="w-10 h-10 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-bold text-slate-800">جاري صياغة العرض عبر محرك Gemini 2.0...</p>
                <p className="text-[11px] text-slate-400 mt-1">يتم دمج سابقة أعمالك ونبرة صوتك تلقائياً.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                  {generatedProposal}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    تم حفظ حالة المشروع تلقائياً كـ تم التقديم في المتابعة
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyProposal}
                      className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition"
                    >
                      {proposalCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{proposalCopied ? "تم النسخ!" : "نسخ نص العرض"}</span>
                    </button>

                    <a
                      href={proposalModalLead.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition"
                    >
                      <span>الانتقال لتقديم العرض</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
