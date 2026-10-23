"use client";

import { useEffect, useState } from "react";
import {
  Radar,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Briefcase,
  Layers,
  ArrowUpDown,
  RefreshCw,
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
  Download,
  AlertTriangle,
  X,
  FileText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lightbulb,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  PLATFORMS_METADATA,
  CATEGORIES_METADATA,
  UnifiedProject,
  ProjectInsights,
  // post_text is "[PLATFORM - طلب مشروع]\nعنوان: ...\nالميزانية: ...\nالتفاصيل: ..." (buildPostText)
  extractTitleFromPostText,
  extractDetailsFromPostText,
} from "@/lib/scrapers/types";
import {
  calculateClientScore,
  ClientEvaluation,
  getClientBadgeStyles,
  buildPlatformMetricsChips,
} from "@/lib/scoring/client-scorer";
import {
  getCompetitionVerdict,
  getClientVerdict,
} from "@/lib/insights/competition";
import { ProjectPricing } from "@/lib/insights/pricing";
import { getPlatformTheme, PlatformBadge, PlatformLogo } from "@/lib/platform-themes";

interface Lead {
  id: string;
  project_id?: string | null;
  platform: string;
  external_post_id: string;
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
  status: "matched" | "saved" | "applied" | "replied" | "ignored" | "won";
  generated_proposal?: string | null;
  notes?: string | null;
  ai_score?: number | null;
  ai_reason?: string | null;
  ai_min_score?: number | null;
}

const DEFAULT_AI_MIN_SCORE = 70;

/** AI qualifier badge: score against the user's criteria, reason on hover and on small screens */
function AiScoreBadge({ action }: { action?: TrackedProjectAction }) {
  if (typeof action?.ai_score !== "number") return null;
  const score = action.ai_score;
  const threshold = action.ai_min_score ?? DEFAULT_AI_MIN_SCORE;
  const tone =
    score >= threshold
      ? "bg-emerald-50 text-emerald-800 border-emerald-200/70"
      : score >= 40
        ? "bg-amber-50 text-amber-800 border-amber-200/70"
        : "bg-rose-50 text-rose-700 border-rose-200/70";
  return (
    <div className={`mb-3 inline-flex max-w-full items-start gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] ${tone}`}>
      <span className="font-bold whitespace-nowrap">🤖 {score}% توافق</span>
      {action.ai_reason && <span className="opacity-80">· {action.ai_reason}</span>}
    </div>
  );
}

/** Resolves or calculates ClientEvaluation for a lead or item */
function resolveClientEvaluation(data: any): ClientEvaluation {
  if (data?.insights?.client_evaluation) {
    const ev = { ...data.insights.client_evaluation };
    if (!ev.metricsChips || ev.metricsChips.length === 0) {
      ev.metricsChips = buildPlatformMetricsChips({
        platform: data?.platform || ev.platform || "",
        hireRate: ev.hireRate,
        openProjects: ev.openProjects,
        inProgressProjects: ev.inProgressProjects,
        paymentVerified: ev.paymentVerified,
        clientCountry: ev.clientCountry,
        clientProfession: ev.clientProfession,
        clientRating: ev.clientRating,
        totalSpent: ev.totalSpent,
        score: ev.score,
      });
    }
    return ev;
  }
  return calculateClientScore({
    platform: data?.platform,
    title: data?.title || extractTitleFromPostText(data?.post_text || ""),
    description: data?.description || extractDetailsFromPostText(data?.post_text || ""),
    budget: data?.budget || extractBudgetBadge(data?.post_text || ""),
    budget_usd_estimate: data?.pricing?.suggestion?.priceUsd,
    author: data?.author,
    insights: data?.insights,
    client_hire_rate: data?.insights?.client_hire_rate,
    client_open_projects: data?.insights?.client_open_projects,
    client_in_progress: data?.insights?.client_in_progress,
    client_registered_at: data?.insights?.client_registered_at,
    client_country: data?.insights?.client_country,
    duration_text: data?.insights?.duration_text,
    bids_count: data?.insights?.bids_count,
  });
}

