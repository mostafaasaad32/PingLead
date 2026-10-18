"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Filter,
  DollarSign,
  User,
  X,
  Save,
  Tag,
  Clock,
  Briefcase,
} from "lucide-react";

interface TemplateItem {
  id: string;
  name: string;
  sender_name?: string | null;
  hourly_rate?: number | null;
  pricing_type: string;
  filter_id?: string | null;
  template_body?: string | null;
  created_at?: string;
  user_filters?: {
    id: string;
    filter_name: string;
  } | null;
}

interface FilterOption {
  id: string;
  filter_name: string;
}

export default function ProposalTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [userFilters, setUserFilters] = useState<FilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [hourlyRate, setHourlyRate] = useState(35);
  const [pricingType, setPricingType] = useState("job_terms");
  const [filterId, setFilterId] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (data.ok) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Error loading templates:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const res = await fetch("/api/filters");
      const data = await res.json();
      if (data.ok && Array.isArray(data.filters)) {
        setUserFilters(data.filters);
      }
    } catch (err) {
      console.error("Error loading filters:", err);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchFilters();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleOpenCreateModal = () => {
    setEditingTemplate(null);
    setName("");
    setSenderName("");
    setHourlyRate(35);
    setPricingType("job_terms");
    setFilterId("");
    setTemplateBody(
      "مرحباً بك أخي الكريم {client_name}، قرأت تفاصيل مشروعك بعناية ولدي خبرة متخصصة في تنفيذ هذا النوع من المشاريع. أرفق لك سابقة أعمالي المشابهة وأتطلع للحديث معك حول الجدول الزمني والبدء الفوري."
    );
    setShowModal(true);
  };

  const handleOpenEditModal = (tpl: TemplateItem) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setSenderName(tpl.sender_name || "");
    setHourlyRate(tpl.hourly_rate || 30);
    setPricingType(tpl.pricing_type || "job_terms");
    setFilterId(tpl.filter_id || "");
    setTemplateBody(tpl.template_body || "");
    setShowModal(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف قالب "${name}" من قاعدة البيانات؟`)) return;

    setTemplates((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/templates?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`تم حذف القالب "${name}" بنجاح`);
      }
    } catch (e) {
      fetchTemplates();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    const payload = {
      id: editingTemplate?.id,
      name: name.trim(),
      sender_name: senderName.trim() || null,
      hourly_rate: Number(hourlyRate) || 30,
      pricing_type: pricingType,
      filter_id: filterId || null,
      template_body: templateBody.trim() || null,
    };

    try {
      const method = editingTemplate ? "PUT" : "POST";
      const res = await fetch("/api/templates", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.ok) {
        setShowModal(false);
        showToast(
          editingTemplate
            ? "تم تحديث القالب في Supabase بنجاح!"
            : "تم إنشاء القالب الجديد وحفظه في قاعدة البيانات!"
        );
        fetchTemplates();
      } else {
        alert(data.error || "فشل حفظ القالب");
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء حفظ القالب: " + err.message);
    } finally {
      setSaving(false);
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
            <FileText className="w-5 h-5 text-emerald-600" />
            <span>قوالب العروض</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            صمم قوالب جاهزة بأسعارك وشروطك واسمك لربطها بفلاترك وتوليد العروض بأعلى سرعة على غرار Vollna.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>+ إنشاء قالب جديد</span>
        </button>
      </div>

      {/* Templates Grid (Vollna Card Style) */}
      {loading ? (
        <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">جاري تحميل القوالب من Supabase...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="vollna-card p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 mb-1">لا توجد قوالب عروض مخصصة</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            أنشئ أول قالب لتسريع التقديم على مشاريع منصات العمل الحر وتخصيص أسعارك تلقائياً.
          </p>
          <button
            onClick={handleOpenCreateModal}
            className="py-2 px-4 rounded-xl bg-emerald-600 text-white text-xs font-bold"
          >
            + إنشاء قالب جديد
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="vollna-card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
            >
              <div>
                {/* Header: Title & Badges */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-sm font-black text-slate-900 leading-snug">
                    {tpl.name}
                  </h3>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(tpl)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      title="تعديل القالب"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(tpl.id, tpl.name)}
                      className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="حذف القالب"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Sender Name */}
                {tpl.sender_name && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>المرسل: {tpl.sender_name}</span>
                  </div>
                )}

                {/* Badges: Hourly Rate & Pricing Type */}
                <div className="flex items-center gap-2 mb-3.5 flex-wrap">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono">
                    {tpl.hourly_rate || 30}$ / ساعة
                  </span>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600">
                    {tpl.pricing_type === "custom"
                      ? "تسعير خاص"
                      : "سعر ثابت (حسب المشروع)"}
                  </span>
                </div>

                {/* Template Snippet */}
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  {tpl.template_body || "لا يوجد نص إضافي بالقالب."}
                </p>
              </div>

              {/* Footer: Filter link */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                  <Filter className="w-3 h-3 text-emerald-600" />
                  <span>
                    {tpl.user_filters?.filter_name || "كافة الفلاتر"}
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {tpl.created_at ? new Date(tpl.created_at).toLocaleDateString("ar-EG") : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New / Edit Template */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-slate-200 shadow-2xl text-right max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>{editingTemplate ? "تعديل قالب العرض" : "إنشاء قالب عرض جديد"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم القالب
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: عرض مشاريع تطوير الويب والتطبيقات"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    اسم المرسل
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: أحمد عبد الله"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سعر الساعة المقترح ($)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 font-mono text-left dir-ltr"
                    />
                    <DollarSign className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    طريقة التسعير في المشاريع الثابتة
                  </label>
                  <select
                    value={pricingType}
                    onChange={(e) => setPricingType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="job_terms">سعر ثابت (حسب شروط المشروع)</option>
                    <option value="custom">تسعير خاص مسبق</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ربط بفلتر مشاريع محدد (اختياري)
                  </label>
                  <select
                    value={filterId}
                    onChange={(e) => setFilterId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="">كافة الفلاتر</option>
                    {userFilters.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.filter_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>نص العرض الأساسي</span>
                  <span className="text-[10px] text-slate-400">
                    يمكنك استخدام الرموز: {"{client_name}"} و {"{project_title}"}
                  </span>
                </label>
                <textarea
                  rows={5}
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  placeholder="مرحباً {client_name}، قرأت تفاصيل {project_title}..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="py-2 px-4 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? "جاري الحفظ في Supabase..." : "حفظ القالب"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
