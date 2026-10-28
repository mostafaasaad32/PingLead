"use client";

// ==============================================================================
// src/app/(dashboard)/filters/page.tsx
// Vollna-Grade Split-Screen Job Filters Workspace
// High-Density Master-Detail Workspace (RTL Arab & Global Freelance Platforms)
// ==============================================================================

import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Save,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Sparkles,
  Bell,
  BellOff,
  Zap,
  ExternalLink,
  CheckCircle2,
  Copy,
  Clock,
  DollarSign,
  Tag,
  Globe,
  SlidersHorizontal,
  X,
  AlertCircle,
  Briefcase,
  Layers,
  ArrowUpDown,
  RotateCcw,
  FileText,
} from "lucide-react";

import {
  PLATFORMS_METADATA,
  CATEGORIES_METADATA,
  FreelancePlatform,
  CategoryType,
  PlatformMetadata,
  CategoryMetadata,
  isJobBoard,
} from "@/lib/scrapers/types";
import { PlatformLogo } from "@/lib/platform-themes";
import { isCategoryMatch } from "@/lib/filters/categorizer";
import { COUNTRY_OPTIONS, GULF_COUNTRY_CODES, countryCodeFor } from "@/lib/filters/countries";

// Quick lookup map for platform metadata
const PLATFORM_MAP = new Map<string, PlatformMetadata>(
  PLATFORMS_METADATA.map((p) => [p.id, p])
);

// Freelance marketplaces are on by default; remote job boards are opt-in
const FREELANCE_PLATFORMS = PLATFORMS_METADATA.filter((p) => !isJobBoard(p.id));
const JOB_BOARDS = PLATFORMS_METADATA.filter((p) => isJobBoard(p.id));
const ALL_PLATFORMS = FREELANCE_PLATFORMS.map((p) => p.id);
const ARAB_PLATFORMS = FREELANCE_PLATFORMS.filter((p) => p.region === "arab");
const GLOBAL_PLATFORMS = FREELANCE_PLATFORMS.filter((p) => p.region === "global");
const ALL_CATEGORIES = CATEGORIES_METADATA.map((c) => c.id);

interface FilterItem {
  id: string;
  filter_name: string;
  platforms: string[];
  categories: string[];
  include_keywords: string[];
  exclude_keywords: string[];
  min_budget_usd: number;
  is_active: boolean;
  notify_telegram: boolean;
  max_bids?: number | null;
  min_client_hire_rate?: number | null;
  exclude_new_clients?: boolean;
  job_type?: "any" | "fixed" | "hourly";
  client_countries?: string[];
  ai_criteria?: string | null;
  ai_min_score?: number;
  created_at?: string;
}

const FIXED_PRICE_PLATFORMS = ["mostaql", "nafezly", "khamsat", "kafiil"];

interface ProjectItem {
  id: string;
  external_id?: string;
  platform: string;
  title: string;
  description: string;
  url: string;
  budget: string;
  budget_usd_estimate: number;
  currency: string;
  category: string;
  language: string;
  author: string;
  published_at: string;
  quality_score: number;
  bids_count?: number | null;
  client_hire_rate?: number | null;
  client_country?: string | null;
  details_fetched_at?: string | null;
}

interface ProposalTemplate {
  id: string;
  name: string;
  template_body?: string | null;
  hourly_rate?: number | null;
  pricing_type?: string;
  filter_id?: string | null;
}