/** Client Intelligence Card: Dynamic Platform Chips + Green & Red Flags + Negotiation Advice */
function ClientIntelligenceCard({
  evaluation,
  onClose,
  compact = false,
  projectTitle,
  platform,
}: {
  evaluation: ClientEvaluation;
  onClose?: () => void;
  compact?: boolean;
  projectTitle?: string;
  platform?: string;
}) {
  const styles = getClientBadgeStyles(evaluation.score);
  const targetPlatform = platform || evaluation.platform || "";
  const chips =
    evaluation.metricsChips && evaluation.metricsChips.length > 0
      ? evaluation.metricsChips
      : buildPlatformMetricsChips({
          platform: targetPlatform,
          hireRate: evaluation.hireRate,
          openProjects: evaluation.openProjects,
          inProgressProjects: evaluation.inProgressProjects,
          paymentVerified: evaluation.paymentVerified,
          clientCountry: evaluation.clientCountry,
          clientProfession: evaluation.clientProfession,
          clientRating: evaluation.clientRating,
          totalSpent: evaluation.totalSpent,
          score: evaluation.score,
        });

  return (
    <div
      className="rounded-3xl border border-slate-200 bg-white shadow-2xl text-right p-5 sm:p-6 transition-all w-full text-xs"
      onClick={(e) => e.stopPropagation()}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-start justify-between pb-4 mb-4 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 border ${styles.bg} ${styles.border}`}
          >
            <span>{styles.icon}</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-slate-900 text-base">{styles.title}</span>
              <span
                className={`font-mono font-black px-2.5 py-0.5 rounded-full text-xs ${styles.bg} ${styles.text} border ${styles.border}`}
              >
                {evaluation.score.toFixed(1)} / 10
              </span>
              {targetPlatform && <PlatformBadge platform={targetPlatform} />}
            </div>
            <p className="text-xs font-bold text-slate-600 mt-1">{evaluation.labelAr}</p>
            {projectTitle && (
              <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 font-sans">
                {projectTitle}
              </p>
            )}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Dynamic Platform-Tailored Metrics Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {chips.map((chip, idx) => {
          const toneStyles =
            chip.tone === "positive"
              ? "bg-emerald-50/80 border-emerald-200/90 text-emerald-950"
              : chip.tone === "warning"
                ? "bg-amber-50/80 border-amber-200/90 text-amber-950"
                : chip.tone === "accent"
                  ? "bg-indigo-50/80 border-indigo-200/90 text-indigo-950"
                  : "bg-slate-50 border-slate-200 text-slate-900";

          return (
            <div
              key={idx}
              className={`p-3.5 sm:p-4 rounded-2xl border ${toneStyles} flex flex-col justify-between min-h-[84px] shadow-2xs transition`}
            >
              <div>
                <span className="text-[11px] font-bold opacity-75 block mb-1.5 leading-tight">
                  {chip.label}
                </span>
                <div className="font-black text-xs sm:text-[13px] flex items-center gap-1.5 leading-snug break-words">
                  {chip.icon && <span className="text-sm shrink-0">{chip.icon}</span>}
                  <span className="leading-snug break-words">{chip.value}</span>
                </div>
              </div>
              {chip.subtext && (
                <span className="text-[10px] leading-snug opacity-70 mt-2 block font-medium break-words">
                  {chip.subtext}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Green Flags (مميزات العميل ونقاط القوة) */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-800 mb-2">
          <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
            ✓
          </span>
          <span>مميزات العميل ونقاط القوة ({evaluation.greenFlags.length}):</span>
        </div>
        {evaluation.greenFlags.length > 0 ? (
          <ul className="space-y-1.5">
            {evaluation.greenFlags.map((flag, idx) => (
              <li
                key={idx}
                className="text-xs text-emerald-800 bg-emerald-50/80 border border-emerald-200/70 px-3 py-2 rounded-xl leading-relaxed flex items-start gap-2"
              >
                <span className="text-emerald-600 font-bold mt-0.5 shrink-0">✓</span>
                <span className="font-medium">{flag}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 p-3 rounded-xl">
            لا توجد مميزات إضافية مسجلة حالياً - المشروع يخضع لنظام الحماية الافتراضي للمنصة.
          </div>
        )}
      </div>

      {/* Red Flags (مؤشرات الخطر والتحذيرات) */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 mb-2">
          <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold">
            ⚠️
          </span>
          <span>مؤشرات الخطر والتحذيرات ({evaluation.redFlags.length}):</span>
        </div>
        {evaluation.redFlags.length > 0 ? (
          <ul className="space-y-1.5">
            {evaluation.redFlags.map((flag, idx) => (
              <li
                key={idx}
                className="text-xs text-rose-800 bg-rose-50/80 border border-rose-200/70 px-3 py-2 rounded-xl leading-relaxed flex items-start gap-2"
              >
                <span className="text-rose-600 font-bold mt-0.5 shrink-0">⚠</span>
                <span className="font-medium">{flag}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-emerald-800 bg-emerald-50/90 border border-emerald-200 p-3 rounded-xl flex items-center gap-2 font-bold">
            <span className="text-emerald-600 text-sm">🛡️</span>
            <span>سجل العميل نظيف: لا توجد أي تحذيرات أو مؤشرات خطر مسجلة على هذا المشروع!</span>
          </div>
        )}
      </div>

      {/* Strategic Negotiation Tip */}
      {evaluation.negotiationTipAr && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200 shadow-2xs mb-4">
          <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 mb-1.5">
            <Lightbulb className="w-4 h-4 text-amber-600 shrink-0" />
            <span>نصيحة تفاوضية ذكية للفريلانسر:</span>
          </div>
          <p className="text-xs text-amber-900 leading-relaxed font-sans font-medium">
            {evaluation.negotiationTipAr}
          </p>
        </div>
      )}

      {/* Close Button Footer */}
      {onClose && (
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-xs"
          >
            إغلاق النافذة
          </button>
        </div>
      )}
    </div>
  );
}

/** Interactive Client Score Pill with Full Dialog Modal */
function ClientScorePill({ data }: { data: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const evaluation = resolveClientEvaluation(data);
  const styles = getClientBadgeStyles(evaluation.score);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(true);
        }}
        title="انقر هنا لعرض التقرير الكامل لموثوقية العميل، نقاط القوة، التحذيرات، والنصيحة التفاوضية"
        className={`group px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer select-none shadow-2xs hover:shadow-md hover:scale-[1.02] active:scale-95 ${styles.bg} ${styles.border} ${styles.text}`}
      >
        <span className="text-sm shrink-0">{styles.icon}</span>
        <span className="font-bold">{styles.title}</span>
        <span className="font-mono font-black px-1.5 py-0.2 rounded-md bg-white/70 dark:bg-black/20 border border-black/5">
          {evaluation.score.toFixed(1)}/10
        </span>
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-white/80 dark:bg-black/30 px-1.5 py-0.5 rounded-full border border-black/10 text-slate-700 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-150">
          <span>فحص العميل</span>
          <ChevronDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
        </span>
      </button>

      {/* Full Centered Dialog Modal - Immune to clipping & overflow-hidden */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          <div
            className="w-full max-w-2xl sm:max-w-3xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <ClientIntelligenceCard
              evaluation={evaluation}
              onClose={() => setIsOpen(false)}
              compact={false}
              projectTitle={data?.title || extractTitleFromPostText(data?.post_text || "")}
              platform={data?.platform}
            />
          </div>
        </div>
      )}
    </>
  );
}

interface TrackedItem {
  id: string;
  project_id: string;
  status: "matched" | "saved" | "applied" | "replied" | "ignored" | "won";
  generated_proposal?: string | null;
  notes?: string | null;
  matched_filter_id?: string | null;
  title: string;
  description: string;
  url: string;
  platform: string;
  category: string;
  budget?: string | null;
  budget_usd_estimate?: number | null;
  published_at?: string;
  tracked_at?: string;
  updated_at?: string;
}

type DashboardSubTab = "live_overview" | "saved_jobs" | "statistics";

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

  // Tab State: Clean & Focused
  const [currentTab, setCurrentTab] = useState<DashboardSubTab>("live_overview");

  // Time Window Filter: Default Last 24 Hours, with options up to 48h / 72h
  const [timeWindow, setTimeWindow] = useState<"24h" | "48h" | "72h">("24h");

  // Leads & CRM Data
  const [leads, setLeads] = useState<Lead[]>([]);
  const [trackedActions, setTrackedActions] = useState<Record<string, TrackedProjectAction>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [onlyHighIntent, setOnlyHighIntent] = useState(false);
  // Only projects the AI scored at/above the filter's threshold
  const [onlyAiFit, setOnlyAiFit] = useState(false);
  // Hide risky / unverified / low hire-rate clients (< 6.0 / 10)
  const [hideRiskyClients, setHideRiskyClients] = useState(false);
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

  // Tracker Items State (Saved Projects & Proposals)
  const [trackerItems, setTrackerItems] = useState<TrackedItem[]>([]);
  const [copiedProposalId, setCopiedProposalId] = useState<string | null>(null);

  const handleCopyItemProposal = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedProposalId(id);
    setTimeout(() => setCopiedProposalId(null), 2500);
  };

  const getLeadAction = (lead: Lead): TrackedProjectAction | undefined => {
    if (lead.project_id && trackedActions[lead.project_id]) {
      return trackedActions[lead.project_id];
    }
    return trackedActions[lead.id];
  };

  // User Profile Credits
  const [userCredits, setUserCredits] = useState<number>(25);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Loading states
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [trackerLoading, setTrackerLoading] = useState(true);

  // 1. Fetch leads from database filtered by time window (default: last 24 hours)
  async function fetchLeads(isSilent = false) {
    if (!isSilent) setLeadsLoading(true);
    try {
      // The feed is the whole market; AI-scored matches can be older than the latest 100
      const limit = onlyAiFit ? 400 : 100;
      const res = await fetch(`/api/leads?limit=${limit}&time_window=${timeWindow}&sort_by=${sortBy}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.leads)) {
        setLeads(data.leads);
        setLastSyncTime(new Date());
      }
    } catch (err) {
      console.error("Error fetching leads:", err);
    } finally {
      if (!isSilent) setLeadsLoading(false);
    }
  }

  // 2. Fetch user project actions from Supabase (strictly identifying user-saved projects)
  async function fetchActions() {
    setTrackerLoading(true);
    try {
      const res = await fetch("/api/tracker");
      const data = await res.json();
      if (data.ok && Array.isArray(data.items)) {
        setTrackerItems(data.items);
        const map: Record<string, TrackedProjectAction> = {};
        data.items.forEach((item: any) => {
          map[item.project_id] = {
            id: item.id,
            project_id: item.project_id,
            status: item.status,
            generated_proposal: item.generated_proposal,
            notes: item.notes,
            ai_score: item.ai_score,
            ai_reason: item.ai_reason,
            ai_min_score: item.ai_min_score,
          };
          if (item.id) {
            map[item.id] = map[item.project_id];
          }
        });
        setTrackedActions(map);
      }
    } catch (err) {
      console.error("Error loading saved actions:", err);
    } finally {
      setTrackerLoading(false);
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
  }, [timeWindow, sortBy, onlyAiFit]);

  useEffect(() => {
    fetchActions();
    loadUserCredits();
  }, []);

  // 4. Auto-refresh live feed every 15s
  useEffect(() => {
    if (!autoSync) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchLeads(true);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [autoSync, timeWindow, sortBy, onlyAiFit]);

  // Handle Manual Scan Trigger
  const handleScanNow = async () => {
    setScanning(true);
    try {
      // /api/scan runs the cron server-side (the browser never has CRON_SECRET)
      const res = await fetch("/api/scan", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        showToast(
          data.skipped
            ? "الرادار لسه ساحب من أقل من دقيقة، دي أحدث المشاريع."
            : `تم سحب الرادار بنجاح: ${data.totalProjectsIngested || 0} مشروع من كل المنصات.`
        );
        fetchLeads(false);
        fetchActions();
        setCountdown(15);
      } else {
        showToast(data.error || "تعذر تشغيل الرادار.");
      }
    } catch (e) {
      showToast("حدث خطأ في الاتصال بالرادار.");
    } finally {
      setScanning(false);
    }
  };

  // Unified Save / Un-save toggle
  // Explicitly sets notes: "user_saved" when saving, or un-saves when clicked again
  const handleToggleSaveLead = async (leadOrItem: any) => {
    const targetId = leadOrItem.project_id || leadOrItem.id;
    const currentAction = getLeadAction(leadOrItem);
    const isCurrentlySaved = currentAction?.status === "saved" && currentAction?.notes === "user_saved";
    // Un-saving returns the project to the matched feed instead of hiding it as "ignored"
    const newStatus = isCurrentlySaved ? "matched" : "saved";

    // Optimistic UI updates
    setTrackedActions((prev) => ({
      ...prev,
      [targetId]: {
        id: currentAction?.id || targetId,
        project_id: targetId,
        status: newStatus as any,
        notes: newStatus === "saved" ? "user_saved" : null,
      },
    }));

    setTrackerItems((prev) => {
      if (newStatus === "saved") {
        const existing = prev.find((item) => item.project_id === targetId || item.id === targetId);
        if (existing) {
          return prev.map((item) =>
            item.project_id === targetId || item.id === targetId
              ? { ...item, status: "saved", notes: "user_saved" }
              : item
          );
        } else {
          const newItem: TrackedItem = {
            id: targetId,
            project_id: targetId,
            status: "saved",
            notes: "user_saved",
            title: leadOrItem.title || extractTitleFromPostText(leadOrItem.post_text || "") || "مشروع عمل حر",
            description: leadOrItem.description || extractDetailsFromPostText(leadOrItem.post_text || "") || "",
            url: leadOrItem.url || leadOrItem.post_url || "",
            platform: leadOrItem.platform || "mostaql",
            category: leadOrItem.category || leadOrItem.category_slug || "web_dev",
            budget: leadOrItem.budget || extractBudgetBadge(leadOrItem.post_text || "") || null,
            published_at: leadOrItem.published_at || new Date().toISOString(),
          };
          return [newItem, ...prev];
        }
      } else {
        // Unsaved: remove from saved list immediately
        return prev.filter((item) => item.project_id !== targetId && item.id !== targetId);
      }
    });

    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: targetId,
          status: newStatus,
          notes: newStatus === "saved" ? "user_saved" : null,
        }),
      });

      if (res.ok) {
        showToast(
          newStatus === "saved"
            ? "تم حفظ المشروع في قائمة المشاريع المحفوظة بنجاح 📌"
            : "تمت إزالة المشروع من قائمة المحفوظات"
        );
        fetchActions();
      }
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
          project_id: lead.project_id,
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
        const targetId = lead.project_id || lead.id;
        setTrackedActions((prev) => ({
          ...prev,
          [targetId]: {
            ...prev[targetId], // keep ai_score / ai_reason
            id: data.action_id || targetId,
            project_id: targetId,
            status: prev[targetId]?.status || "matched",
            notes: prev[targetId]?.notes,
            generated_proposal: data.proposal,
          },
        }));
        showToast("تم توليد العرض الذكي وحفظ المسودة بنجاح!");
        fetchActions();
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
    const listToExport = currentTab === "saved_jobs" ? filteredSavedJobs : filteredLiveLeads;

    if (listToExport.length === 0) {
      alert("لا توجد مشاريع لتصديرها في التصفية الحالية.");
      return;
    }

    const headers = ["المنصة", "عنوان المشروع", "الميزانية", "تاريخ النشر", "رابط المشروع", "محفوظ"];
    const rows = listToExport.map((item: any) => {
      const title = (item.title || extractTitleFromPostText(item.post_text || "")).replace(/"/g, '""');
      const budget = item.budget || extractBudgetBadge(item.post_text || "") || "";
      const isSaved = getLeadAction(item)?.status === "saved" && getLeadAction(item)?.notes === "user_saved";
      return [
        `"${item.platform}"`,
        `"${title}"`,
        `"${budget}"`,
        `"${item.published_at || item.created_at || ""}"`,
        `"${item.url || item.post_url || ""}"`,
        `"${isSaved ? "نعم" : "لا"}"`,
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

  // Filtered Leads from live radar feed
  const filteredLiveLeads = leads.filter((lead) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!lead.post_text.toLowerCase().includes(q)) return false;
    }
    if (selectedPlatform !== "all" && lead.platform !== selectedPlatform) {
      return false;
    }
    if (selectedCategory !== "all" && !isCategoryMatch(lead.category_slug, selectedCategory)) {
      return false;
    }
    if (onlyHighIntent && (lead.intent_score || 0) < 8) {
      return false;
    }
    if (onlyAiFit) {
      const action = getLeadAction(lead);
      if (typeof action?.ai_score !== "number") return false;
      if (action.ai_score < (action.ai_min_score ?? DEFAULT_AI_MIN_SCORE)) return false;
    }
    if (hideRiskyClients) {
      const clientEval = resolveClientEvaluation(lead);
      if (clientEval.score < 6.0) return false;
    }
    return true;
  });
  const hasAiScores = Object.values(trackedActions).some((a) => typeof a.ai_score === "number");

  // Filtered Saved Jobs: Strictly projects explicitly saved by the user (status = saved & notes = user_saved)
  const filteredSavedJobs = trackerItems.filter((item) => {
    if (item.status !== "saved" || item.notes !== "user_saved") return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!item.title?.toLowerCase().includes(q) && !item.description?.toLowerCase().includes(q)) return false;
    }
    if (selectedPlatform !== "all" && item.platform !== selectedPlatform) return false;
    if (selectedCategory !== "all" && !isCategoryMatch(item.category, selectedCategory)) return false;
    if (hideRiskyClients) {
      const clientEval = resolveClientEvaluation(item);
      if (clientEval.score < 6.0) return false;
    }
    return true;
  });

  // Calculate quick stats from live data
  const totalLeads = leads.length;
  const savedCount = trackerItems.filter((a) => a.status === "saved" && a.notes === "user_saved").length;
  const proposalsCount = trackerItems.filter((a) => Boolean(a.generated_proposal)).length;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-3 border border-emerald-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Vollna Master Sub-Tabs Header: Clean 3 Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {[
            { id: "live_overview", label: "الرادار المباشر", count: totalLeads },
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
            <span className="hidden sm:inline">تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* Render Statistics Sub-tab */}
      {currentTab === "statistics" ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-slate-500">المشاريع الطازجة في الرادار</span>
              <div className="text-2xl font-black text-slate-900 mt-2">{totalLeads}</div>
              <p className="text-[11px] text-slate-400 mt-1">المعروضة ضمن نافذة {timeWindow === "24h" ? "آخر 24 ساعة" : timeWindow === "48h" ? "آخر 48 ساعة" : "آخر 72 ساعة"}</p>
            </div>
            <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-slate-500">المشاريع المحفوظة (Saved)</span>
              <div className="text-2xl font-black text-amber-600 mt-2">📌 {savedCount}</div>
              <p className="text-[11px] text-slate-400 mt-1">مشاريع قمت بحفظها يدوياً للمراجعة</p>
            </div>
            <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-slate-500">مسودات عروض تم توليدها</span>
              <div className="text-2xl font-black text-emerald-700 mt-2">⚡ {proposalsCount}</div>
              <p className="text-[11px] text-slate-400 mt-1">محفوظة ومستثناة من الحذف التلقائي</p>
            </div>
            <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <span className="text-xs font-bold text-slate-500">رصيد عروض AI المتاح</span>
              <div className="text-2xl font-black text-emerald-600 mt-2">✨ {userCredits}</div>
              <p className="text-[11px] text-slate-400 mt-1">تخصم نقطة واحدة لكل عرض ذكي</p>
            </div>
          </div>
        </div>
      ) : (
        /* Render Overview or Saved Jobs */
        <div className="space-y-4">
          {/* Search, Categories, Platforms & Time Window Filter Bar */}
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

              {/* Time Window Filter (Default: Last 24 Hours, options up to 48h / 72h) */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>النافذة:</span>
                </span>
                {[
                  { id: "24h", label: "آخر 24 ساعة (افتراضي)" },
                  { id: "48h", label: "آخر 48 ساعة" },
                  { id: "72h", label: "آخر 72 ساعة" },
                ].map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setTimeWindow(w.id as any)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition ${
                      timeWindow === w.id
                        ? "bg-slate-900 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              {/* Hide Risky Clients Quick Filter */}
              <button
                type="button"
                onClick={() => setHideRiskyClients((v) => !v)}
                aria-pressed={hideRiskyClients}
                title="إخفاء كل المشاريع ذات التقييم الأقل من 6/10 والتركيز على أصحاب المشاريع الجادين فقط"
                className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition flex items-center gap-1.5 ${
                  hideRiskyClients
                    ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                }`}
              >
                <span>🛡️</span>
                <span>إخفاء العملاء الوهميين (أعلى من 6/10 فقط)</span>
              </button>

              {hasAiScores && (
                <button
                  type="button"
                  onClick={() => setOnlyAiFit((v) => !v)}
                  aria-pressed={onlyAiFit}
                  title="المشاريع اللي الـ AI قيّمها فوق الحد اللي اخترته في الفلتر"
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-xl border transition ${
                    onlyAiFit
                      ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  🤖 المناسب لشروطي بس
                </button>
              )}
            </div>
          </div>

          {/* Cards Feed */}
          {(currentTab === "live_overview" ? leadsLoading : trackerLoading) ? (
            <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">جاري تحميل البيانات من Supabase...</p>
            </div>
          ) : currentTab === "saved_jobs" ? (
            /* Saved Jobs list */
            filteredSavedJobs.length === 0 ? (
              <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200/60">
                  <Bookmark className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">لا توجد مشاريع محفوظة حالياً.</p>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  عندما يعجبك أي مشروع في الرادار المباشر، اضغط على زر الحفظ (🔖) ليتم حفظه هنا فوراً للرجوع إليه وتقديم عرضك.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredSavedJobs.map((item) => {
                  const dateInfo = formatLeadDate(item.published_at || item.tracked_at || "");
                  const theme = getPlatformTheme(item.platform);

                  return (
                    <div
                      key={item.id}
                      className={`relative bg-white border rounded-2xl shadow-xs transition-all duration-200 ${theme.cardBorder} ${theme.cardHoverBorder} hover:shadow-lg ${theme.cardGlow}`}
                    >
                      {/* Top Brand Accent Stripe */}
                      <div className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${theme.topStripeGradient}`} />

                      <div className="p-5 sm:p-6">
                        {/* Top Row: Platform Badge with Logo, Budget, Date, and Bookmark */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <PlatformBadge platform={item.platform} />

                            <ClientScorePill data={item} />

                            {item.budget && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-mono">
                                <bdi dir="ltr">{item.budget}</bdi>
                              </span>
                            )}

                            <span className="text-[11px] text-slate-400 flex items-center gap-1" title={dateInfo.exact}>
                              <Clock className="w-3 h-3" />
                              <span>{dateInfo.relative}</span>
                            </span>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center gap-1">
                              <span>📌</span>
                              <span>محفوظ</span>
                            </span>
                          </div>

                          {/* Bookmark Toggle (Click to Unsave) */}
                          <button
                            type="button"
                            onClick={() => handleToggleSaveLead(item)}
                            title="إلغاء حفظ هذا المشروع"
                            className="p-1.5 rounded-lg border bg-amber-50 border-amber-200 text-amber-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition"
                          >
                            <BookmarkCheck className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Title */}
                        <h2 className="text-base font-bold text-slate-900 mb-2 leading-snug">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className={`transition-colors duration-150 ${theme.titleHover}`}
                          >
                            {item.title || "مشروع عمل حر"}
                          </a>
                        </h2>

                        {/* Description Snippet */}
                        {item.description && (
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-3 whitespace-pre-line">
                            {item.description}
                          </p>
                        )}

                        {/* Generated Proposal Accordion / Box if present */}
                        {item.generated_proposal && (
                          <div className="my-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                            <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/60">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                <span>العرض الذكي المُولد بالذكاء الاصطناعي</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCopyItemProposal(item.id, item.generated_proposal!)}
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition shadow-2xs"
                              >
                                {copiedProposalId === item.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span className="text-emerald-700">تم النسخ!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-500" />
                                    <span>نسخ نص العرض</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p className="text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-line">
                              {item.generated_proposal}
                            </p>
                          </div>
                        )}

                        {/* Bottom Actions Row */}
                        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className={`py-2 px-3.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition shadow-2xs ${theme.openBtnClass}`}
                            >
                              <PlatformLogo platform={theme.id} size={14} className="shrink-0" />
                              <span>فتح المشروع في {theme.nameAr}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>

                            <button
                              type="button"
                              onClick={() => handleToggleSaveLead(item)}
                              className="py-2 px-3 rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 font-bold text-xs transition"
                            >
                              إلغاء الحفظ
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* Live Overview Cards Feed (Filtered Leads) */
            filteredLiveLeads.length === 0 ? (
              <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-xs">
                <p className="text-sm font-bold text-slate-700">لا توجد مشاريع تطابق هذه التصفية حالياً.</p>
                <p className="text-xs text-slate-400 mt-1">جرّب توسيع النافذة الزمنية إلى "آخر 48 ساعة" أو اختيار "كافة المنصات".</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredLiveLeads.map((lead) => {
                  const dateInfo = formatLeadDate(lead.published_at);
                  const budgetBadge = extractBudgetBadge(lead.post_text);
                  const firstLine = extractTitleFromPostText(lead.post_text);
                  const action = getLeadAction(lead);
                  const isSaved = action?.status === "saved" && action?.notes === "user_saved";
                  const theme = getPlatformTheme(lead.platform);

                  return (
                    <div
                      key={lead.id}
                      className={`relative bg-white border rounded-2xl shadow-xs transition-all duration-200 ${theme.cardBorder} ${theme.cardHoverBorder} hover:shadow-lg ${theme.cardGlow}`}
                    >
                      {/* Top Brand Accent Stripe */}
                      <div className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${theme.topStripeGradient}`} />

                      <div className="p-5 sm:p-6">
                        {/* Top Row: Platform Badge with Logo, Time, Budget, and Save Bookmark Icon */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <PlatformBadge platform={lead.platform} />

                            <ClientScorePill data={lead} />

                            {budgetBadge && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60 font-mono">
                                <bdi dir="ltr">{budgetBadge}</bdi>
                                {lead.pricing?.budgetEgpText && (
                                  <span className="font-semibold text-emerald-700/80">
                                    {" · "}
                                    {/* isolated so the RTL page doesn't flip the range to "136,000 - 54,400" */}
                                    <bdi dir="ltr">{lead.pricing.budgetEgpText}</bdi>
                                  </span>
                                )}
                              </span>
                            )}

                            <span className="text-[11px] text-slate-400 flex items-center gap-1" title={dateInfo.exact}>
                              <Clock className="w-3 h-3" />
                              <span>{dateInfo.relative}</span>
                            </span>

                            {isSaved && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center gap-1">
                                <span>📌</span>
                                <span>محفوظ</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleSaveLead(lead)}
                              title={isSaved ? "إلغاء الحفظ من المفضلة" : "حفظ المشروع في المشاريع المحفوظة"}
                              className={`p-1.5 rounded-lg border transition ${
                                isSaved
                                  ? "bg-amber-50 border-amber-200 text-amber-600 shadow-2xs"
                                  : "border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {isSaved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Project Title with platform hover color */}
                        <h2 className="text-base font-bold text-slate-900 mb-2 leading-snug">
                          <a
                            href={lead.post_url}
                            target="_blank"
                            rel="noreferrer"
                            className={`transition-colors duration-150 ${theme.titleHover} inline-flex items-center gap-1.5`}
                          >
                            <span>{firstLine || "مشروع عمل حر جديد"}</span>
                          </a>
                        </h2>

                        <InsightChips insights={lead.insights} pricing={lead.pricing} />

                        <AiScoreBadge action={action} />

                        {/* Project Description Snippet */}
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4 whitespace-pre-line">
                          {extractDetailsFromPostText(lead.post_text)}
                        </p>

                        {/* Bottom Actions Row */}
                        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
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
                              className={`py-2 px-3.5 rounded-xl border font-bold text-xs flex items-center gap-1.5 transition shadow-2xs ${theme.openBtnClass}`}
                            >
                              <PlatformLogo platform={theme.id} size={14} className="shrink-0" />
                              <span>فتح المشروع في {theme.nameAr}</span>
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </a>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleSaveLead(lead)}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                isSaved
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 border border-transparent"
                              }`}
                            >
                              {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                              <span>{isSaved ? "محفوظ في قائمتك" : "حفظ المشروع"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
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
                {/* Client Intelligence & Risk Card */}
                <ClientIntelligenceCard evaluation={resolveClientEvaluation(proposalModalLead)} compact={false} />

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                  {generatedProposal}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">
                    يمكنك نسخ العرض والانتقال للمنصة لإرساله فوراً.
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleCopyProposal}
                      className="py-2 px-3.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
                    >
                      {proposalCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{proposalCopied ? "تم النسخ!" : "نسخ نص العرض"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleSaveLead(proposalModalLead)}
                      className="py-2 px-3.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs flex items-center gap-1.5 transition shadow-2xs"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>حفظ في المشاريع المحفوظة</span>
                    </button>

                    <a
                      href={proposalModalLead.post_url}
                      target="_blank"
                      rel="noreferrer"
                      className="py-2 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs"
                    >
                      <span>الانتقال للمنصة</span>
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

// Category matching helper
function isCategoryMatch(itemCategory?: string | null, targetCategory?: string): boolean {
  if (!itemCategory || !targetCategory || targetCategory === "all") return true;
  if (itemCategory === targetCategory) return true;

  const aliases: Record<string, string[]> = {
    web_mobile_dev: ["web_mobile_dev", "web_dev"],
    web_dev: ["web_mobile_dev", "web_dev"],
    ui_ux_graphic: ["ui_ux_graphic", "ui_ux", "design"],
    ui_ux: ["ui_ux_graphic", "ui_ux", "design"],
    design: ["ui_ux_graphic", "ui_ux", "design"],
    digital_marketing_seo: ["digital_marketing_seo", "marketing"],
    marketing: ["digital_marketing_seo", "marketing"],
    business_accounting_legal: ["business_accounting_legal", "accounting", "business"],
    accounting: ["business_accounting_legal", "accounting", "business"],
    business: ["business_accounting_legal", "accounting", "business"],
    writing_translation: ["writing_translation", "writing"],
    writing: ["writing_translation", "writing"],
    sales_customer_support: ["sales_customer_support", "support"],
    support: ["sales_customer_support", "support"],
  };

  const valid = aliases[targetCategory] || [targetCategory];
  return valid.includes(itemCategory);
}
