"use client";

import { useEffect, useState } from "react";
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
  Code,
  Layers,
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
}

export default function PortfolioPage() {
  const [profile, setProfile] = useState<FreelancerProfile | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);
  const [toastMessage, setToastMessage] = useState("");

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

  const fetchPortfolioData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio");
      const data = await res.json();
      if (data.ok) {
        setProfile(data.profile);
        setPortfolioItems(data.portfolio_items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
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

      {/* Vollna Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-600" />
            <span>مخزن سابقة الأعمال الذكي</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            سجل مشاريعك السابقة وروابطها ليقوم محرك الذكاء الاصطناعي بالاستشهاد بها كدليل عملي في كل عرض يقدمه للعميل.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ إضافة مشروع للسابقة</span>
        </button>
      </div>

      {/* Portfolio Items Grid */}
      {loading ? (
        <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">جاري قراءة سابقة أعمالك من Supabase...</p>
        </div>
      ) : portfolioItems.length === 0 ? (
        <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Briefcase className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">لا توجد مشاريع مضافة بعد</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            أضف أفضل 2 إلى 5 مشاريع قمت بتنفيذها لدمجها تلقائياً داخل عروضك الذكية.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            + إضافة مشروع جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {portfolioItems.map((item) => (
            <div
              key={item.id}
              className="vollna-card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-sm font-black text-slate-900 leading-snug">
                    {item.project_title}
                  </h3>
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
                  {item.category === "web_dev" ? "تطوير مواقع" : item.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Proposal Simulator Section */}
      <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl shadow-xs mt-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                محاكي توليد العروض الذكية
              </h3>
              <p className="text-[11px] text-slate-500">
                اختبر كيف يقوم محرك Gemini بدمج سابقة أعمالك المسجلة أعلاه لصياغة عرض فائق الإقناع.
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

      {/* Add / Edit Item Modal */}
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 text-left dir-ltr"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
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
