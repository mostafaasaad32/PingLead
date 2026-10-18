"use client";

import { useState } from "react";
import Link from "next/link";
import { Radar, Mail, ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        if (error.message.includes("rate limit") || error.message.includes("security purposes")) {
          throw new Error("يرجى الانتظار دقيقة واحدة قبل طلب إعادة تعيين كلمة المرور مجدداً.");
        }
        throw error;
      }

      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء إرسال رابط استعادة كلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#F8FAFC] relative">
      {/* Background Decorative Ambient Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-200/50 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 group transition justify-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-emerald-400 shadow-lg shadow-slate-900/10 group-hover:scale-105 transition duration-200">
              <Radar className="w-6 h-6 text-emerald-400" />
            </div>
            <span className="text-2xl font-black tracking-tight text-slate-900">
              PingLead
            </span>
          </Link>
          <h1 className="text-xl font-bold text-slate-900 mt-4">
            استعادة كلمة المرور
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً آمناً لتعيين كلمة مرور جديدة
          </p>
        </div>

        {/* Main Card */}
        <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 shadow-xl shadow-slate-900/5 rounded-3xl">
          {submitted ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">
                  تم إرسال رابط الاستعادة!
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                  أرسلنا رابط إعادة تعيين كلمة المرور إلى{" "}
                  <span className="font-semibold text-slate-900 font-mono">
                    {email}
                  </span>
                  .
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-right leading-relaxed">
                <p className="text-[11px] text-amber-800">
                  💡 <strong>ملاحظة:</strong> إذا لم تجد الرسالة في صندوق الوارد خلال دقيقة، يرجى فحص مجلد <strong>الرسائل غير المرغوب فيها (Spam / Junk)</strong>.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                >
                  <span>العودة إلى تسجيل الدخول</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetRequest} className="space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  البريد الإلكتروني
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white text-left dir-ltr transition"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span>جاري إرسال الرابط...</span>
                ) : (
                  <>
                    <span>إرسال رابط استعادة كلمة المرور</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <div className="pt-4 border-t border-slate-100 text-center">
                <Link
                  href="/login"
                  className="text-xs text-slate-600 hover:text-emerald-700 font-semibold transition"
                >
                  تذكرت كلمة المرور؟ تسجيل الدخول
                </Link>
              </div>
            </form>
          )}
        </div>

        {/* Trust Badge */}
        <div className="mt-6 text-center flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>حماية مشفرة ومصادقة آمنة عبر Supabase Auth</span>
        </div>
      </div>
    </div>
  );
}
