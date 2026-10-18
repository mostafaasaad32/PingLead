"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Radar,
  Mail,
  Lock,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/dashboard";
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic_link">("password");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sentMagicLink, setSentMagicLink] = useState(false);
  const [directMagicLink, setDirectMagicLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    urlError === "auth_callback_failed"
      ? "تعذر التحقق من تسجيل الدخول بواسطة المزود الخارجي. يرجى المحاولة مجدداً."
      : null
  );

  const supabase = createClient();

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      console.log(`[PingLead Client Log] Attempting password login for: ${email}`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error("[PingLead Client Log] Password login error:", error);
        if (
          error.message.includes("Invalid login credentials") ||
          error.message.includes("invalid_grant")
        ) {
          throw new Error(
            "البريد الإلكتروني أو كلمة المرور غير صحيحة. إذا كنت مستخدماً جديداً، يمكنك إنشاء حساب جديد بالأسفل."
          );
        } else if (error.message.includes("Email not confirmed")) {
          throw new Error(
            "يرجى تأكيد بريدك الإلكتروني أولاً عبر الرابط المرسل إلى صندوق الوارد الخاص بك (تفقد مجلد Spam)."
          );
        }
        throw error;
      }

      if (data?.user) {
        console.log(`[PingLead Client Log] Login successful for: ${data.user.email}`);
        router.push(returnUrl);
        router.refresh();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      console.log(`[PingLead Client Log] Requesting magic link via server for: ${email}`);
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), returnUrl }),
      });

      const data = await res.json();
      console.log("[PingLead Client Log] Server magic link response:", data);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "تعذر إرسال الرابط السحري");
      }

      if (data.directLink) {
        setDirectMagicLink(data.directLink);
        console.log("🔗 [DIRECT LINK IN BROWSER CONSOLE]:", data.directLink);
      }
      setSentMagicLink(true);
    } catch (err: any) {
      console.error("[PingLead Client Log] Magic link error:", err);
      setErrorMsg(err.message || "حدث خطأ أثناء إرسال الرابط السحري");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDirectLink = () => {
    if (!directMagicLink) return;
    navigator.clipboard.writeText(directMagicLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      console.log("[PingLead Client Log] Triggering Google OAuth...");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            returnUrl
          )}`,
        },
      });

      if (error) {
        console.error("[PingLead Client Log] Google OAuth error:", error);
        if (error.message.includes("not enabled")) {
          setErrorMsg(
            "تسجيل دخول Google غير مفعّل في إعدادات Supabase الحالية. يمكنك استخدام البريد وكلمة المرور فوراً."
          );
        } else {
          setErrorMsg(error.message);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء محاولة تسجيل الدخول عبر Google");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
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
          تسجيل الدخول إلى حسابك
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          رادار ذكي لرصد مشاريع العمل الحر وتوليد العروض فائق السرعة
        </p>
      </div>

      {/* Main Vollna Card */}
      <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 shadow-xl shadow-slate-900/5 rounded-3xl">
        {sentMagicLink ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                تم توليد وإرسال رابط الدخول!
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                أرسلنا رسالة بالرابط إلى{" "}
                <span className="font-semibold text-slate-900 font-mono">
                  {email}
                </span>
                .
              </p>
            </div>

            {/* Spam Notice Box */}
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs text-right leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>تنبيه هام حول صندوق الوارد:</span>
              </div>
              <p className="text-[11px] text-amber-700">
                يتم إرسال الرسالة عبر خدمة Resend. إذا لم تجدها في الوارد الرئيسي، يرجى فحص مجلد <strong>الرسائل غير المرغوب فيها (Spam / Junk)</strong> أو الترويجية.
              </p>
            </div>

            {/* Direct Action Link Box (Logged in Server Terminal & Available Here) */}
            {directMagicLink && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-right space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>رابط الدخول المباشر (سجل الخادم Log):</span>
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                    جاهز فوراً
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  تم تسجيل وطباعة الرابط المباشر في الـ Server Terminal. يمكنك الدخول فوراً بالضغط على الزر أدناه دون انتظار الإيميل:
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <a
                    href={directMagicLink}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20"
                  >
                    <span>الدخول الفوري إلى لوحة التحكم الآن</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyDirectLink}
                    className="w-full py-1.5 px-3 rounded-lg border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold transition"
                  >
                    {copiedLink ? "✓ تم نسخ الرابط المباشر!" : "نسخ الرابط المباشر"}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setSentMagicLink(false);
                  setDirectMagicLink(null);
                }}
                className="text-xs text-slate-500 font-bold hover:text-slate-800 underline transition"
              >
                المحاولة ببريد آخر أو بكلمة المرور
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-3 transition shadow-xs disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>المتابعة عبر حساب Google</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-[11px] text-slate-400 font-medium">
                أو بالبريد الإلكتروني
              </span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80 mb-4">
              <button
                type="button"
                onClick={() => setMode("password")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  mode === "password"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                كلمة المرور
              </button>
              <button
                type="button"
                onClick={() => setMode("magic_link")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                  mode === "magic_link"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                رابط تسجيل سحري
              </button>
            </div>

            {/* Error Message Box */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {mode === "password" ? (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
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

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white text-left dir-ltr transition"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-slate-600 transition"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Primary Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <span>جاري تسجيل الدخول...</span>
                  ) : (
                    <>
                      <span>تسجيل الدخول</span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-4">
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
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <span>جاري إرسال الرابط...</span>
                  ) : (
                    <span>إرسال رابط تسجيل الدخول المباشر</span>
                  )}
                </button>
              </form>
            )}

            {/* Switch to Sign Up */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                ليس لديك حساب بعد؟{" "}
                <Link
                  href={`/signup${
                    returnUrl !== "/dashboard"
                      ? `?returnUrl=${encodeURIComponent(returnUrl)}`
                      : ""
                  }`}
                  className="text-emerald-700 font-extrabold hover:underline"
                >
                  أنشئ حسابك مجاناً واحصل على 25 نقطة
                </Link>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Trust Badge */}
      <div className="mt-6 text-center flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>بياناتك محمية ومشفرة وفق أعلى معايير الخصوصية</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#F8FAFC] relative">
      {/* Background Decorative Ambient Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-200/50 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="text-center text-xs text-slate-500">
            جاري تحميل نموذج الدخول...
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
