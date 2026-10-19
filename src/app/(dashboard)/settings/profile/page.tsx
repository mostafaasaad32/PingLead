"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Briefcase,
  FileText,
  Globe,
  Clock,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOrEnsureFreelancerProfile } from "@/lib/supabase/profile";

export default function MyProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form Fields
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("Egypt");
  const [timezone, setTimezone] = useState("Africa/Cairo");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [toneOfVoice, setToneOfVoice] = useState<
    "confident" | "friendly" | "analytical" | "direct"
  >("confident");
  const [skillsText, setSkillsText] = useState("");
  const [proposalInstructions, setProposalInstructions] = useState("");

  // Danger zone state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/login");
          return;
        }

        setUserId(user.id);
        setEmail(user.email || "");

        // Guarantee profile exists and fetch from Supabase
        const profile = await getOrEnsureFreelancerProfile(
          supabase,
          user.id,
          user.email,
          user.user_metadata?.full_name
        );

        if (profile) {
          setFullName(profile.full_name || "");
          setTitle(profile.title || "");
          setBio(profile.bio || "");
          setCountry(profile.country || "Egypt");
          setTimezone(profile.timezone || "Africa/Cairo");
          setTimeFormat(profile.time_format || "12h");
          setToneOfVoice(profile.tone_of_voice || "confident");
          setSkillsText(
            Array.isArray(profile.skills) ? profile.skills.join(", ") : ""
          );
          setProposalInstructions((profile as any).proposal_instructions || "");
        }
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setErrorMessage("تعذر تحميل بيانات الملف الشخصي.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [supabase, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setToastMessage(null);
    setErrorMessage(null);

    try {
      const skillsArray = skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const { error } = await (supabase
        .from("freelancer_profiles") as any)
        .update({
          full_name: fullName.trim(),
          title: title.trim(),
          bio: bio.trim(),
          country,
          timezone,
          time_format: timeFormat,
          tone_of_voice: toneOfVoice,
          skills: skillsArray,
          proposal_instructions: proposalInstructions.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;

      setToastMessage("تم حفظ بيانات الملف الشخصي بنجاح في قاعدة البيانات!");
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setErrorMessage(err.message || "حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Sign out and redirect to goodbye
      await supabase.auth.signOut();
      router.push("/login?message=account_deleted");
    } catch (err: any) {
      alert("حدث خطأ أثناء محاولة تسجيل الخروج وحذف الجلسة: " + err.message);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="vollna-card p-10 text-center bg-white border border-slate-200 rounded-2xl">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-xs text-slate-500">جاري قراءة بياناتك من Supabase...</p>
      </div>
    );
  }

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

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Profile Form Card */}
      <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              <span>الملف الشخصي للمستقل</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              تُستخدم هذه المعلومات لإضفاء طابعك الحقيقي على عروض الـ AI والخطابات المرسلة للعملاء.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Email (Read Only) & Full Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>البريد الإلكتروني</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (قراءة فقط - معتمد المصادقة)
                </span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-500 cursor-not-allowed text-left dir-ltr"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                الاسم الكامل (أو اسم البراند المستقل)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد عبد الله"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Job Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              المسمى الوظيفي والتخصص الدقيق
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="مثال: Senior Full-Stack Engineer (Next.js & Supabase)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition"
              />
              <Briefcase className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Bio / Value Proposition */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>النبذة التعريفية وعرض القيمة</span>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                يستخدمها محرك Gemini عند صياغة العروض
              </span>
            </label>
            <textarea
              rows={4}
              placeholder="اكتب نبذة عن خبرتك وسنوات عملك، وأبرز إنجازاتك والمشاكل التي تجيد حلها للعملاء في منصات العمل الحر..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition leading-relaxed"
            />
          </div>

          {/* Skills (Comma Separated) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              المهارات والتقنيات الرئيسية (مفصولة بفاصلة)
            </label>
            <input
              type="text"
              placeholder="React, Next.js, TypeScript, Supabase, TailwindCSS, Node.js, Python"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition"
            />
          </div>

          {/* Standing instructions for every AI proposal */}
          <div>
            <label htmlFor="proposal-instructions" className="block text-xs font-bold text-slate-700 mb-1.5">
              تعليمات ثابتة لكل عروضك
            </label>
            <textarea
              id="proposal-instructions"
              rows={3}
              maxLength={1000}
              placeholder="مثلاً: اذكر دايماً إن عندي ضمان شهر بعد التسليم، ومتقترحش مدة أقل من 3 أيام."
              value={proposalInstructions}
              onChange={(e) => setProposalInstructions(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition leading-relaxed"
            />
            <p className="text-[11px] text-slate-400 mt-1">الـ AI بيلتزم بيها في كل عرض بيكتبهولك، من الموقع أو من تليجرام.</p>
          </div>

          {/* Tone of Voice */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              نبرة الصوت في كتابة العروض
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: "confident", title: "واثق ومقنع", desc: "احترافي وحاسم" },
                { id: "friendly", title: "ودود ومتعاون", desc: "دافئ وشخصي" },
                { id: "analytical", title: "تحليلي وتقني", desc: "بيانات وأرقام" },
                { id: "direct", title: "مباشر ومختصر", desc: "مباشرة للحل" },
              ].map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => setToneOfVoice(tone.id as any)}
                  className={`p-3 rounded-xl border text-right transition ${
                    toneOfVoice === tone.id
                      ? "border-emerald-600 bg-emerald-50/80 text-emerald-950 font-bold shadow-xs"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                  }`}
                >
                  <div className="text-xs">{tone.title}</div>
                  <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                    {tone.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Regional Settings: Country, Timezone, Time Format */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span>الإعدادات الإقليمية والتوقيت</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {/* Country */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  الدولة
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="Egypt">مصر (Egypt)</option>
                  <option value="Saudi Arabia">المملكة العربية السعودية (KSA)</option>
                  <option value="UAE">الإمارات العربية المتحدة (UAE)</option>
                  <option value="Kuwait">الكويت (Kuwait)</option>
                  <option value="Qatar">قطر (Qatar)</option>
                  <option value="Jordan">الأردن (Jordan)</option>
                  <option value="Morocco">المغرب (Morocco)</option>
                  <option value="Other">دولة أخرى (Other)</option>
                </select>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  المنطقة الزمنية
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 dir-ltr text-right"
                >
                  <option value="Africa/Cairo">Africa/Cairo (UTC+2 / UTC+3)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (UTC+3)</option>
                  <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
                  <option value="Europe/London">Europe/London (UTC+0 / UTC+1)</option>
                  <option value="America/New_York">America/New_York (UTC-5)</option>
                  <option value="UTC">UTC (Universal Coordinated Time)</option>
                </select>
              </div>

              {/* Time Format */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  صيغة الوقت
                </label>
                <select
                  value={timeFormat}
                  onChange={(e) => setTimeFormat(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="12h">12 ساعة (02:30 م)</option>
                  <option value="24h">24 ساعة (14:30)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "جاري الحفظ في Supabase..." : "حفظ التغييرات"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="vollna-card p-6 bg-white border border-red-200 rounded-2xl shadow-xs">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-extrabold text-red-600 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600" />
              <span>منطقة الخطر</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xl leading-relaxed">
              حذف الحساب سيؤدي إلى إيقاف جميع التنبيهات الفورية ومسح الفلاتر المحفوظة وسابقة الأعمال وقوالب العروض وسجل الرادار نهائياً.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="py-2 px-4 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition shrink-0 flex items-center gap-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>حذف الحساب</span>
          </button>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl text-right">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900 mb-2">
                هل أنت متأكد من رغبتك في حذف الحساب؟
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                هذا الإجراء لا رجعة فيه وسيتم إلغاء وصولك لجميع الفلاتر والرصيد المتبقي على الفور.
              </p>

              <div className="flex items-center gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="py-2 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="py-2 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{deleting ? "جاري الحذف..." : "تأكيد الحذف نهائياً"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
