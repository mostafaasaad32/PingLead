"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  Globe,
  ClipboardList,
  User,
  ArrowLeft,
  Calendar,
  Info,
  Camera,
  Layers,
  Video,
  ShoppingBag,
  Award,
  BookOpen,
  Plus,
  AlertTriangle,
  RotateCcw,
  Save,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Briefcase,
  Clock,
  DollarSign,
  AlertCircle,
  ArrowUpDown,
  GraduationCap,
} from "lucide-react";
import type {
  VollnaProfileAuditResult,
  VollnaSectionStatus,
  VollnaAuditSuggestedBlock,
} from "@/lib/ai/profile-importer";

type TabKey =
  | "title"
  | "image"
  | "overview"
  | "skills"
  | "portfolio"
  | "experience"
  | "video"
  | "catalog";

export default function ProfileAuditPage() {
  // Input State
  const [activeInputTab, setActiveInputTab] = useState<
    "upwork_url" | "platform_url" | "raw_text" | "current_profile"
  >("upwork_url");

  const [upworkUrl, setUpworkUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [rawText, setRawText] = useState("");

  // Audit Process State
  const [loading, setLoading] = useState(false);
  const [auditProgress, setAuditProgress] = useState("");
  const [auditResult, setAuditResult] = useState<VollnaProfileAuditResult | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Multi-Platform Audit History State
  const [savedAudits, setSavedAudits] = useState<Record<string, VollnaProfileAuditResult>>({});
  const [activePlatformKey, setActivePlatformKey] = useState<string>("upwork");
  const [showNewAuditView, setShowNewAuditView] = useState<boolean>(false);

  // Active Tab in Vollna Review
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  // Copy Feedback States
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);
  const [copiedFullOverview, setCopiedFullOverview] = useState(false);
  const [copiedTitleIndex, setCopiedTitleIndex] = useState<number | null>(null);
  const [copiedSkills, setCopiedSkills] = useState(false);
  const [copiedFullVideo, setCopiedFullVideo] = useState(false);
  const [copiedScriptIndex, setCopiedScriptIndex] = useState<number | null>(null);
  const [copiedPortfolioIndex, setCopiedPortfolioIndex] = useState<number | null>(null);
  const [copiedCatalogIndex, setCopiedCatalogIndex] = useState<number | null>(null);
  const [copiedRewriteTitleIndex, setCopiedRewriteTitleIndex] = useState<number | null>(null);
  const [copiedRewriteDescIndex, setCopiedRewriteDescIndex] = useState<number | null>(null);

  // Save / Sync to PingLead Profile State
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [savingToProfile, setSavingToProfile] = useState(false);
  const [savedToProfile, setSavedToProfile] = useState(false);

  // Filter Generation State
  const [creatingFilter, setCreatingFilter] = useState(false);
  const [filterCreated, setFilterCreated] = useState(false);

  // Toast Notification State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Helper to determine platform from URL
  const detectPlatformKey = (url: string): string => {
    const lower = url.toLowerCase();
    if (lower.includes("upwork.com")) return "upwork";
    if (lower.includes("mostaql.com")) return "mostaql";
    if (lower.includes("khamsat.com")) return "khamsat";
    if (lower.includes("nafezly.com")) return "nafezly";
    if (lower.includes("freelancer.com")) return "freelancer";
    if (lower.includes("github.com")) return "github";
    return "custom";
  };

  // Load saved audits on component mount (localStorage + server API)
  useEffect(() => {
    try {
      const cached = localStorage.getItem("pinglead_profile_audits_v2");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          setSavedAudits(parsed);
          const firstKey = Object.keys(parsed)[0];
          setAuditResult(parsed[firstKey]);
          setActivePlatformKey(firstKey);
        }
      }
    } catch (e) {
      console.warn("Failed to read local audit cache:", e);
    }

    // Also fetch saved audits from DB
    fetch("/api/profile-audit")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && data.platformAudits && Object.keys(data.platformAudits).length > 0) {
          setSavedAudits((prev) => {
            const merged = { ...prev, ...data.platformAudits };
            try {
              localStorage.setItem("pinglead_profile_audits_v2", JSON.stringify(merged));
            } catch {}
            return merged;
          });
          setAuditResult((prev) => {
            if (!prev) {
              const firstKey = Object.keys(data.platformAudits)[0];
              setActivePlatformKey(firstKey);
              return data.platformAudits[firstKey];
            }
            return prev;
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleRunAudit = async () => {
    setErrorMsg("");
    setSavedToProfile(false);
    setFilterCreated(false);

    if (activeInputTab === "upwork_url" && !upworkUrl.trim()) {
      setErrorMsg("يرجى إدخال رابط بروفايلك في Upwork أولاً");
      return;
    }
    if (activeInputTab === "platform_url" && !profileUrl.trim()) {
      setErrorMsg("يرجى إدخال رابط حسابك (مستقل، خمسات، نفذلي، أو GitHub)");
      return;
    }
    if (activeInputTab === "raw_text" && !rawText.trim()) {
      setErrorMsg("يرجى لصق نص النبذة التعريفية والبروفايل أولاً");
      return;
    }

    setLoading(true);
    setAuditProgress("جاري تجهيز البيانات للتحليل بواسطة خبير التوظيف بالذكاء الاصطناعي...");

    try {
      let res: Response;

      if (activeInputTab === "current_profile") {
        setAuditProgress("جاري قراءة ملفك الشخصي وسابقة أعمالك الحالية من Supabase...");
        res = await fetch("/api/profile-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ useCurrentProfile: true }),
        });
      } else if (activeInputTab === "upwork_url") {
        setAuditProgress("جاري قراءة بروفايل Upwork واستخراج كافة الأقسام والإحصائيات بدقة...");
        const formData = new FormData();
        formData.append("profileUrl", upworkUrl.trim());
        res = await fetch("/api/profile-audit", {
          method: "POST",
          body: formData,
        });
      } else if (activeInputTab === "platform_url") {
        setAuditProgress("جاري فحص محتوى صفحة الحساب وتحليل خوارزميات البحث وتاريخ التقييمات...");
        const formData = new FormData();
        formData.append("profileUrl", profileUrl.trim());
        res = await fetch("/api/profile-audit", {
          method: "POST",
          body: formData,
        });
      } else {
        setAuditProgress("جاري فحص النبذة والعنوان واكتشاف الفجوات بالذكاء الاصطناعي...");
        const formData = new FormData();
        formData.append("rawText", rawText.trim());
        res = await fetch("/api/profile-audit", {
          method: "POST",
          body: formData,
        });
      }

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "فشل فحص البروفايل");
      }

      const platformKey =
        data.platform ||
        (activeInputTab === "upwork_url"
          ? "upwork"
          : activeInputTab === "current_profile"
          ? "pinglead"
          : detectPlatformKey(profileUrl));

      data.audit.platform = platformKey;

      setAvatarError(false);
      setAuditResult(data.audit);
      setActivePlatformKey(platformKey);
      setShowNewAuditView(false);
      setActiveTab("overview");

      // Save into multi-platform history
      setSavedAudits((prev) => {
        const updated = { ...prev, [platformKey]: data.audit };
        try {
          localStorage.setItem("pinglead_profile_audits_v2", JSON.stringify(updated));
        } catch {}
        return updated;
      });

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء فحص البروفايل");
    } finally {
      setLoading(false);
      setAuditProgress("");
    }
  };

  const handleSwitchPlatform = (key: string) => {
    const audit = savedAudits[key];
    if (!audit) return;
    setActivePlatformKey(key);
    setAuditResult(audit);
    setShowNewAuditView(false);
    setSavedToProfile(false);
    setAvatarError(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAddNewAudit = () => {
    setShowNewAuditView(true);
    setSavedToProfile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopyText = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedBlockId(id);
    setTimeout(() => setCopiedBlockId(null), 2500);
  };

  const handleCopyFullOverview = () => {
    const fullText = auditResult?.sections.overview.fullRewrittenOverview;
    if (!fullText) return;
    navigator.clipboard.writeText(fullText);
    setCopiedFullOverview(true);
    setTimeout(() => setCopiedFullOverview(false), 3000);
  };

  const handleOpenSyncModal = () => {
    if (!auditResult) return;
    setShowSyncModal(true);
  };

  const handleConfirmSync = async () => {
    if (!auditResult) return;
    setSavingToProfile(true);

    try {
      const res = await fetch("/api/profile-audit/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auditResult,
          platform: activePlatformKey || auditResult.platform || "upwork",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "فشل مزامنة الملف الشخصي");
      }

      setShowSyncModal(false);
      setSavedToProfile(true);
      setToastMessage(
        data.message ||
          "✅ تم تحديث هويتك الذكية، ومزامنة المهارات وسابقة الأعمال مع مولد العروض وفلاتر المشاريع!"
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6500);
    } catch (err: any) {
      alert("حدث خطأ أثناء المزامنة: " + err.message);
    } finally {
      setSavingToProfile(false);
    }
  };

  const handleCreateFilterFromSkills = async () => {
    if (!auditResult) return;
    setCreatingFilter(true);

    try {
      const skillsPool = Array.from(
        new Set([
          ...(auditResult.sections.skills?.currentSkills || []),
          ...(auditResult.sections.skills?.skillsToAdd || []),
        ])
      ).filter(Boolean);

      const topKeywords = skillsPool.slice(0, 15);
      const filterName = `رادار مهارات: ${auditResult.freelancerName || "البروفايل"} (${(
        auditResult.currentTitle || "الذكاء الاصطناعي"
      ).slice(0, 30)})`;

      const res = await fetch("/api/filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filter_name: filterName,
          platforms: ["mostaql", "khamsat", "nafezly", "kafiil", "upwork", "freelancer"],
          categories: ["web_dev", "design", "marketing", "writing", "other"],
          include_keywords: topKeywords,
          exclude_keywords: [],
          min_budget_usd: 0,
          is_active: true,
          notify_telegram: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "فشل إنشاء الفلتر");
      }

      setFilterCreated(true);
      setToastMessage(
        "✅ تم إنشاء فلتر رادار جديد بنجاح! سيتم إشعارك فوراً بأي مشروع يطابق هذه المهارات."
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6500);
    } catch (err: any) {
      alert("حدث خطأ أثناء إنشاء الفلتر: " + err.message);
    } finally {
      setCreatingFilter(false);
    }
  };

  // Helper for status badge color
  const getStatusColor = (status: VollnaSectionStatus) => {
    switch (status) {
      case "good":
        return "bg-emerald-500";
      case "warning":
        return "bg-amber-500";
      case "critical":
        return "bg-rose-500";
      default:
        return "bg-slate-400";
    }
  };

  const getStatusBadge = (status: VollnaSectionStatus) => {
    switch (status) {
      case "good":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Good
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Needs Improvement
          </span>
        );
      case "critical":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Critical Fix
          </span>
        );
    }
  };

  const platformMeta: Record<
    string,
    { label: string; dot: string; color: string; activeClass: string; inactiveClass: string }
  > = {
    upwork: {
      label: "Upwork",
      dot: "bg-emerald-500",
      color: "text-emerald-700",
      activeClass: "bg-emerald-50 text-emerald-950 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40",
    },
    mostaql: {
      label: "مستقل",
      dot: "bg-blue-500",
      color: "text-blue-700",
      activeClass: "bg-blue-50 text-blue-950 border-blue-500 ring-2 ring-blue-500/20 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40",
    },
    khamsat: {
      label: "خمسات",
      dot: "bg-amber-500",
      color: "text-amber-700",
      activeClass: "bg-amber-50 text-amber-950 border-amber-500 ring-2 ring-amber-500/20 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40",
    },
    nafezly: {
      label: "نفذلي",
      dot: "bg-purple-500",
      color: "text-purple-700",
      activeClass: "bg-purple-50 text-purple-950 border-purple-500 ring-2 ring-purple-500/20 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:border-purple-300 hover:bg-purple-50/40",
    },
    freelancer: {
      label: "Freelancer",
      dot: "bg-sky-500",
      color: "text-sky-700",
      activeClass: "bg-sky-50 text-sky-950 border-sky-500 ring-2 ring-sky-500/20 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:border-sky-300 hover:bg-sky-50/40",
    },
    pinglead: {
      label: "PingLead Profile",
      dot: "bg-slate-700",
      color: "text-slate-800",
      activeClass: "bg-slate-100 text-slate-900 border-slate-800 ring-2 ring-slate-400/20 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50",
    },
    custom: {
      label: "فحص مخصص",
      dot: "bg-teal-500",
      color: "text-teal-700",
      activeClass: "bg-teal-50 text-teal-950 border-teal-500 ring-2 ring-teal-500/20 shadow-xs",
      inactiveClass: "bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/40",
    },
  };

  // ============================================================================
  // VIEW 1: Vollna Audit Results View (Matching 100% of Vollna UI & Strictness)
  // ============================================================================
  if (auditResult && !showNewAuditView) {
    const {
      freelancerName,
      currentTitle,
      avatarUrl,
      overallScore,
      executiveSummary,
      stats,
      sections,
    } = auditResult;

    // Smart RTL / LTR Language Detection
    const isEnglishProfile = Boolean(
      activePlatformKey === "upwork" ||
      activePlatformKey === "freelancer" ||
      auditResult.platform === "upwork" ||
      auditResult.platform === "freelancer" ||
      (currentTitle && /^[A-Za-z]/.test(currentTitle.trim())) ||
      (freelancerName && /^[A-Za-z]/.test(freelancerName.trim()))
    );

    const tabsList: Array<{ key: TabKey; label: string; status: VollnaSectionStatus }> = [
      { key: "overview", label: "Overview", status: sections.overview.status },
      { key: "title", label: "Title", status: sections.title.status },
      { key: "image", label: "Image", status: sections.image.status },
      { key: "skills", label: "Skills", status: sections.skills.status },
      { key: "portfolio", label: "Portfolio", status: sections.portfolio.status },
      { key: "experience", label: "Experience", status: sections.experience.status },
      { key: "video", label: "Video", status: sections.video.status },
      { key: "catalog", label: "Catalog", status: sections.catalog.status },
    ];

    // SVG Circular Progress calculation
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (overallScore / 100) * circumference;
    const progressColor =
      overallScore >= 75 ? "#10B981" : overallScore >= 50 ? "#F59E0B" : "#F43F5E";

    // Skills slot calculation
    const skillsUsed = sections.skills.usedSlots || sections.skills.currentSkills?.length || 0;
    const skillsMax = sections.skills.maxSlots || 20;
    const skillsPercent = Math.min(100, Math.round((skillsUsed / skillsMax) * 100));

    // Combined skills count for sync modal
    const combinedSkillsCount = Array.from(
      new Set([
        ...(sections.skills.currentSkills || []),
        ...(sections.skills.skillsToAdd || []),
      ])
    ).length;

    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-900 font-sans">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Profile Audit
              </h1>
              <button
                type="button"
                onClick={handleAddNewAudit}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition mt-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All reviews (فحص بروفايل جديد)</span>
              </button>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100/90 text-slate-600 text-xs font-medium border border-slate-200/70">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Update every few weeks to stay visible.</span>
              </div>

              <button
                type="button"
                onClick={handleOpenSyncModal}
                disabled={savingToProfile || savedToProfile}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition disabled:opacity-50"
              >
                {savedToProfile ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>تم الحفظ بملفك!</span>
                  </>
                ) : savingToProfile ? (
                  <span>جاري المزامنة...</span>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>حفظ التعديلات لبروفايلي</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Requirement 1: Multi-Platform Audit History Switcher Pills */}
          {Object.keys(savedAudits).length > 0 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap ml-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>المنصات المفحوصة:</span>
                  </span>

                  {Object.entries(savedAudits).map(([key, item]) => {
                    const meta = platformMeta[key] || {
                      label: key.toUpperCase(),
                      dot: "bg-emerald-500",
                      color: "text-emerald-700",
                      activeClass: "bg-slate-900 text-white border-slate-900 shadow-xs",
                      inactiveClass: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
                    };
                    const isActive = activePlatformKey === key;
                    const score = item.overallScore ?? 50;
                    const scoreColor =
                      score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSwitchPlatform(key)}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition shrink-0 ${
                          isActive ? meta.activeClass : meta.inactiveClass
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <span>{meta.label}</span>
                        <span className={`text-[11px] font-black ${isActive ? "text-white/90" : scoreColor}`}>
                          ({score}%)
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Add / Audit New Link Button */}
                <button
                  type="button"
                  onClick={handleAddNewAudit}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-dashed border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>فحص رابط جديد</span>
                </button>
              </div>
            </div>
          )}

          {/* Requirement 3: Inner Review Container with Smart RTL/LTR Direction */}
          <div
            dir={isEnglishProfile ? "ltr" : "rtl"}
            className={`${isEnglishProfile ? "text-left font-sans" : "text-right"} space-y-6 transition-all duration-200`}
          >

          {/* Profile Summary Card (Matching Vollna) */}
          <div className="bg-white border border-slate-200/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
              {/* Freelancer Avatar & Name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 border-slate-200/90 bg-gradient-to-tr from-slate-100 to-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                  {avatarUrl && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt={freelancerName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="text-xl font-black text-slate-600">
                      {freelancerName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {freelancerName}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 dir-ltr text-left">
                    {currentTitle}
                  </p>
                </div>
              </div>

              {/* Circular Progress Ring */}
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <div className="relative w-20 h-20 flex items-center justify-center">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke="#E2E8F0"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="40"
                      cy="40"
                      r={radius}
                      stroke={progressColor}
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className="absolute text-base sm:text-lg font-black text-slate-900">
                    {overallScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* Deep Stats Bar */}
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>{stats?.totalJobs ?? 1} Total jobs</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{stats?.totalHours ?? 0} Total hours</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>{stats?.hourlyRate ?? "$15.00/hr"}</span>
              </div>

              {stats?.activeContracts && stats.activeContracts.length > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active contract: {stats.activeContracts.join(", ")}</span>
                </div>
              )}
            </div>

            {/* Executive Summary */}
            <div className="pt-2">
              <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
                Summary
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
                {executiveSummary}
              </p>
            </div>
          </div>

          {/* Vollna Platform Info Banner */}
          <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200/80 text-xs text-slate-600 flex items-start sm:items-center gap-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
            <p className="leading-relaxed">
              Upwork & freelance platforms may take up to 30 days to fully re-index profile changes.
              Use the rewrites below as a starting point.
            </p>
          </div>

          {/* 8 Status Tabs (Matching Vollna) */}
          <div className="border-b border-slate-200 overflow-x-auto scrollbar-none">
            <nav className="flex items-center gap-6 min-w-max">
              {tabsList.map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key)}
                    className={`py-3 px-1 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition relative ${
                      isActive
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(t.status)}`} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ==================================================================== */}
          {/* TAB 1: OVERVIEW (SPLIT VIEW) */}
          {/* ==================================================================== */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Left Column: Current Overview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-sm font-black text-slate-900">Current overview</h3>
                  <span className="text-xs font-semibold text-slate-400">
                    {sections.overview.wordCount} words · {sections.overview.charCount} characters
                  </span>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 max-h-[640px] overflow-y-auto text-xs sm:text-sm text-slate-700 leading-relaxed font-sans whitespace-pre-wrap shadow-xs">
                  {sections.overview.currentText || (
                    <span className="text-slate-400 italic">No overview text found.</span>
                  )}
                </div>

                {/* Freelancer-Centric Hook Alert */}
                {(sections.overview.currentText?.toLowerCase().startsWith("as a dedicated") ||
                  sections.overview.currentText?.toLowerCase().startsWith("i am")) && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong>Freelancer-centric opening:</strong> Opening with <em>&quot;As a dedicated...&quot;</em> or <em>&quot;I am...&quot;</em> loses client attention. Clients decide within the first 2 lines whether to click &quot;more&quot;. Lead with their business problem or outcome instead.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column: Suggested Structure */}
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-1">
                  <h3 className="text-sm font-black text-slate-900">Suggested structure</h3>
                  <button
                    type="button"
                    onClick={handleCopyFullOverview}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs"
                  >
                    {copiedFullOverview ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Full Overview</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-3.5 max-h-[640px] overflow-y-auto pr-1">
                  {sections.overview.suggestedStructure.map((block) => {
                    const isCopied = copiedBlockId === block.id;
                    const blockContentToCopy =
                      block.content || (block.bullets ? block.bullets.join("\n") : "");

                    return (
                      <div
                        key={block.id}
                        className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs transition hover:border-slate-300"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2.5">
                          <div>
                            <h4 className="text-sm font-black text-slate-900">{block.title}</h4>
                            <p className="text-[11px] font-medium text-slate-400">{block.subtitle}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyText(blockContentToCopy, block.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="Copy block"
                          >
                            {isCopied ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {block.content && (
                          <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
                            {block.content}
                          </p>
                        )}

                        {block.bullets && block.bullets.length > 0 && (
                          <ul className="space-y-1.5 mt-2">
                            {block.bullets.map((b, i) => (
                              <li
                                key={i}
                                className="text-xs sm:text-sm text-slate-800 leading-relaxed font-sans flex items-start gap-2"
                              >
                                <span className="text-slate-400 shrink-0">•</span>
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 2: TITLE */}
          {/* ==================================================================== */}
          {activeTab === "title" && (
            <div className="space-y-6">
              {/* Current Title Card */}
              <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <h3 className="text-sm font-black text-slate-900">Current Title</h3>
                  {getStatusBadge(sections.title.status)}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 font-bold text-sm text-slate-800 dir-ltr text-left">
                  {sections.title.currentText}
                </div>

                <div className="mt-4 text-xs text-slate-600 leading-relaxed font-sans">
                  <span className="font-bold text-slate-900">Analysis: </span>
                  {sections.title.analysis}
                </div>
              </div>

              {/* Suggestions */}
              <div className="space-y-3">
                <h3 className="text-sm font-black text-slate-900">Recommended Titles</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {sections.title.suggestions.map((s, idx) => {
                    const isCopied = copiedTitleIndex === idx;
                    return (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition"
                      >
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 mb-1">
                            {s.label}
                          </div>
                          <p className="text-[11px] text-slate-400 mb-3">{s.subtitle}</p>
                          <p className="text-xs sm:text-sm font-bold text-slate-900 leading-relaxed dir-ltr text-left">
                            {s.content}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(s.content);
                            setCopiedTitleIndex(idx);
                            setTimeout(() => setCopiedTitleIndex(null), 2500);
                          }}
                          className="mt-4 pt-3 border-t border-slate-100 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 transition"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Use this title</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 3: IMAGE */}
          {/* ==================================================================== */}
          {activeTab === "image" && (
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Profile Photo & First Impression</h3>
                    <p className="text-xs text-slate-400">Headshot framing, eye contact, and ID verification</p>
                  </div>
                </div>
                {getStatusBadge(sections.image.status)}
              </div>

              {/* Photo Preview Card */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-200/90 bg-white flex items-center justify-center shrink-0 shadow-xs">
                  {avatarUrl && !avatarError ? (
                    <img
                      src={avatarUrl}
                      alt={freelancerName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="text-2xl font-black text-slate-600">
                      {freelancerName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-sm font-bold text-slate-900">{freelancerName}</span>
                    {avatarUrl && !avatarError ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Extracted Profile Picture</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-200">
                        Default Initials (No Photo URL)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {avatarUrl && !avatarError
                      ? "Your actual profile photo pulled directly from your public freelance profile."
                      : "No direct headshot URL was detected. Make sure your profile has a public portrait photo."}
                  </p>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans space-y-4">
                <p>{sections.image.analysis}</p>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                  <h4 className="font-bold text-slate-900">Vollna Photo Checklist:</h4>
                  <ul className="space-y-1.5 text-slate-600">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Face takes up 60-70% of the circular frame with clear eye contact.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Neutral or uncluttered high-contrast background (light gray, white, or soft office).</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Complete Identity Verification (IDV) check for the blue/green verification badge.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 4: SKILLS (VOLLNA HIGH-PRECISION) */}
          {/* ==================================================================== */}
          {activeTab === "skills" && (
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">Search Algorithm Skills & Tags</h3>
                  <p className="text-xs text-slate-400">Optimize keywords and skill ordering to rank higher in client searches</p>
                </div>
                {getStatusBadge(sections.skills.status)}
              </div>

              {/* Requirement 4: Quick Action - Convert Suggested Skills to Project Radar Filter */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 border border-emerald-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <h4 className="text-sm font-black text-slate-900">
                      تحويل هذه المهارات إلى فلتر رادار تلقائي
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      بضغطة واحدة
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    احفظ أهم الكلمات المفتاحية المقترحة تلقائياً في صفحة فلاتر المشاريع ليتم إشعارك فوراً عبر تيليجرام عند طرح أي مشروع جديد يطابق تخصصك!
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {filterCreated && (
                    <Link
                      href="/filters"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold transition shadow-xs"
                    >
                      <span>عرض الفلاتر</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleCreateFilterFromSkills}
                    disabled={creatingFilter}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition shrink-0 disabled:opacity-50"
                  >
                    {creatingFilter ? (
                      <span>جاري إنشاء الفلتر...</span>
                    ) : filterCreated ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>تم تفعيل الفلتر بنجاح!</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>🎯 تحويل هذه المهارات إلى فلتر رادار تلقائي</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Slot Utilization Bar */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Skill Slots Utilization</span>
                  <span>
                    {skillsUsed} of {skillsMax} used ({skillsPercent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      skillsUsed >= 18
                        ? "bg-emerald-500"
                        : skillsUsed >= 12
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    style={{ width: `${skillsPercent}%` }}
                  />
                </div>
                {skillsUsed < 15 && (
                  <p className="text-[11px] text-amber-800 font-medium pt-1">
                    ⚠️ Upwork allows up to 20 skills. Using only {skillsUsed} leaves {skillsMax - skillsUsed} valuable search keywords unused.
                  </p>
                )}
              </div>

              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
                {sections.skills.analysis}
              </div>

              {/* Skills to Reorder (Vollna Feature) */}
              {sections.skills.skillsToReorder && sections.skills.skillsToReorder.length > 0 && (
                <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/90 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wider">
                    <ArrowUpDown className="w-4 h-4 text-amber-600" />
                    <span>Skills to Reorder (Prioritize in Upwork Search)</span>
                  </div>
                  <p className="text-xs text-amber-900 leading-relaxed font-sans">
                    Upwork weighs your top 3-4 skills heaviest in search rankings. Reposition your core niche specializations to the top:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
                    {sections.skills.skillsToReorder.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs flex flex-col justify-between"
                      >
                        <span className="text-xs font-bold text-slate-900">{item.skill}</span>
                        <div className="flex items-center gap-2 mt-2 text-xs font-bold">
                          <span className="text-slate-400">#{item.fromRank}</span>
                          <span className="text-amber-500">➔</span>
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            #{item.toRank}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Skills to Add */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider">
                    Recommended Skills to Add ({sections.skills.skillsToAdd?.length || 0})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(sections.skills.skillsToAdd.join(", "));
                      setCopiedSkills(true);
                      setTimeout(() => setCopiedSkills(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                  >
                    {copiedSkills ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied All!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy All Skills</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {sections.skills.skillsToAdd?.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 text-xs font-bold border border-emerald-200 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3 text-emerald-600" />
                      <span>{s}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Current Skills in Order */}
              <div>
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
                  Current Skills in Order ({sections.skills.currentSkills?.length || 0})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {sections.skills.currentSkills?.map((s, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 flex items-center gap-1.5"
                    >
                      <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                      <span>{s}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 5: PORTFOLIO (VOLLNA CASE STUDIES) */}
          {/* ==================================================================== */}
          {activeTab === "portfolio" && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs space-y-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Portfolio & Case Studies</h3>
                    <p className="text-xs text-slate-400">
                      Current items published: {sections.portfolio.currentCount}
                    </p>
                  </div>
                  {getStatusBadge(sections.portfolio.status)}
                </div>

                {/* Vollna Alert Banner when Portfolio is 0 */}
                {sections.portfolio.currentCount === 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">
                        {sections.portfolio.alertTitle || "No portfolio items yet"}
                      </h4>
                      <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed font-sans">
                        {sections.portfolio.alertMessage ||
                          "Adding 2-3 strong case studies is the fastest way to increase conversion."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Project Case Study Ideas */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                    High-Converting Case Study Ideas to Add:
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sections.portfolio.projectIdeas?.map((p, idx) => {
                      const isCopied = copiedPortfolioIndex === idx;
                      return (
                        <div
                          key={idx}
                          className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition"
                        >
                          <div className="space-y-2">
                            <h5 className="font-bold text-sm text-slate-900">{p.title}</h5>
                            <p className="text-xs text-slate-600 leading-relaxed font-sans">
                              {p.description}
                            </p>
                            {p.whyItWorks && (
                              <div className="pt-2 text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80 font-medium">
                                <span className="font-bold">Why it converts: </span>
                                {p.whyItWorks}
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`${p.title}\n\n${p.description}`);
                                setCopiedPortfolioIndex(idx);
                                setTimeout(() => setCopiedPortfolioIndex(null), 2500);
                              }}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Copy Outline</span>
                                </>
                              )}
                            </button>

                            <Link
                              href="/portfolio"
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
                            >
                              <span>إضافة لمعرض أعمالي</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 6: EXPERIENCE */}
          {/* ==================================================================== */}
          {activeTab === "experience" && (
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-black text-slate-900">Employment History & Credentials</h3>
                  <p className="text-xs text-slate-400">Position past roles with client-facing keywords and measurable outcomes</p>
                </div>
                {getStatusBadge(sections.experience.status)}
              </div>

              {/* Alert Banner */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-950">
                    {sections.experience.alertTitle || "Attention needed"}
                  </h4>
                  <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed font-sans">
                    {sections.experience.alertMessage}
                  </p>
                </div>
              </div>

              {/* Employment History Note */}
              {sections.experience.employmentHistoryNote && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans">
                  <span className="font-bold text-slate-900">Profile Diagnosis: </span>
                  {sections.experience.employmentHistoryNote}
                </div>
              )}

              {/* Employment Rewrites */}
              {sections.experience.employmentRewrites && sections.experience.employmentRewrites.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Recommended Role Rewrites
                  </h4>
                  <div className="space-y-4">
                    {sections.experience.employmentRewrites.map((r, idx) => {
                      const isTitleCopied = copiedRewriteTitleIndex === idx;
                      const isDescCopied = copiedRewriteDescIndex === idx;

                      return (
                        <div
                          key={idx}
                          className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80">
                            <div>
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Current:
                              </span>
                              <span className="ml-2 font-bold text-xs text-slate-700">
                                {r.currentRole} at {r.company}
                              </span>
                            </div>
                            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold self-start sm:self-auto">
                              High-Leverage Signal
                            </span>
                          </div>

                          {/* Recommended Title */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">Recommended Title:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(r.recommendedTitle);
                                  setCopiedRewriteTitleIndex(idx);
                                  setTimeout(() => setCopiedRewriteTitleIndex(null), 2500);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900"
                              >
                                {isTitleCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>Copy Title</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-900 dir-ltr text-left">
                              {r.recommendedTitle}
                            </div>
                          </div>

                          {/* Recommended Description */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900">Recommended Description:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(r.recommendedDescription);
                                  setCopiedRewriteDescIndex(idx);
                                  setTimeout(() => setCopiedRewriteDescIndex(null), 2500);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900"
                              >
                                {isDescCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-600" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>Copy Description</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-wrap dir-ltr text-left">
                              {r.recommendedDescription}
                            </div>
                          </div>

                          {/* Why it works */}
                          {r.whyItWorks && (
                            <div className="text-[11px] text-slate-500 leading-relaxed font-sans">
                              <span className="font-bold text-slate-700">Rationale: </span>
                              {r.whyItWorks}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Roles to Add */}
              {sections.experience.rolesToAdd && sections.experience.rolesToAdd.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Role Ideas to Add (Fill Entry Gaps)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sections.experience.rolesToAdd.map((role, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <h5 className="font-bold text-xs text-slate-900">{role.title}</h5>
                        <p className="text-xs text-slate-600 leading-relaxed font-sans">
                          {role.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Additions (Certifications & Open Source) */}
              {sections.experience.suggestedAdditions && sections.experience.suggestedAdditions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    High-Value Credentials & Proof Points
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {sections.experience.suggestedAdditions.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
                      >
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase mb-2">
                            {item.type}
                          </span>
                          <h5 className="font-bold text-xs text-slate-900 mb-1">{item.title}</h5>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 7: VIDEO */}
          {/* ==================================================================== */}
          {activeTab === "video" && (
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <Video className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">45-Second Introduction Video</h3>
                    <p className="text-xs text-slate-400">Profiles with an intro video receive up to 3x more invites</p>
                  </div>
                </div>
                {getStatusBadge(sections.video.status)}
              </div>

              {/* Video Status Banner */}
              {!sections.video.hasVideo ? (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">No video introduction found (-5 pts)</h4>
                    <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed font-sans">
                      A short 45-second headshot video dramatically boosts client trust and helps overcome lack of review history.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-3">
                  <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-950">Video introduction present (+5 pts)</h4>
                    <p className="text-xs text-emerald-900/90 mt-0.5 leading-relaxed font-sans">
                      Great job having a video introduction! Review the script below to optimize your delivery.
                    </p>
                  </div>
                </div>
              )}

              <div className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
                {sections.video.analysis}
              </div>

              {/* Script Sections (Timed Breakdown) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Timed 45-Second Video Script
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const full = sections.video.scriptSections
                        ?.map((s) => `[${s.title}]\n${s.content}`)
                        .join("\n\n");
                      if (full) navigator.clipboard.writeText(full);
                      setCopiedFullVideo(true);
                      setTimeout(() => setCopiedFullVideo(false), 2500);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900"
                  >
                    {copiedFullVideo ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied Complete Script!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy Complete Script</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {sections.video.scriptSections?.map((sec, idx) => {
                    const isCopied = copiedScriptIndex === idx;
                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-slate-900">{sec.title}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(sec.content);
                                setCopiedScriptIndex(idx);
                                setTimeout(() => setCopiedScriptIndex(null), 2500);
                              }}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-sans">
                            {sec.content}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================================== */}
          {/* TAB 8: CATALOG */}
          {/* ==================================================================== */}
          {activeTab === "catalog" && (
            <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">Project Catalog Offerings</h3>
                    <p className="text-xs text-slate-400">Current catalog projects: {sections.catalog.currentCount}</p>
                  </div>
                </div>
                {getStatusBadge(sections.catalog.status)}
              </div>

              {/* Info Banner */}
              <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200/80 text-xs text-slate-600 flex items-start sm:items-center gap-3">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
                <p className="leading-relaxed">
                  {sections.catalog.infoBanner ||
                    "Catalogs surface your profile on Upwork's product listing page, a second entry point for views, messages, and invites."}
                </p>
              </div>

              {/* Alert Banner when Catalog is 0 */}
              {sections.catalog.currentCount === 0 && (
                <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-950">
                      {sections.catalog.alertTitle || "No catalog projects yet"}
                    </h4>
                    <p className="text-xs text-amber-900/90 mt-0.5 leading-relaxed font-sans">
                      {sections.catalog.alertMessage ||
                        "Adding one or two is a quick win. Start with a project idea below."}
                    </p>
                  </div>
                </div>
              )}

              {/* Project Ideas */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  Productized Project Ideas to Launch:
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {sections.catalog.projectIdeas?.map((item, idx) => {
                    const isCopied = copiedCatalogIndex === idx;
                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition"
                      >
                        <div className="space-y-2">
                          <h5 className="font-bold text-sm text-slate-900">{item.title}</h5>
                          <p className="text-xs text-slate-600 leading-relaxed font-sans">
                            {item.description}
                          </p>
                          {item.rationale && (
                            <div className="pt-2 text-[11px] text-emerald-800 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200/80 font-medium">
                              <span className="font-bold">Rationale: </span>
                              {item.rationale}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(`${item.title}\n\n${item.description}`);
                            setCopiedCatalogIndex(idx);
                            setTimeout(() => setCopiedCatalogIndex(null), 2500);
                          }}
                          className="mt-4 pt-3 border-t border-slate-200/80 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-400" />
                              <span>Copy Package Details</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          </div>

          {/* Sync Confirmation Modal */}
          {showSyncModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 dir-rtl text-right">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        تأكيد المزامنة الذكية للملف الشخصي
                      </h3>
                      <p className="text-xs text-slate-400">Smart Master Profile Sync</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                  <p className="font-bold text-slate-800 text-sm">
                    سيقوم النظام بإجراء دمج ذكي (Smart Merge) للتحديثات المستخرجة مع حسابك:
                  </p>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <span className="text-base shrink-0">🌐</span>
                      <div>
                        <strong className="text-slate-900 font-bold block">
                          1. الهوية المزدوجة ({isEnglishProfile ? "الإنجليزية المعتمدة" : "العربية المعتمدة"}):
                        </strong>
                        <span>
                          اعتماد العنوان المقترح والنبذة الاحترافية كمرجع رئيسي للذكاء الاصطناعي عند صياغة العروض {isEnglishProfile ? "الأجنبية (Upwork / Freelancer)" : "العربية (مستقل / خمسات)"}.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="text-base shrink-0">🧩</span>
                      <div>
                        <strong className="text-slate-900 font-bold block">
                          2. دمج المهارات الموحد ({combinedSkillsCount} مهارة):
                        </strong>
                        <span>
                          إضافة المهارات المقترحة والجديدة لقائمة مهاراتك دون أي تكرار لتحديث نسبة التوافق وفلاتر المشاريع تلقائياً.
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <span className="text-base shrink-0">💼</span>
                      <div>
                        <strong className="text-slate-900 font-bold block">
                          3. تغذية مخزن الأعمال الذكي (AI Vault):
                        </strong>
                        <span>
                          تحويل الخبرات الموثقة والعقود النشطة والشهادات إلى عناصر سابقة أعمال منظمة يستشهد بها الـ AI كأدلة حقيقية في عروضك.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSyncModal(false)}
                    disabled={savingToProfile}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition"
                  >
                    إلغاء
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmSync}
                    disabled={savingToProfile}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-xs disabled:opacity-50"
                  >
                    {savingToProfile ? (
                      <span>جاري المزامنة...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>تأكيد المزامنة وحفظ التعديلات</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Floating Toast Notification */}
          {showToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-in slide-in-from-bottom-5 duration-300">
              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold dir-rtl">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">✅</span>
                  <span className="leading-relaxed">{toastMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowToast(false)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: Initial Profile Audit Input Form (Clean Vollna Style)
  // ============================================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 text-slate-900 font-sans">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-8">
        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-bold mb-2.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>Vollna-Grade Profile Review</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            فحص البروفايل الذكي (Profile Audit)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            أدخل رابط حسابك في Upwork أو منصات العمل الحر، أو الصق نص النبذة لفحص نقاط القوة واكتشاف الأخطاء القاتلة بالذكاء الاصطناعي ومطابقتها لمعايير Vollna.
          </p>
        </div>

        {/* Multi-Platform Switcher Pills in Initial Input View */}
        {Object.keys(savedAudits).length > 0 && (
          <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap ml-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                  <span>التقارير السابقة المحفوظة:</span>
                </span>

                {Object.entries(savedAudits).map(([key, item]) => {
                  const meta = platformMeta[key] || {
                    label: key.toUpperCase(),
                    dot: "bg-emerald-500",
                    color: "text-emerald-700",
                    activeClass: "bg-slate-900 text-white border-slate-900 shadow-xs",
                    inactiveClass: "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100",
                  };
                  const score = item.overallScore ?? 50;
                  const scoreColor =
                    score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSwitchPlatform(key)}
                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shrink-0 shadow-2xs"
                    >
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                      <span>{meta.label}</span>
                      <span className={`text-[11px] font-black ${scoreColor}`}>
                        ({score}%)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Input Card */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 pb-5 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setActiveInputTab("upwork_url")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeInputTab === "upwork_url"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>Upwork (رابط البروفايل)</span>
              <span className="text-[10px] bg-emerald-500 text-white px-1.5 py-0.2 rounded-full font-bold">
                موصى به
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveInputTab("platform_url")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeInputTab === "platform_url"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>مستقل / خمسات / نفذلي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveInputTab("raw_text")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeInputTab === "raw_text"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>نص خام</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveInputTab("current_profile")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeInputTab === "current_profile"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>بروفايلي الحالي في PingLead</span>
            </button>
          </div>

          {/* Tab 1: Upwork (Direct URL) */}
          {activeInputTab === "upwork_url" && (
            <div className="pt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  أدخل رابط بروفايلك في Upwork:
                </label>
                <div className="relative">
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="https://www.upwork.com/freelancers/~... أو https://www.upwork.com/fl/username"
                    value={upworkUrl}
                    onChange={(e) => setUpworkUrl(e.target.value)}
                    className="w-full px-4 py-3 pl-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 transition"
                  />
                  <Globe className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  يتم الفحص الفوري للعنوان والنبذة والمهارات وسجل التوظيف والإحصائيات بدقة وخوارزميات Vollna.
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Platform URL */}
          {activeInputTab === "platform_url" && (
            <div className="pt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  أدخل رابط حسابك في مستقل، خمسات، نفذلي، أو GitHub:
                </label>
                <div className="relative">
                  <input
                    type="url"
                    dir="ltr"
                    placeholder="https://mostaql.com/u/username أو https://khamsat.com/user/..."
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    className="w-full px-4 py-3 pl-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 transition"
                  />
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Raw Text */}
          {activeInputTab === "raw_text" && (
            <div className="pt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الصق نص العنوان والنبذة التعريفية لبروفايلك:
                </label>
                <textarea
                  rows={5}
                  placeholder="الصق هنا العنوان والنبذة والمهارات التي تستخدمها حالياً في بروفايلك..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 leading-relaxed font-sans"
                />
              </div>
            </div>
          )}

          {/* Tab 4: Current Profile */}
          {activeInputTab === "current_profile" && (
            <div className="pt-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-bold text-slate-900">
                  فحص فوري لبياناتك المسجلة في PingLead
                </p>
                <p>
                  سيقوم النظام فوراً بسحب النبذة والعنوان وسابقة أعمالك الحالية من Supabase وتحليلها مباشرة دون الحاجة لرفع أي ملفات.
                </p>
              </div>
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="pt-6 mt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-500">
              {loading && (
                <div className="flex items-center gap-2.5 text-emerald-700 font-bold animate-pulse">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>{auditProgress}</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleRunAudit}
              disabled={loading}
              className="py-3 px-8 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{loading ? "جاري الفحص بالذكاء الاصطناعي..." : "بدء فحص البروفايل الآن"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Toast Notification in Initial View */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-in slide-in-from-bottom-5 duration-300">
          <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-800 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold dir-rtl">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">✅</span>
              <span className="leading-relaxed">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowToast(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