export default function JobFiltersWorkspace() {
  // Saved Filters
  const [savedFilters, setSavedFilters] = useState<FilterItem[]>([]);
  const [selectedFilterId, setSelectedFilterId] = useState<string>("new");
  const [filterName, setFilterName] = useState("فلتر بدون عنوان");
  const [isNewFilter, setIsNewFilter] = useState(true);

  // Active Filter Criteria
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [includeInput, setIncludeInput] = useState("");
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [excludeInput, setExcludeInput] = useState("");

  const [minBudget, setMinBudget] = useState<number>(0); // stored in USD
  const [includeNoBudget, setIncludeNoBudget] = useState<boolean>(true);
  const [budgetCurrency, setBudgetCurrency] = useState<"USD" | "EGP">("USD");
  const [usdEgpRate, setUsdEgpRate] = useState<number | null>(null);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(ALL_PLATFORMS);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(ALL_CATEGORIES);

  const [language, setLanguage] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("all");
  const [notifyTelegram, setNotifyTelegram] = useState<boolean>(true);

  // Competition & client quality
  const [maxBids, setMaxBids] = useState<number>(0);
  const [minHireRate, setMinHireRate] = useState<number>(0);
  const [excludeNewClients, setExcludeNewClients] = useState<boolean>(false);
  const [jobType, setJobType] = useState<"any" | "fixed" | "hourly">("any");
  const [clientCountries, setClientCountries] = useState<string[]>([]);

  // AI qualifier
  const [aiCriteria, setAiCriteria] = useState<string>("");
  const [aiMinScore, setAiMinScore] = useState<number>(70);
  const [aiEvalsRemaining, setAiEvalsRemaining] = useState<number | null>(null);

  // Search within loaded matches
  const [workspaceSearch, setWorkspaceSearch] = useState("");

  // Accordion Expand/Collapse States (جميع الأقسام مقفولة افتراضياً ويفتحها المستخدم حسب الحاجة)
  const [openSections, setOpenSections] = useState({
    keywords: false,
    budget: false,
    quality: false,
    ai: false,
    sites: false,
    advanced: false,
  });

  // Projects State
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Qualification Scores Cache (projectId -> matchScore)
  const [qualifyMap, setQualifyMap] = useState<Record<string, { score: number; reason: string }>>({});
  const [qualifyingId, setQualifyingId] = useState<string | null>(null);
  const [batchQualifying, setBatchQualifying] = useState(false);

  // User Profile & Templates
  const [userSkills, setUserSkills] = useState<string[]>([]);
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [showSetupGeneratorModal, setShowSetupGeneratorModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // AI Proposal Modal
  const [proposalModalProject, setProposalModalProject] = useState<ProjectItem | null>(null);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [refiningProposal, setRefiningProposal] = useState(false);
  const [generatedProposalText, setGeneratedProposalText] = useState("");
  const [copiedProposal, setCopiedProposal] = useState(false);
  const [pitchAngle, setPitchAngle] = useState<"direct" | "action_plan" | "snappy">("direct");
  const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<{
    id: string;
    title: string;
    live_url?: string | null;
  } | null>(null);

  // CRM Tracker Notification State
  const [appliedProjectIds, setAppliedProjectIds] = useState<Set<string>>(new Set());

  // General Loading & Toast
  const [savingFilter, setSavingFilter] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  // Fetch initial saved filters, rates, and templates
  useEffect(() => {
    async function loadInitialData() {
      try {
        fetch("/api/currency/rates")
          .then((res) => res.json())
          .then((data) => {
            if (data.ok && data.usd_egp) setUsdEgpRate(data.usd_egp);
          })
          .catch(() => {});

        fetch("/api/projects/qualify")
          .then((res) => res.json())
          .then((data) => {
            if (data.ok && typeof data.remaining === "number") setAiEvalsRemaining(data.remaining);
          })
          .catch(() => {});

        const fRes = await fetch("/api/filters");
        const fData = await fRes.json();
        if (fData.ok && fData.filters) {
          setSavedFilters(fData.filters);
          if (fData.filters.length > 0) {
            applyFilterToState(fData.filters[0]);
          }
        }

        const pRes = await fetch("/api/portfolio");
        const pData = await pRes.json();
        if (pData.ok && pData.profile?.skills) {
          setUserSkills(pData.profile.skills);
        }

        const tRes = await fetch("/api/templates");
        const tData = await tRes.json();
        if (tData.ok && tData.templates) {
          setTemplates(tData.templates);
          if (tData.templates.length > 0) {
            setSelectedTemplateId(tData.templates[0].id);
          }
        }

        const trRes = await fetch("/api/tracker?status=applied");
        const trData = await trRes.json();
        if (trData.ok && trData.items) {
          const ids = new Set<string>(trData.items.map((i: any) => i.project_id).filter(Boolean));
          setAppliedProjectIds(ids);
        }
      } catch (err) {
        console.error("Initial load error:", err);
      }
    }

    loadInitialData();
  }, []);

  // Fetch Projects Pool from API
  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects?limit=300");
      const data = await res.json();
      if (data.ok && data.projects) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error("Error fetching projects:", err);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Apply a saved filter object to local state
  const applyFilterToState = (f: FilterItem) => {
    setSelectedFilterId(f.id);
    setIsNewFilter(false);
    setFilterName(f.filter_name);
    setIncludeTags(f.include_keywords || []);
    setExcludeTags(f.exclude_keywords || []);
    setMinBudget(f.min_budget_usd || 0);
    setSelectedPlatforms(f.platforms && f.platforms.length > 0 ? f.platforms : ALL_PLATFORMS);
    setSelectedCategories(
      f.categories && f.categories.length > 0 ? f.categories : ALL_CATEGORIES
    );
    setNotifyTelegram(f.notify_telegram ?? true);
    setMaxBids(f.max_bids || 0);
    setMinHireRate(f.min_client_hire_rate || 0);
    setExcludeNewClients(!!f.exclude_new_clients);
    setJobType(f.job_type || "any");
    setClientCountries(f.client_countries || []);
    setAiCriteria(f.ai_criteria || "");
    setAiMinScore(f.ai_min_score ?? 70);
    setQualifyMap({});
  };

  // Reset to fresh untitled filter
  const handleSelectNewFilter = () => {
    setSelectedFilterId("new");
    setIsNewFilter(true);
    setFilterName("فلتر جديد");
    setIncludeTags([]);
    setExcludeTags([]);
    setMinBudget(0);
    setIncludeNoBudget(true);
    setSelectedPlatforms(ALL_PLATFORMS);
    setSelectedCategories(ALL_CATEGORIES);
    setLanguage("all");
    setTimeRange("all");
    setNotifyTelegram(true);
    setMaxBids(0);
    setMinHireRate(0);
    setExcludeNewClients(false);
    setJobType("any");
    setClientCountries([]);
    setAiCriteria("");
    setAiMinScore(70);
    setQualifyMap({});
  };

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Tag Adders
  const handleAddIncludeTag = () => {
    const trimmed = includeInput.trim();
    if (trimmed && !includeTags.includes(trimmed)) {
      setIncludeTags([...includeTags, trimmed]);
      setIncludeInput("");
    }
  };

  const handleAddExcludeTag = () => {
    const trimmed = excludeInput.trim();
    if (trimmed && !excludeTags.includes(trimmed)) {
      setExcludeTags([...excludeTags, trimmed]);
      setExcludeInput("");
    }
  };

  // Platform Toggles
  const togglePlatform = (pId: string) => {
    if (selectedPlatforms.includes(pId)) {
      if (selectedPlatforms.length === 1) return;
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== pId));
    } else {
      setSelectedPlatforms([...selectedPlatforms, pId]);
    }
  };

  const keepJobBoards = (ids: string[]) => [...ids, ...selectedPlatforms.filter((p) => isJobBoard(p))];
  const selectOnlyArabPlatforms = () => setSelectedPlatforms(keepJobBoards(ARAB_PLATFORMS.map((p) => p.id)));
  const selectOnlyGlobalPlatforms = () => setSelectedPlatforms(keepJobBoards(GLOBAL_PLATFORMS.map((p) => p.id)));
  const selectAllPlatforms = () => setSelectedPlatforms(keepJobBoards(ALL_PLATFORMS));

  // Category Toggles
  const toggleCategory = (cId: string) => {
    if (selectedCategories.includes(cId)) {
      if (selectedCategories.length === 1) return;
      setSelectedCategories(selectedCategories.filter((c) => c !== cId));
    } else {
      setSelectedCategories([...selectedCategories, cId]);
    }
  };

  const selectAllCategories = () => {
    setSelectedCategories(ALL_CATEGORIES);
  };

  // Real-Time In-Memory Filtering on Loaded Projects
  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      // 1. Platform check
      if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(project.platform)) {
        return false;
      }

      // 2. Category check
      if (selectedCategories.length > 0) {
        const matchesCat = selectedCategories.some((c) =>
          isCategoryMatch(project.category, c)
        );
        if (!matchesCat) return false;
      }

      // 3. Language check
      if (language !== "all" && project.language !== language) {
        return false;
      }

      // 4. Budget check
      const estimate = project.budget_usd_estimate || 0;
      if (minBudget > 0) {
        if (estimate > 0 && estimate < minBudget) return false;
        if (estimate === 0 && !includeNoBudget) return false;
      }

      // 5. Time Range check
      if (timeRange !== "all") {
        const pubTime = new Date(project.published_at).getTime();
        const now = Date.now();
        const diffHours = (now - pubTime) / (1000 * 60 * 60);
        if (timeRange === "24h" && diffHours > 24) return false;
        if (timeRange === "3d" && diffHours > 72) return false;
        if (timeRange === "7d" && diffHours > 168) return false;
      }

      // 5b. Competition & client quality
      if (maxBids > 0 && typeof project.bids_count === "number" && project.bids_count > maxBids) return false;
      if (minHireRate > 0 && typeof project.client_hire_rate === "number" && project.client_hire_rate < minHireRate) {
        return false;
      }
      if (excludeNewClients && project.details_fetched_at && project.client_hire_rate == null) return false;
      if (jobType === "hourly" && FIXED_PRICE_PLATFORMS.includes(project.platform)) return false;
      if (clientCountries.length > 0) {
        const code = countryCodeFor(project.client_country);
        if (code && !clientCountries.includes(code)) return false;
      }

      const fullText = `${project.title} ${project.description}`.toLowerCase();

      // In-workspace quick search
      if (workspaceSearch.trim()) {
        const q = workspaceSearch.trim().toLowerCase();
        if (!fullText.includes(q)) return false;
      }

      // 6. Include Keywords check
      if (includeTags.length > 0) {
        const hasAnyInclude = includeTags.some((tag) =>
          fullText.includes(tag.toLowerCase().trim())
        );
        if (!hasAnyInclude) return false;
      }

      // 7. Exclude Keywords check
      if (excludeTags.length > 0) {
        const hasAnyExclude = excludeTags.some((tag) =>
          fullText.includes(tag.toLowerCase().trim())
        );
        if (hasAnyExclude) return false;
      }

      return true;
    });
  }, [
    projects,
    selectedPlatforms,
    selectedCategories,
    language,
    minBudget,
    includeNoBudget,
    timeRange,
    includeTags,
    excludeTags,
    maxBids,
    minHireRate,
    excludeNewClients,
    jobType,
    clientCountries,
    workspaceSearch,
  ]);

  // Save or Update Filter to Supabase
  const handleSaveFilter = async () => {
    if (!filterName.trim()) {
      showToast("يرجى كتابة اسم للفلتر");
      return;
    }

    setSavingFilter(true);
    try {
      const payload = {
        filter_name: filterName.trim(),
        platforms: selectedPlatforms,
        categories: selectedCategories,
        include_keywords: includeTags,
        exclude_keywords: excludeTags,
        min_budget_usd: minBudget,
        is_active: true,
        notify_telegram: notifyTelegram,
        max_bids: maxBids || null,
        min_client_hire_rate: minHireRate || null,
        exclude_new_clients: excludeNewClients,
        job_type: jobType,
        client_countries: clientCountries,
        ai_criteria: aiCriteria.trim() || null,
        ai_min_score: aiMinScore,
      };

      if (isNewFilter || selectedFilterId === "new") {
        const res = await fetch("/api/filters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.ok && data.filter) {
          setSavedFilters([data.filter, ...savedFilters]);
          setSelectedFilterId(data.filter.id);
          setIsNewFilter(false);
          showToast(`تم حفظ الفلتر "${data.filter.filter_name}" بنجاح`);
        } else {
          showToast(data.error || "فشل في حفظ الفلتر");
        }
      } else {
        const res = await fetch("/api/filters", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedFilterId, ...payload }),
        });
        const data = await res.json();
        if (data.ok && data.filter) {
          setSavedFilters(
            savedFilters.map((f) => (f.id === data.filter.id ? data.filter : f))
          );
          showToast(`تم حفظ وتحديث إعدادات الفلتر بنجاح`);
        } else {
          showToast(data.error || "فشل في تحديث الفلتر");
        }
      }
    } catch (err: any) {
      showToast(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSavingFilter(false);
    }
  };

  // Delete Filter
  const handleDeleteFilter = async () => {
    if (isNewFilter || selectedFilterId === "new") {
      handleSelectNewFilter();
      return;
    }

    if (!confirm(`هل أنت متأكد من حذف الفلتر "${filterName}"؟`)) return;

    try {
      const res = await fetch(`/api/filters?id=${selectedFilterId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.ok) {
        const updated = savedFilters.filter((f) => f.id !== selectedFilterId);
        setSavedFilters(updated);
        showToast("تم حذف الفلتر بنجاح");
        if (updated.length > 0) {
          applyFilterToState(updated[0]);
        } else {
          handleSelectNewFilter();
        }
      }
    } catch (err) {
      showToast("فشل في حذف الفلتر");
    }
  };

  // Instant Telegram Toggle
  const handleToggleJobAlerts = async () => {
    const nextVal = !notifyTelegram;
    setNotifyTelegram(nextVal);

    if (!isNewFilter && selectedFilterId !== "new") {
      try {
        await fetch("/api/filters", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedFilterId, notify_telegram: nextVal }),
        });
        showToast(
          nextVal
            ? "🔔 تم تفعيل إرسال تنبيهات هذا الفلتر إلى تليجرام"
            : "🔕 تم إيقاف تنبيهات تليجرام لهذا الفلتر"
        );
      } catch (e) {
        // ignore
      }
    } else {
      showToast(
        nextVal
          ? "تنبيهات تليجرام مفعلة (احفظ الفلتر لتثبيتها)"
          : "تنبيهات تليجرام معطلة"
      );
    }
  };

  // AI Scoring
  const qualifyWithAi = async (projectIds: string[]): Promise<number> => {
    if (!aiCriteria.trim()) {
      showToast('اكتب شروطك في قسم "🤖 شروطك للـ AI" أولاً');
      setOpenSections((prev) => ({ ...prev, ai: true }));
      return 0;
    }
    const res = await fetch("/api/projects/qualify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ criteria: aiCriteria, project_ids: projectIds }),
    });
    const data = await res.json().catch(() => ({}));
    if (typeof data.remaining === "number") setAiEvalsRemaining(data.remaining);
    if (!data.ok) {
      showToast(data.error || "تعذر فحص التوافق");
      return 0;
    }
    setQualifyMap((prev) => ({ ...prev, ...data.scores }));
    return Object.keys(data.scores || {}).length;
  };

  const handleQualifySingle = async (project: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setQualifyingId(project.id);
    try {
      await qualifyWithAi([project.id]);
    } finally {
      setQualifyingId(null);
    }
  };

  const handleBatchQualify = async () => {
    const ids = filteredProjects.filter((p) => !qualifyMap[p.id]).slice(0, 10).map((p) => p.id);
    if (!ids.length) {
      showToast("جميع المشاريع المعروضة تم فحصها بالفعل");
      return;
    }
    setBatchQualifying(true);
    try {
      const n = await qualifyWithAi(ids);
      if (n) showToast(`✨ تم فحص ${n} مشاريع بالذكاء الاصطناعي`);
    } finally {
      setBatchQualifying(false);
    }
  };

  const formatRelativeTime = (isoString: string): string => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / (1000 * 60));
      if (mins < 1) return "الآن";
      if (mins < 60) return `منذ ${mins} د`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `منذ ${hours} س`;
      const days = Math.floor(hours / 24);
      return `منذ ${days} يوم`;
    } catch {
      return "حديثاً";
    }
  };

  const handleMarkAsApplied = async (project: ProjectItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await fetch("/api/tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          status: "applied",
          notes: "تم التقديم عبر فلاتر Vollna",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAppliedProjectIds((prev) => new Set([...prev, project.id]));
        showToast("✅ تم وضع علامة (تم التقديم) ونقل المشروع للـ CRM");
      }
    } catch (err) {
      showToast("فشل في تحديث حالة التقديم");
    }
  };

  const handleOpenProposalGenerator = (project: ProjectItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProposalModalProject(project);
    setGeneratedProposalText("");
    setCopiedProposal(false);
    setSelectedPortfolioItem(null);
    setPitchAngle("direct");
  };

  const handleExecuteProposalGeneration = (project: ProjectItem, overrideAngle?: "direct" | "action_plan" | "snappy") => {
    const angleToUse = overrideAngle || pitchAngle;
    setGeneratingProposal(true);
    setCopiedProposal(false);

    fetch("/api/proposals/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: project.id,
        project_title: project.title,
        project_description: project.description,
        pitch_angle: angleToUse,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.proposal) {
          setGeneratedProposalText(data.proposal);
          if (data.selectedPortfolio && data.selectedPortfolio.length > 0) {
            setSelectedPortfolioItem({
              id: data.selectedPortfolio[0].id,
              title: data.selectedPortfolio[0].title,
              live_url: data.selectedPortfolio[0].live_url,
            });
          } else {
            setSelectedPortfolioItem(null);
          }
        } else {
          setGeneratedProposalText("⚠️ تعذر توليد العرض: " + (data.error || "حاول مرة أخرى"));
        }
      })
      .catch(() => {
        setGeneratedProposalText("⚠️ تعذر الاتصال بمولد العروض. حاول مرة أخرى.");
      })
      .finally(() => {
        setGeneratingProposal(false);
      });
  };

  const handleRefineProposal = async (refinementType: "shorten" | "casual" | "change_question") => {
    if (!proposalModalProject || !generatedProposalText || refiningProposal) return;
    setRefiningProposal(true);
    try {
      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: proposalModalProject.id,
          project_title: proposalModalProject.title,
          project_description: proposalModalProject.description,
          pitch_angle: pitchAngle,
          refinement_type: refinementType,
          existing_proposal: generatedProposalText,
        }),
      });
      const data = await res.json();
      if (data.ok && data.proposal) {
        setGeneratedProposalText(data.proposal);
        showToast(
          refinementType === "shorten"
            ? "تم اختصار العرض للنصف بنجاح ✂️"
            : refinementType === "casual"
            ? "تمت إعادة الصياغة بنبرة أكثر عفوية 💬"
            : "تم تغيير السؤال الفني الختامي 🔄"
        );
      }
    } catch (e) {
      showToast("تعذر التعديل السريع، حاول مرة أخرى");
    } finally {
      setRefiningProposal(false);
    }
  };

  const handleCopyProposal = () => {
    if (!generatedProposalText) return;
    navigator.clipboard.writeText(generatedProposalText);
    setCopiedProposal(true);
    showToast("📋 تم نسخ العرض للحافظة بنجاح");
    setTimeout(() => setCopiedProposal(false), 2500);
  };

  // Current display budget value based on selected currency
  const displayMinBudget =
    budgetCurrency === "EGP" && usdEgpRate
      ? Math.round(minBudget * usdEgpRate)
      : minBudget;

  const handleBudgetChange = (val: number) => {
    if (budgetCurrency === "EGP" && usdEgpRate) {
      setMinBudget(Math.round(val / usdEgpRate));
    } else {
      setMinBudget(val);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-white text-slate-900 select-none">
      {/* ========================================================================= */}
      {/* 1. FILTER SIDEBAR (Vollna Style Right Sidebar in RTL, 310px Fixed Width)  */}
      {/* ========================================================================= */}
      <aside className="w-full lg:w-[310px] shrink-0 border-l border-slate-200 bg-white flex flex-col h-full overflow-hidden">
        {/* Compact Vollna-style Filter Header (Zero Duplicate Fields) */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/70 shrink-0 space-y-2">
          {/* Top row: Dropdown selector + New Button + Delete */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="relative flex-1">
              <select
                value={selectedFilterId}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "new") {
                    handleSelectNewFilter();
                  } else {
                    const target = savedFilters.find((f) => f.id === val);
                    if (target) applyFilterToState(target);
                  }
                }}
                className="w-full bg-white border border-slate-200 rounded-lg ps-2.5 pe-7 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition appearance-none cursor-pointer truncate"
              >
                <option value="new">+ إنشاء فلتر جديد</option>
                {savedFilters.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.filter_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute start-auto end-2 top-2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={handleSelectNewFilter}
              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 rounded-lg text-xs font-bold transition shrink-0"
              title="إنشاء فلتر جديد"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            {!isNewFilter && selectedFilterId !== "new" && (
              <button
                type="button"
                onClick={handleDeleteFilter}
                className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg text-xs transition shrink-0"
                title="حذف هذا الفلتر"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bottom row: Inline editable name + Instant Save button */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="اسم الفلتر..."
              className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition font-medium"
            />
            <button
              type="button"
              onClick={handleSaveFilter}
              disabled={savingFilter || !filterName.trim()}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shrink-0 shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingFilter ? "حفظ..." : "حفظ"}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Filter Accordions */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
          {/* Accordion 1: Keywords */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection("keywords")}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-start hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="text-emerald-600 font-mono font-black text-sm">#</span>
                <span>الكلمات المفتاحية</span>
                {(includeTags.length > 0 || excludeTags.length > 0) && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {includeTags.length + excludeTags.length}
                  </span>
                )}
              </div>
              {openSections.keywords ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.keywords && (
              <div className="px-3.5 pb-3 space-y-3">
                {/* Include Keywords */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    كلمات مطلوبة:
                  </label>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <input
                      type="text"
                      value={includeInput}
                      onChange={(e) => setIncludeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddIncludeTag();
                        }
                      }}
                      placeholder="اكتب واضغط Enter..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddIncludeTag}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
                    >
                      +
                    </button>
                  </div>
                  {includeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {includeTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-2 py-0.5 rounded"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() =>
                              setIncludeTags(includeTags.filter((t) => t !== tag))
                            }
                            className="hover:text-emerald-950"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exclude Keywords */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    كلمات مستبعدة:
                  </label>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <input
                      type="text"
                      value={excludeInput}
                      onChange={(e) => setExcludeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          handleAddExcludeTag();
                        }
                      }}
                      placeholder="استبعاد (مجاني، ووردبريس...)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddExcludeTag}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-bold text-slate-700"
                    >
                      +
                    </button>
                  </div>
                  {excludeTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {excludeTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() =>
                              setExcludeTags(excludeTags.filter((t) => t !== tag))
                            }
                            className="hover:text-rose-950"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Accordion 2: Budget & Terms */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection("budget")}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-start hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="text-emerald-600 font-bold">$</span>
                <span>الميزانية والشروط</span>
                {minBudget > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                    ${minBudget}+
                  </span>
                )}
              </div>
              {openSections.budget ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.budget && (
              <div className="px-3.5 pb-3 space-y-3">
                {/* Currency toggle & numeric input */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-600">
                      الحد الأدنى:
                    </label>
                    <div className="inline-flex p-0.5 bg-slate-100 rounded-md border border-slate-200">
                      {(["USD", "EGP"] as const).map((cur) => (
                        <button
                          key={cur}
                          type="button"
                          onClick={() => setBudgetCurrency(cur)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                            budgetCurrency === cur
                              ? "bg-white text-slate-900 shadow-2xs"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {cur === "USD" ? "$ دولار" : "ج.م جنيه"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Direct Input & Live Calculation */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        step={budgetCurrency === "EGP" ? "250" : "25"}
                        value={displayMinBudget || ""}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          handleBudgetChange(val);
                        }}
                        placeholder="0"
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <span className="absolute end-2 top-1.5 text-[11px] font-bold text-slate-400 pointer-events-none">
                        {budgetCurrency === "USD" ? "$" : "ج.م"}
                      </span>
                    </div>

                    {usdEgpRate && (
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {budgetCurrency === "USD"
                          ? `≈ ${Math.round(minBudget * usdEgpRate).toLocaleString()} ج.م`
                          : `≈ $${minBudget}`}
                      </span>
                    )}
                  </div>

                  {/* Quick Preset Pills */}
                  <div className="grid grid-cols-5 gap-1 mb-2.5">
                    {budgetCurrency === "USD"
                      ? [0, 50, 100, 250, 500].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleBudgetChange(preset)}
                            className={`py-1 text-[10px] font-mono font-bold rounded border transition ${
                              minBudget === preset
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {preset === 0 ? "الكل" : `$${preset}`}
                          </button>
                        ))
                      : [0, 2500, 5000, 12500, 25000].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleBudgetChange(preset)}
                            className={`py-1 text-[10px] font-mono font-bold rounded border transition ${
                              displayMinBudget === preset
                                ? "bg-emerald-600 border-emerald-600 text-white"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {preset === 0 ? "الكل" : `${preset / 1000}k`}
                          </button>
                        ))}
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min="0"
                    max={budgetCurrency === "EGP" ? "50000" : "1000"}
                    step={budgetCurrency === "EGP" ? "250" : "25"}
                    value={displayMinBudget}
                    onChange={(e) => handleBudgetChange(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                </div>

                {/* Include projects without specified budget checkbox */}
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNoBudget}
                    onChange={(e) => setIncludeNoBudget(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="text-[11px]">إظهار المشاريع غير محددة الميزانية</span>
                </label>
              </div>
            )}
          </div>

          {/* Accordion 3: Competition & Client Quality */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection("quality")}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-start hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="text-emerald-600">🏁</span>
                <span>المنافسة وجودة العميل</span>
                {(maxBids > 0 || minHireRate > 0 || excludeNewClients || jobType !== "any" || clientCountries.length > 0) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                )}
              </div>
              {openSections.quality ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.quality && (
              <div className="px-3.5 pb-3 space-y-3">
                {/* Max bids */}
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600">أقصى عدد عروض:</label>
                    <span className="text-[11px] font-bold text-emerald-600 font-mono">
                      {maxBids === 0 ? "أي عدد" : `${maxBids} عروض أو أقل`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50}
                    step={1}
                    value={maxBids}
                    onChange={(e) => setMaxBids(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                </div>

                {/* Min client hire rate */}
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-600">أقل معدل توظيف للعميل:</label>
                    <span className="text-[11px] font-bold text-emerald-600 font-mono">
                      {minHireRate === 0 ? "أي معدل" : `${minHireRate}%+`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    step={10}
                    value={minHireRate}
                    onChange={(e) => setMinHireRate(parseInt(e.target.value, 10))}
                    className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeNewClients}
                    onChange={(e) => setExcludeNewClients(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span className="text-[11px]">استبعاد العملاء الذين لم يوظفوا أحداً</span>
                </label>

                {/* Job type */}
                <div>
                  <span className="text-[11px] font-bold text-slate-600 block mb-1">نوع الشغل:</span>
                  <div className="grid grid-cols-3 gap-1">
                    {([
                      ["any", "الكل"],
                      ["fixed", "سعر ثابت"],
                      ["hourly", "بالساعة"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setJobType(value)}
                        className={`py-1 rounded-md text-[10px] font-bold border transition ${
                          jobType === value
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Client countries */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600">دولة العميل:</span>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                      <button type="button" onClick={() => setClientCountries(GULF_COUNTRY_CODES)} className="hover:underline">
                        الخليج
                      </button>
                      <span>•</span>
                      <button type="button" onClick={() => setClientCountries([])} className="hover:underline">
                        الكل
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {COUNTRY_OPTIONS.map((c) => {
                      const active = clientCountries.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() =>
                            setClientCountries((prev) =>
                              prev.includes(c.code) ? prev.filter((x) => x !== c.code) : [...prev, c.code]
                            )
                          }
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border transition ${
                            active
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {c.label_ar}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 4: AI Qualifier (Compact & Clean Footprint) */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection("ai")}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-start hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <span className="text-emerald-600">🤖</span>
                <span>شروطك للـ AI</span>
                {aiCriteria.trim() ? (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ≥{aiMinScore}%
                  </span>
                ) : null}
              </div>
              {openSections.ai ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.ai && (
              <div className="px-3.5 pb-3 space-y-2.5">
                <textarea
                  value={aiCriteria}
                  onChange={(e) => setAiCriteria(e.target.value.slice(0, 1000))}
                  rows={2}
                  dir="auto"
                  placeholder="مثال: مشاريع React أو Next.js فقط بميزانية 100$+، استبعد واجبات الجامعة وتعديلات ووردبريس..."
                  className="w-full border border-slate-200 bg-slate-50 rounded-lg p-2 text-xs leading-relaxed focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{aiCriteria.length}/1000 حرف</span>
                  {aiEvalsRemaining !== null && <span>باقي {aiEvalsRemaining} تقييم هذا الشهر</span>}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    تنبيه عند توافق:
                  </label>
                  <div className="grid grid-cols-5 gap-1">
                    {[50, 60, 70, 80, 90].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAiMinScore(v)}
                        className={`text-[10px] font-bold py-1 rounded border transition font-mono ${
                          aiMinScore === v
                            ? "bg-emerald-600 border-emerald-600 text-white"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 5: Sites & Categories */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection("sites")}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-start hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                <span>المنصات والتخصصات</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                  {selectedPlatforms.length} منصة
                </span>
              </div>
              {openSections.sites ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.sites && (
              <div className="px-3.5 pb-3 space-y-3">
                {/* Platform Quick Selection Bar */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <span className="text-[11px] font-bold text-slate-600">
                    المنصات:
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                    <button type="button" onClick={selectOnlyArabPlatforms} className="hover:underline">
                      عربية
                    </button>
                    <span>•</span>
                    <button type="button" onClick={selectOnlyGlobalPlatforms} className="hover:underline">
                      عالمية
                    </button>
                    <span>•</span>
                    <button type="button" onClick={selectAllPlatforms} className="hover:underline">
                      الكل
                    </button>
                  </div>
                </div>

                {/* Arab Platforms */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    منصات العمل الحر العربية ({ARAB_PLATFORMS.length}):
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {ARAB_PLATFORMS.map((plat) => {
                      const isChecked = selectedPlatforms.includes(plat.id);
                      return (
                        <label
                          key={plat.id}
                          className={`flex items-center gap-1.5 p-1 rounded-md border text-[11px] cursor-pointer transition ${
                            isChecked
                              ? "bg-emerald-50/50 border-emerald-300 text-slate-900 font-bold"
                              : "bg-white border-slate-100 text-slate-400 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePlatform(plat.id)}
                            className="sr-only"
                          />
                          <PlatformLogo platform={plat.id} size={16} className="shrink-0" />
                          <span className="truncate">{plat.label_ar.split(" ")[0]}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Global Platforms */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">
                    المنصات العالمية ({GLOBAL_PLATFORMS.length}):
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {GLOBAL_PLATFORMS.map((plat) => {
                      const isChecked = selectedPlatforms.includes(plat.id);
                      return (
                        <label
                          key={plat.id}
                          className={`flex items-center gap-1.5 p-1 rounded-md border text-[11px] cursor-pointer transition ${
                            isChecked
                              ? "bg-emerald-50/50 border-emerald-300 text-slate-900 font-bold"
                              : "bg-white border-slate-100 text-slate-400 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePlatform(plat.id)}
                            className="sr-only"
                          />
                          <PlatformLogo platform={plat.id} size={16} className="shrink-0" />
                          <span className="truncate">{plat.label_en}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* 14 Categories */}
                <div>
                  <div className="flex items-center justify-between mb-1 pt-1.5 border-t border-slate-100">
                    <label className="text-[10px] font-bold text-slate-400">
                      التخصصات ({selectedCategories.length}/14):
                    </label>
                    <button
                      type="button"
                      onClick={selectAllCategories}
                      className="text-[10px] font-bold text-emerald-600 hover:underline"
                    >
                      تحديد الكل
                    </button>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto pe-1">
                    {CATEGORIES_METADATA.map((cat) => {
                      const isChecked = selectedCategories.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-2 p-1 rounded-md border text-xs cursor-pointer transition ${
                            isChecked
                              ? "bg-emerald-50/40 border-emerald-200/80 text-slate-900 font-bold"
                              : "bg-white border-slate-100 text-slate-400 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCategory(cat.id)}
                            className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                          />
                          <span className="text-xs shrink-0">{cat.icon}</span>
                          <span className="truncate text-[11px]">{cat.label_ar}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Accordion 6: Advanced Filters */}
          <div>
            <button
              type="button"
              onClick={() => toggleSection("advanced")}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-start hover:bg-slate-50 transition"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" />
                <span>فلاتر متقدمة</span>
              </div>
              {openSections.advanced ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {openSections.advanced && (
              <div className="px-3.5 pb-3 space-y-3">
                {/* Language */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    لغة المشروع:
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: "all", label: "الكل" },
                      { id: "ar", label: "عربي" },
                      { id: "en", label: "إنجليزية" },
                    ].map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setLanguage(l.id)}
                        className={`py-1 text-xs font-bold rounded border transition ${
                          language === l.id
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time range */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    تاريخ النشر:
                  </label>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="all">كل الأوقات</option>
                    <option value="24h">آخر 24 ساعة فقط</option>
                    <option value="3d">آخر 3 أيام</option>
                    <option value="7d">آخر أسبوع</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Footer Info */}
        <div className="p-2.5 border-t border-slate-200 bg-white flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <span>المطابقة:</span>
            <span className="font-bold text-emerald-600 font-mono text-xs">
              {filteredProjects.length} مشروعاً
            </span>
          </div>
          <button
            type="button"
            onClick={handleSelectNewFilter}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition"
            title="إعادة ضبط الفلتر"
          >
            <RotateCcw className="w-3 h-3" />
            <span>إعادة ضبط</span>
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN RESULTS AREA & HIGH-DENSITY TABLE (Vollna Style Live Workspace)   */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {/* Results Toolbar */}
        <div className="border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          {/* Matched Count & Active Filter Badge & Quick Search */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span className="font-mono text-base text-emerald-600">{filteredProjects.length}</span>
              <span className="font-medium text-slate-500 text-xs">مشاريع مطابقة</span>
            </h1>

            {selectedFilterId !== "new" && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                {filterName}
              </span>
            )}

            {/* Quick in-table search input */}
            <div className="relative w-44 sm:w-56">
              <input
                type="text"
                value={workspaceSearch}
                onChange={(e) => setWorkspaceSearch(e.target.value)}
                placeholder="بحث سريع في النتائج..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg ps-7 pe-2 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute start-2 top-2 pointer-events-none" />
              {workspaceSearch && (
                <button
                  type="button"
                  onClick={() => setWorkspaceSearch("")}
                  className="absolute end-2 top-1.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 3 Vollna Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Action 1: Setup Proposal Generator */}
            <button
              type="button"
              onClick={() => setShowSetupGeneratorModal(true)}
              className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">ربط مولد العروض</span>
            </button>

            {/* Action 2: AI Batch Qualifier */}
            <button
              type="button"
              onClick={handleBatchQualify}
              disabled={batchQualifying}
              className="bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>{batchQualifying ? "جاري الفحص..." : "فحص أول 10 بالـ AI"}</span>
            </button>

            {/* Action 3: Job Alerts Toggle */}
            <button
              type="button"
              onClick={handleToggleJobAlerts}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs border ${
                notifyTelegram
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {notifyTelegram ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                  <span>تنبيهات تليجرام (مفعلة)</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>تنبيهات تليجرام</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Compact Table */}
        <div className="flex-1 overflow-y-auto">
          {loadingProjects ? (
            <div className="p-16 text-center">
              <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500 font-medium">
                جاري قراءة وتصفية المشاريع لحظياً من قاعدة البيانات...
              </p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Filter className="w-5 h-5" />
              </div>
              <h3 className="text-xs font-bold text-slate-800 mb-1">
                لا توجد مشاريع مطابقة لمعايير هذا الفلتر
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
                جرب تخفيف الكلمات المستبعدة أو تقليل الحد الأدنى للميزانية أو تضمين منصات أخرى.
              </p>
              <button
                type="button"
                onClick={handleSelectNewFilter}
                className="py-1 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold"
              >
                إعادة ضبط الفلتر
              </button>
            </div>
          ) : (
            <div className="w-full">
              {/* High-Density Table Header */}
              <div className="grid grid-cols-12 px-4 sm:px-6 py-2 bg-slate-50/90 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                <div className="col-span-7 sm:col-span-6 flex items-center gap-2">
                  <span>عنوان المشروع والمنصة</span>
                </div>
                <div className="col-span-2 hidden sm:flex items-center justify-center">
                  <span>توافق الـ AI</span>
                </div>
                <div className="col-span-2 sm:col-span-2 text-start">
                  <span>الميزانية</span>
                </div>
                <div className="col-span-3 sm:col-span-2 text-end">
                  <span>النشر والتقييم</span>
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-slate-100">
                {filteredProjects.map((project) => {
                  const isExpanded = expandedProjectId === project.id;
                  const platformMeta = PLATFORM_MAP.get(project.platform) || {
                    id: project.platform as FreelancePlatform,
                    label_ar: project.platform,
                    label_en: project.platform,
                    badge_color: "bg-slate-700",
                    text_color: "text-white",
                    border_color: "border-slate-800",
                    region: "global",
                    icon_letter: project.platform.slice(0, 1).toUpperCase(),
                    website_url: "#",
                  };

                  const matchScore = qualifyMap[project.id];
                  const isQualifyingThis = qualifyingId === project.id;
                  const isApplied = appliedProjectIds.has(project.id);

                  return (
                    <div key={project.id} className="group">
                      {/* Compact Row */}
                      <div
                        onClick={() =>
                          setExpandedProjectId(isExpanded ? null : project.id)
                        }
                        className={`grid grid-cols-12 px-4 sm:px-6 py-2.5 items-center cursor-pointer transition-colors text-xs ${
                          isExpanded
                            ? "bg-slate-50/90 border-b border-slate-200"
                            : "hover:bg-slate-50/70 bg-white"
                        }`}
                      >
                        {/* Col 1: Title & Platform Logo */}
                        <div className="col-span-7 sm:col-span-6 flex items-center gap-2 overflow-hidden pe-2">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                          )}

                          <PlatformLogo platform={project.platform} size={18} className="shrink-0" />

                          <span
                            dir="auto"
                            className="font-medium text-slate-800 group-hover:text-emerald-700 truncate transition-colors"
                          >
                            {project.title}
                          </span>

                          {isApplied && (
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 shrink-0">
                              تم التقديم
                            </span>
                          )}
                        </div>

                        {/* Col 2: Qualify AI Score */}
                        <div className="col-span-2 hidden sm:flex items-center justify-center">
                          {matchScore !== undefined ? (
                            <span
                              title={matchScore.reason}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-help font-mono ${
                                matchScore.score >= aiMinScore
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : matchScore.score >= 40
                                  ? "bg-amber-50 text-amber-700 border-amber-300"
                                  : "bg-rose-50 text-rose-700 border-rose-300"
                              }`}
                            >
                              {matchScore.score}% توافق
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => handleQualifySingle(project, e)}
                              disabled={isQualifyingThis}
                              className="border border-slate-200 rounded px-2 py-0.5 text-[10px] text-slate-600 hover:border-emerald-500 hover:text-emerald-700 hover:bg-emerald-50/50 transition flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3 text-emerald-600" />
                              <span>{isQualifyingThis ? "فحص..." : "فحص التوافق"}</span>
                            </button>
                          )}
                        </div>

                        {/* Col 3: Budget */}
                        <div className="col-span-2 sm:col-span-2 text-start truncate pe-2">
                          {project.budget && project.budget !== "not specified" ? (
                            <span className="font-bold text-emerald-600 font-mono text-xs">
                              {project.budget}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">
                              غير محدد
                            </span>
                          )}
                        </div>

                        {/* Col 4: Published & Quality Score */}
                        <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-2">
                          <span className="text-[10px] text-slate-500 shrink-0 font-medium">
                            {formatRelativeTime(project.published_at)}
                          </span>

                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold shrink-0 border ${
                              project.quality_score >= 4
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                : project.quality_score >= 3
                                ? "bg-amber-50 text-amber-700 border-amber-300"
                                : "bg-rose-50 text-rose-700 border-rose-300"
                            }`}
                            title={`تقييم الجودة: ${project.quality_score}/5`}
                          >
                            {project.quality_score}
                          </span>
                        </div>
                      </div>

                      {/* Expandable Master-Detail Row */}
                      {isExpanded && (
                        <div className="bg-slate-50/90 border-b border-slate-200 px-4 sm:px-6 py-3.5 space-y-3 transition">
                          {/* Project Description */}
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                            <p
                              dir="auto"
                              className="text-xs text-slate-700 leading-relaxed whitespace-pre-line select-text"
                            >
                              {project.description}
                            </p>
                          </div>

                          {/* Metadata row */}
                          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="flex items-center gap-1">
                                <PlatformLogo platform={project.platform} size={14} />
                                <strong className="text-slate-800">{platformMeta.label_ar}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                التخصص:{" "}
                                <strong className="text-slate-800">
                                  {CATEGORIES_METADATA.find((c) => c.id === project.category)?.label_ar || project.category}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                الناشر: <strong className="text-slate-800">{project.author}</strong>
                              </span>
                              {project.client_country && (
                                <>
                                  <span>•</span>
                                  <span>الدولة: <strong className="text-slate-800">{project.client_country}</strong></span>
                                </>
                              )}
                              {typeof project.bids_count === "number" && (
                                <>
                                  <span>•</span>
                                  <span>العروض: <strong className="text-slate-800">{project.bids_count}</strong></span>
                                </>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={project.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                              >
                                <span>🔗 فتح المشروع الأصلي</span>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                              </a>

                              <button
                                type="button"
                                onClick={(e) => handleOpenProposalGenerator(project, e)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-2xs"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>✨ توليد عرض بالـ AI</span>
                              </button>

                              {!isApplied && (
                                <button
                                  type="button"
                                  onClick={(e) => handleMarkAsApplied(project, e)}
                                  className="px-3 py-1.5 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>وضع علامة تم التقديم</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. MODALS                                                                 */}
      {/* ========================================================================= */}

      {/* Modal A: Setup Proposal Generator */}
      {showSetupGeneratorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  ⚡
                </div>
                <h3 className="text-sm font-black text-slate-900">
                  ربط الفلتر بمولد العروض التلقائي
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupGeneratorModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              اختر قالب العرض الافتراضي لاعتماده عند توليد عروض ذكية للمشاريع عبر فلتر{" "}
              <strong>"{filterName}"</strong>:
            </p>

            <div className="space-y-1.5 mb-4 max-h-56 overflow-y-auto">
              {templates.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                  لا توجد قوالب عروض محفوظة حالياً. يمكنك إنشاء قالب من صفحة{" "}
                  <a href="/templates" className="text-emerald-600 font-bold underline">
                    قوالب العروض
                  </a>
                  .
                </div>
              ) : (
                templates.map((tpl) => (
                  <label
                    key={tpl.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                      selectedTemplateId === tpl.id
                        ? "bg-emerald-50/60 border-emerald-500 text-slate-900 font-bold"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{tpl.name}</span>
                    <input
                      type="radio"
                      name="default_template"
                      checked={selectedTemplateId === tpl.id}
                      onChange={() => setSelectedTemplateId(tpl.id)}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSetupGeneratorModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSetupGeneratorModal(false);
                  showToast("⚡ تم ربط الفلتر بقالب العرض بنجاح");
                }}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs"
              >
                حفظ الربط
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal B: AI Proposal Generator Result */}
      {proposalModalProject && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900 truncate max-w-md">
                  عرض مقترح: {proposalModalProject.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setProposalModalProject(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pitch Angle Selector Toolbar */}
            <div className="p-3 mb-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-black text-slate-800 shrink-0">الزاوية:</span>
                <button
                  type="button"
                  onClick={() => setPitchAngle("direct")}
                  disabled={generatingProposal || refiningProposal}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                    pitchAngle === "direct"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>🎯 مباشر + سابقة أعمال</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPitchAngle("action_plan")}
                  disabled={generatingProposal || refiningProposal}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                    pitchAngle === "action_plan"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>🛠️ خطة عمل (1-2-3)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPitchAngle("snappy")}
                  disabled={generatingProposal || refiningProposal}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                    pitchAngle === "snappy"
                      ? "bg-emerald-600 text-white shadow-2xs"
                      : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <span>⚡ خاطف (4 أسطر)</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleExecuteProposalGeneration(proposalModalProject)}
                disabled={generatingProposal || refiningProposal}
                className="h-7 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {generatingProposal ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري الصياغة...</span>
                  </>
                ) : generatedProposalText ? (
                  <>
                    <RotateCcw className="w-3 h-3 text-emerald-400" />
                    <span>إعادة صياغة بهذه الزاوية</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>صياغة العرض البشري</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-3">
              {generatingProposal ? (
                <div className="py-14 text-center">
                  <div className="w-7 h-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-600 font-bold">
                    الذكاء الاصطناعي يقوم الآن بتشخيص طلب العميل وصياغة رد بشري مقنع...
                  </p>
                </div>
              ) : generatedProposalText ? (
                <div className="space-y-2">
                  <div className="relative">
                    <textarea
                      rows={9}
                      value={generatedProposalText}
                      onChange={(e) => setGeneratedProposalText(e.target.value)}
                      dir="auto"
                      disabled={refiningProposal}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 leading-relaxed focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans select-text disabled:opacity-60"
                    />
                    {refiningProposal && (
                      <div className="absolute inset-0 bg-white/70 backdrop-blur-xs rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
                        <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                        <span>جاري التعديل البشري السريع...</span>
                      </div>
                    )}
                  </div>

                  {/* Portfolio Citation Badge */}
                  {selectedPortfolioItem && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-200/80 text-xs font-bold">
                      <Sparkles className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>✨ تم ربط العرض بـ: </span>
                      {selectedPortfolioItem.live_url ? (
                        <a
                          href={selectedPortfolioItem.live_url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-emerald-700 font-black inline-flex items-center gap-1"
                        >
                          <span>{selectedPortfolioItem.title}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="font-black">{selectedPortfolioItem.title}</span>
                      )}
                    </div>
                  )}

                  {/* 1-Click Human Refinements */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] font-bold text-slate-400">تعديل سريع:</span>
                    <button
                      type="button"
                      onClick={() => handleRefineProposal("shorten")}
                      disabled={refiningProposal || generatingProposal}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      ✂️ اختصر للنصف
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRefineProposal("casual")}
                      disabled={refiningProposal || generatingProposal}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      💬 أكثر عفوية
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRefineProposal("change_question")}
                      disabled={refiningProposal || generatingProposal}
                      className="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      🔄 غيّر السؤال الختامي
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center rounded-xl bg-slate-50/70 border border-dashed border-slate-200">
                  <Sparkles className="w-7 h-7 text-emerald-500 mx-auto mb-2 opacity-80" />
                  <p className="text-xs font-bold text-slate-800">جاهز لصياغة العرض البشري</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    اختر الزاوية بالأعلى ثم اضغط &quot;صياغة العرض البشري&quot;
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 flex-wrap gap-2">
              <span className="text-[11px] text-slate-500">
                يمكنك تعديل نص العرض مباشرة قبل نسخه
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyProposal}
                  disabled={generatingProposal || !generatedProposalText}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  {copiedProposal ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>نسخ العرض</span>
                    </>
                  )}
                </button>

                <a
                  href={proposalModalProject.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    handleMarkAsApplied(proposalModalProject);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                >
                  <span>🚀 فتح المنصة والتقديم</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 start-5 z-50 bg-slate-900 text-white px-3.5 py-2 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
