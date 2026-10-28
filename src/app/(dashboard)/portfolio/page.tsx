"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Trash2,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  Save,
  Link as LinkIcon,
  X,
  Tag,
  Zap,
  Edit2,
  AlertCircle,
  UploadCloud,
  FileText,
  Globe,
  ClipboardList,
  ArrowRight,
  ShieldCheck,
  Check,
  ChevronRight,
} from "lucide-react";

interface PortfolioItem {
  id: string;
  project_title: string;
  description: string;
  live_url?: string | null;
  tags: string[];
  category: string;
  created_at?: string;
}

interface FreelancerProfile {
  id: string;
  full_name: string;
  title: string;
  bio: string;
  skills: string[];
  tone_of_voice: string;
  standing_instructions?: string;
  writing_sample?: string;
}

export default function PortfolioPage() {
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [toastMessage, setToastMessage] = useState("");

  // Importer state
  const [activeTab, setActiveTab] = useState<"upwork" | "platform_url" | "raw_text">("upwork");
  const [upworkUrl, setUpworkUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [importSuccessData, setImportSuccessData] = useState<{
    count: number;
    fullName?: string;
    headline?: string;
  } | null>(null);

  // Item form state
  const [itemTitle, setItemTitle] = useState("");
  const [itemDesc, setItemDesc] = useState("");
  const [itemLiveUrl, setItemLiveUrl] = useState("");
  const [itemTagsText, setItemTagsText] = useState("");
  const [itemCategory, setItemCategory] = useState("web_dev");
  const [savingItem, setSavingItem] = useState(false);

  // Proposal Simulator state
  const [simulatorJobText, setSimulatorJobText] = useState(
    "مطلوب مبرمج خبير لبناء منصة SaaS بـ Next.js و Supabase مع ربط بوابات دفع وواجهة تحكم متقدمة."
  );
  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  // Human Voice & Rules state
  const [standingInstructions, setStandingInstructions] = useState("");
  const [writingSample, setWritingSample] = useState("");
  const [savingVoice, setSavingVoice] = useState(false);

  const fetchPortfolioData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio");
      const data = await res.json();
      if (data.ok) {
        setProfile(data.profile);
        setStandingInstructions(data.profile?.standing_instructions || "");
        setWritingSample(data.profile?.writing_sample || "");
        setPortfolioItems(data.portfolio_items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHumanVoice = async () => {
    setSavingVoice(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_human_voice",
          standing_instructions: standingInstructions,
          writing_sample: writingSample,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("تم حفظ بصمتك الشخصية وقواعد الصياغة بنجاح ✍️");
      } else {
        alert(data.error || "فشل حفظ البصمة الشخصية");
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء الحفظ: " + err.message);
    } finally {
      setSavingVoice(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 5000);
  };

  // Handle Importer Submission
  const handleImport = async () => {
    if (activeTab === "upwork" && !upworkUrl.trim()) {
      alert("يرجى إدخال رابط بروفايل Upwork أولاً");
      return;
    }
    if (activeTab === "platform_url" && !profileUrl.trim()) {
      alert("يرجى إدخال رابط الحساب (مستقل، خمسات، نفذلي، أو GitHub)");
      return;
    }
    if (activeTab === "raw_text" && !rawText.trim()) {
      alert("يرجى لصق نص البروفايل أو النبذة أولاً");
      return;
    }

    setImporting(true);
    setImportSuccessData(null);
    setImportProgress("جاري تجهيز البيانات وإرسالها إلى محرك الذكاء الاصطناعي...");

    try {
      const formData = new FormData();

      if (activeTab === "upwork") {
        setImportProgress("جاري سحب بيانات بروفايل Upwork واستخراج الأعمال والمهارات عبر الذكاء الاصطناعي...");
        formData.append("profileUrl", upworkUrl.trim());
      } else if (activeTab === "platform_url") {
        setImportProgress("جاري جلب بيانات الحساب وتحليل المشاريع المنجزة عبر الذكاء الاصطناعي...");
        formData.append("profileUrl", profileUrl.trim());
      } else {
        setImportProgress("جاري قراءة النص الخام وتنسيقه هيكلياً عبر الذكاء الاصطناعي...");
        formData.append("rawText", rawText.trim());
      }

      const res = await fetch("/api/portfolio/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "فشل استيراد سابقة الأعمال");
      }

      setImportSuccessData({
        count: data.importedCount || 0,
        fullName: data.profile?.fullName,
        headline: data.profile?.headline,
      });

      if ((data.importedCount || 0) > 0) {
        showToast(`🎉 تم بنجاح استيراد ${data.importedCount} عملاً وتحديث ملفك الشخصي في Supabase!`);
      } else {
        showToast(`ℹ️ تم تحديث بيانات البروفايل، ولم يتم العثور على أي مشاريع معروضة في الرابط.`);
      }

      // Refresh portfolio items
      await fetchPortfolioData();

      // Reset input fields
      setProfileUrl("");
      setRawText("");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "حدث خطأ أثناء الاستيراد");
    } finally {
      setImporting(false);
      setImportProgress("");
    }
  };

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setItemTitle("");
    setItemDesc("");
    setItemLiveUrl("");
    setItemTagsText("");
    setItemCategory("web_dev");
    setShowItemModal(true);
  };

  const handleOpenEditModal = (item: PortfolioItem) => {
    setEditingItem(item);
    setItemTitle(item.project_title);
    setItemDesc(item.description);
    setItemLiveUrl(item.live_url || "");
    setItemTagsText((item.tags || []).join(", "));
    setItemCategory(item.category || "web_dev");
    setShowItemModal(true);
  };

  const handleDeleteItem = async (id: string, title: string) => {
    if (!confirm(`هل أنت متأكد من حذف مشروع "${title}" من سابقة أعمالك؟`)) return;

    setPortfolioItems((prev) => prev.filter((i) => i.id !== id));
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_item", id }),
      });
      if (res.ok) {
        showToast(`تم حذف المشروع "${title}" من قاعدة البيانات`);
      }
    } catch (e) {
      fetchPortfolioData();
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) return;

    setSavingItem(true);
    const tagsArr = itemTagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      action: editingItem ? "edit_item" : "add_item",
      id: editingItem?.id,
      project_title: itemTitle.trim(),
      description: itemDesc.trim(),
      live_url: itemLiveUrl.trim() || null,
      tags: tagsArr,
      category: itemCategory,
    };

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        setShowItemModal(false);
        showToast(
          editingItem
            ? "تم تحديث المشروع في سابقة أعمالك بنجاح!"
            : "تمت إضافة المشروع الجديد إلى Supabase بنجاح!"
        );
        fetchPortfolioData();
      } else {
        alert(data.error || "فشل حفظ المشروع");
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء حفظ المشروع: " + err.message);
    } finally {
      setSavingItem(false);
    }
  };

  const handleSimulate = async () => {
    if (!simulatorJobText.trim()) return;
    setSimulating(true);
    setSimulationResult(null);

    try {
      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_title: "طلب مشروع محاكي",
          project_description: simulatorJobText,
          freelancer_bio: profile?.bio,
          freelancer_skills: (profile?.skills || []).join(", "),
        }),
      });

      const data = await res.json();
      if (data.ok && data.proposal) {
        setSimulationResult(data.proposal);
      } else {
        setSimulationResult("تعذر توليد العرض التجريبي: " + (data.error || "خطأ غير معروف"));
      }
    } catch (err: any) {
      setSimulationResult("حدث خطأ أثناء المحاكاة.");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-2xl flex items-center gap-3 border border-emerald-500/30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Briefcase className="w-6 h-6 text-emerald-600" />
            <span>مخزن سابقة الأعمال ومعرض المشاريع (AI Vault)</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            استورد أعمالك السابقة بنقرة زر واحدة أو أضفها يدوياً ليستشهد بها محرك الذكاء الاصطناعي كدليل عملي في كل عرض يُرسل للعملاء.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/profile-audit"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>فحص البروفايل الذكي</span>
          </Link>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة عمل يدوياً</span>
          </button>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 🚀 ONE-CLICK PORTFOLIO IMPORTER COMPONENT */}
      {/* ====================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[11px] font-bold mb-2">
              <Zap className="w-3 h-3 text-emerald-600" />
              <span>استيراد ذكي بنقرة واحدة</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              استيراد معرض الأعمال والبروفايل تلقائياً (One-Click Importer)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              يدعم قراءة بروفايل Upwork عبر الرابط مباشرة، بالإضافة لروابط منصات العمل الحر العربية وحسابات GitHub.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("upwork")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "upwork"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>Upwork</span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                موصى به
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("platform_url")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "platform_url"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>مستقل / خمسات / نفذلي / GitHub</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("raw_text")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === "raw_text"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-slate-600" />
              <span>نص خام</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Upwork */}
        {activeTab === "upwork" && (
          <div className="pt-5 space-y-4">
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
              <p className="text-[11px] text-slate-500 mt-1.5">
                الصق رابط حسابك في Upwork وسيتم سحب الخبرات والمهارات وسابقة أعمالك المتاحة وتحليلها تلقائياً بالذكاء الاصطناعي.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Profile URL */}
        {activeTab === "platform_url" && (
          <div className="pt-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap text-[11px] font-bold text-slate-600">
              <span className="text-slate-400 font-normal">المنصات المدعومة:</span>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded-md border border-emerald-200/60 font-bold">
                Upwork
              </span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md border border-blue-200/60">
                مستقل (Mostaql)
              </span>
              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-200/60">
                خمسات (Khamsat)
              </span>
              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md border border-purple-200/60">
                نفذلي (Nafezly)
              </span>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded-md border border-slate-200">
                GitHub Repositories
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                أدخل رابط صفحتك الشخصية:
              </label>
              <div className="relative">
                <input
                  type="url"
                  dir="ltr"
                  placeholder="https://www.upwork.com/freelancers/~... أو https://mostaql.com/u/username"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  className="w-full px-4 py-3 pl-10 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 transition"
                />
                <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1.5">
                يقوم النظام تلقائياً بسحب صفحة النبذة ومعرض الأعمال واستخراج كافة المشاريع ومهاراتك.
              </p>
            </div>
          </div>
        )}

        {/* Tab 3: Raw Text */}
        {activeTab === "raw_text" && (
          <div className="pt-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الصق نص النبذة التعريفية، أو السيرة الذاتية، أو ملخص مشاريعك السابقة:
              </label>
              <textarea
                rows={5}
                placeholder="الصق هنا نص البروفايل، الخبرات، قائمة المشاريع التي نفذتها، التقنيات المستخدمة..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-600 leading-relaxed transition"
              />
            </div>
          </div>
        )}

        {/* Action Button & Loading Progress */}
        <div className="pt-5 mt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-xs text-slate-500">
            {importing && (
              <div className="flex items-center gap-2.5 text-emerald-700 font-bold animate-pulse">
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>{importProgress}</span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>{importing ? "جاري الاستيراد والتحليل..." : "بدء الاستيراد الذكي للبروفايل الآن"}</span>
          </button>
        </div>

        {/* Import Success / Status Banner */}
        {importSuccessData && (
          importSuccessData.count > 0 ? (
            <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black">
                    تم استيراد {importSuccessData.count} عملاً بنجاح إلى مخزن سابقة أعمالك!
                  </h4>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    تم تحديث اسمك وعنوانك ومهاراتك في ملفك الشخصي. سيتم الاستشهاد بهذه الأعمال تلقائياً في العروض القادمة.
                  </p>
                </div>
              </div>

              <Link
                href="/profile-audit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 shadow-xs transition"
              >
                <span>افحص واكتشف أخطاء بروفايلك الآن</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </Link>
            </div>
          ) : (
            <div className="mt-5 p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-amber-950">
                    لم يتم العثور على أي مشاريع معروضة في هذا الرابط (معرض الأعمال فارغ)
                  </h4>
                  <p className="text-[11px] text-amber-900/90 mt-0.5">
                    تم تحديث بياناتك الشخصية (الاسم، العنوان، والمهارات) بنجاح. لم نقم بإنشاء أي مشاريع افتراضية لضمان دقة معرض أعمالك. يمكنك إضافة مشاريعك يدوياً أو مراجعة فحص البروفايل.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة عمل يدوياً</span>
                </button>

                <Link
                  href="/profile-audit"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xs transition"
                >
                  <span>فحص البروفايل</span>
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                </Link>
              </div>
            </div>
          )
        )}
      </div>

      {/* ====================================================================== */}
      {/* ✍️ HUMAN VOICE & RULES (CLONING & STANDING INSTRUCTIONS) */}
      {/* ====================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-[11px] font-bold mb-2">
              <Sparkles className="w-3 h-3 text-indigo-600" />
              <span>محاكاة الأسلوب البشري (Style Cloning)</span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              ✍️ بصمتك الشخصية في كتابة العروض (Human Voice & Rules)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              حدد شروطك الثابتة ونموذجاً حقيقياً من أسلوبك في الكتابة ليتعلم الذكاء الاصطناعي نبرتك الطبيعية ومفرداتك ويطبقها في كل عرض.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveHumanVoice}
            disabled={savingVoice}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition disabled:opacity-50 self-start sm:self-auto cursor-pointer"
          >
            {savingVoice ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 text-emerald-400" />
                <span>حفظ البصمة الشخصية</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
          {/* Standing Instructions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="standing-instructions" className="block text-xs font-black text-slate-800">
                1. شروطك ومميزاتك الثابتة (Standing Instructions)
              </label>
              <span className="text-[11px] text-slate-400 font-medium">تُطبق في كل العروض</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              شروط عملك الخاصة، الضمانات التي تقدمها، أو ميزاتك التنافسية الثابتة.
            </p>
            <textarea
              id="standing-instructions"
              rows={4}
              value={standingInstructions}
              onChange={(e) => setStandingInstructions(e.target.value)}
              placeholder="مثال: أقدم دعم فني مجاني وضمان صيانة لمدة 30 يوماً بعد التسليم، وأفضّل تقسيم العمل على مراحل واضحة (Milestones)، وتوثيق الكود بالكامل على GitHub..."
              dir="auto"
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition leading-relaxed font-sans"
            />
          </div>

          {/* Writing Sample */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="writing-sample" className="block text-xs font-black text-slate-800">
                2. نموذج عرض حقيقي كتبته بيدك سابقاً (Style Cloning)
              </label>
              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200/60 px-2 py-0.5 rounded-full font-bold">
                اختياري
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              الصق نص عرض حقيقي كتبته بنفسك وربحت به مشروعاً، ليحاكي الـ AI طول جملك ونبرتك الطبيعية.
            </p>
            <textarea
              id="writing-sample"
              rows={4}
              value={writingSample}
              onChange={(e) => setWritingSample(e.target.value)}
              placeholder="مثال: أهلاً أحمد، اطلعت على مشكلة بطء تحميل المتجر عندك. السبب غالباً في استعلامات قاعدة البيانات للصور غير المضغوطة. في مشروعي السابق لمتجر فلان قمت بإعادة هيكلة الـ queries وخفضت وقت التحميل من 4 ثوانٍ إلى 0.8 ثانية. هل تستخدم قالب ووكومرس جاهز أم مخصص؟"
              dir="auto"
              className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-600 transition leading-relaxed font-sans"
            />
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* 📁 PORTFOLIO ITEMS VAULT GRID */}
      {/* ====================================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <span>الأعمال المسجلة في الـ AI Vault ({portfolioItems.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              يختار الذكاء الاصطناعي أفضل عمل أو عملين مناسبين لكل طلب عميل جديد تلقائياً.
            </p>
          </div>

          {portfolioItems.length > 0 && (
            <button
              onClick={handleOpenCreateModal}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              + إضافة مشروع آخر
            </button>
          )}
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">جاري قراءة سابقة أعمالك من Supabase...</p>
          </div>
        ) : portfolioItems.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 mb-1">لا توجد أعمال مضافة بعد</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
              استخدم أداة الاستيراد أعلاه لرفع بروفايل Upwork أو وضع رابط مستقل، أو أضف مشاريعك يدوياً.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold"
            >
              + إضافة أول مشروع يدوياً
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {portfolioItems.map((item) => (
              <div
                key={item.id}
                className="p-5 sm:p-6 bg-white border border-slate-200/90 rounded-3xl shadow-xs hover:border-slate-300 transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-sm font-black text-slate-900 leading-snug group-hover:text-emerald-800 transition">
                      {item.project_title}
                    </h4>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        title="تعديل المشروع"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id, item.project_title)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="حذف المشروع"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed line-clamp-3 mb-4">
                    {item.description}
                  </p>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mb-4">
                      {item.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200/50"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  {item.live_url ? (
                    <a
                      href={item.live_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-emerald-700 font-bold hover:underline"
                    >
                      <span>معاينة الرابط الحي</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400">بدون رابط مباشر</span>
                  )}

                  <span className="text-[11px] text-slate-400 font-mono">
                    {item.category === "web_dev"
                      ? "تطوير مواقع"
                      : item.category === "design"
                      ? "تصميم وUI/UX"
                      : item.category === "writing"
                      ? "كتابة وترجمة"
                      : item.category === "marketing"
                      ? "تسويق وSEO"
                      : item.category === "accounting"
                      ? "محاسبة ومالية"
                      : item.category}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ====================================================================== */}
      {/* 🔮 AI PROPOSAL SIMULATOR */}
      {/* ====================================================================== */}
      <div className="p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl shadow-xs mt-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                محاكي توليد العروض الذكية مع الاستشهاد بأعمالك
              </h3>
              <p className="text-[11px] text-slate-500">
                اختبر كيف يقوم محرك Gemini بدمج سابقة أعمالك المسجلة أعلاه لصياغة عرض فائق الإقناع للعميل.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              نص طلب العميل التجريبي:
            </label>
            <textarea
              rows={3}
              value={simulatorJobText}
              onChange={(e) => setSimulatorJobText(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 leading-relaxed"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSimulate}
              disabled={simulating}
              className="py-2.5 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>{simulating ? "جاري التوليد بالذكاء الاصطناعي..." : "توليد عرض تجريبي الآن"}</span>
            </button>
          </div>

          {simulationResult && (
            <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>نتيجة العرض المولد مع استشهاد سابقة الأعمال:</span>
                </span>
              </div>
              <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                {simulationResult}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* ✏️ ADD / EDIT ITEM MODAL */}
      {/* ====================================================================== */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-slate-200 shadow-2xl text-right max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-600" />
                <span>{editingItem ? "تعديل مشروع سابقة الأعمال" : "إضافة مشروع جديد للسابقة"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان المشروع
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: متجر إلكتروني بنظام Next.js 15 و Stripe"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رابط المشروع الحي (إن وجد)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={itemLiveUrl}
                  onChange={(e) => setItemLiveUrl(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 text-left dir-ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المهارات والتقنيات المستخدمة (مفصولة بفواصل)
                </label>
                <input
                  type="text"
                  placeholder="Next.js, TypeScript, TailwindCSS, Supabase, Stripe"
                  value={itemTagsText}
                  onChange={(e) => setItemTagsText(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  التصنيف الرئيسي
                </label>
                <select
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="web_dev">تطوير وبرمجة المواقع (Web Dev)</option>
                  <option value="design">تصميم وواجهات مستخدم (Design & UI/UX)</option>
                  <option value="marketing">تسويق وإعلانات (Marketing & SEO)</option>
                  <option value="writing">كتابة وترجمة (Writing & Content)</option>
                  <option value="accounting">محاسبة واستشارات مالية (Accounting)</option>
                  <option value="other">أخرى (Other)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  وصف المشروع والمشاكل التي تم حلها
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="اشرح ما الذي قمت ببنائه في هذا المشروع، والتقنيات المستخدمة ومعدل الأداء..."
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="py-2 px-4 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingItem ? "جاري الحفظ..." : "حفظ المشروع في Supabase"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
