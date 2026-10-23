"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Radar,
  Mail,
  Lock,
  User,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOrEnsureFreelancerProfile } from "@/lib/supabase/profile";

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/dashboard";
  const paramEmail = searchParams.get("email") || "";
  const paramStep = searchParams.get("step") === "verify" ? "verify_otp" : "register";

  // Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(paramEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isEmailDuplicate, setIsEmailDuplicate] = useState(false);

  // OTP Verification states
  const [step, setStep] = useState<"register" | "verify_otp">(paramStep);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    if (password.length < 6) {
      setErrorMsg("يجب أن تكون كلمة المرور مكونة من 6 أحرف على الأقل.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setIsEmailDuplicate(false);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            returnUrl
          )}`,
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("user already registered") ||
          msg.includes("already registered") ||
          msg.includes("already in use") ||
          msg.includes("already exists") ||
          error.status === 422
        ) {
          setIsEmailDuplicate(true);
          throw new Error(
            "هذا البريد الإلكتروني مسجل بالفعل لدى مستخدم آخر. يرجى تسجيل الدخول بحسابك أو استخدام بريد إلكتروني مختلف."
          );
        }
        throw error;
      }

      if (data?.user) {
        // If email enumeration protection is ON, Supabase returns identities: [] for duplicate emails
        if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setIsEmailDuplicate(true);
          throw new Error(
            "هذا البريد الإلكتروني مسجل بالفعل لدى مستخدم آخر. يرجى تسجيل الدخول بحسابك أو استخدام بريد إلكتروني مختلف."
          );
        }

        // If session exists immediately (email confirmation disabled in Supabase)
        if (data.session) {
          await getOrEnsureFreelancerProfile(
            supabase,
            data.user.id,
            data.user.email,
            fullName
          );
          router.push(returnUrl);
          router.refresh();
        } else {
          // Email confirmation is required by Supabase -> Transition to OTP code entry
          setStep("verify_otp");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanToken = otpCode.trim();
    if (!cleanToken) return;

    setVerifying(true);
    setOtpError(null);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: cleanToken,
        type: "signup",
      });

      if (error) {
        if (error.message.includes("Token has expired") || error.message.includes("invalid")) {
          throw new Error("رمز التحقق غير صحيح أو انتهت صلاحيته. يرجى التأكد وإعادة المحاولة.");
        }
        throw error;
      }

      if (data?.user) {
        // Ensure freelancer profile with 25 credits
        await getOrEnsureFreelancerProfile(
          supabase,
          data.user.id,
          data.user.email,
          fullName
        );

        router.push(returnUrl);
        router.refresh();
      }
    } catch (err: any) {
      setOtpError(err.message || "فشل التحقق من الرمز.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setOtpError(null);
    setResendSuccess(false);

    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim(),
      });

      if (error) {
        if (error.message.includes("security purposes") || error.message.includes("rate limit")) {
          throw new Error("يرجى الانتظار 60 ثانية قبل طلب رمز جديد (حماية أمنية).");
        }
        throw error;
      }

      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      setOtpError(err.message || "تعذر إعادة إرسال الرمز حالياً.");
    } finally {
      setResending(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            returnUrl
          )}`,
        },
      });

      if (error) {
        if (error.message.includes("not enabled")) {
          setErrorMsg(
            "تسجيل دخول Google غير مفعّل في لوحة التحكم حالياً. يرجى استخدام النموذج بالأسفل."
          );
        } else {
          setErrorMsg(error.message);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء الاتصال بمزود Google");
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
          {step === "verify_otp" ? "تأكيد بريدك الإلكتروني" : "إنشاء حساب جديد في الرادار"}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {step === "verify_otp"
            ? `أدخل رمز التحقق المكون من 6 أرقام المرسل إلى ${email}`
            : "احصل على رصيد 25 نقطة AI مجانية وفلترة ذكية لـ 9 منصات"}
        </p>
      </div>

      {/* Main Vollna Card */}
      <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 shadow-xl shadow-slate-900/5 rounded-3xl">
        {step === "verify_otp" ? (
          /* Step 2: OTP Code Verification Screen */
          <div className="space-y-5">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
              <KeyRound className="w-7 h-7" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                أدخل رمز التحقق (OTP)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                أرسلنا رمز تحقق إلى <span className="font-semibold text-slate-800 dir-ltr">{email}</span>
              </p>
            </div>

            {otpError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{otpError}</span>
              </div>
            )}

            {resendSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>تم إرسال رمز تحقق جديد إلى بريدك بنجاح!</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 text-center">
                  رمز التحقق المكون من 6 أرقام
                </label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  autoFocus
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\s+/g, ""))}
                  className="w-full text-center text-2xl font-mono tracking-[10px] font-bold py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition"
                />
              </div>

              {/* Spam Notice Box */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs leading-relaxed text-right">
                <p className="text-[11px]">
                  💡 <strong>ملاحظة:</strong> إذا لم تجد الرسالة في الوارد الرئيسي، يرجى فحص مجلد <strong>الرسائل غير المرغوب فيها (Spam / Junk)</strong>.
                </p>
              </div>

              <button
                type="submit"
                disabled={verifying || otpCode.trim().length < 6}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {verifying ? (
                  <span>جاري التحقق من الرمز...</span>
                ) : (
                  <>
                    <span>تأكيد الرمز وتفعيل الحساب</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending}
                className="text-emerald-700 hover:underline font-bold flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
                <span>{resending ? "جاري الإرسال..." : "إعادة إرسال الرمز"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("register");
                  setOtpCode("");
                  setOtpError(null);
                }}
                className="text-slate-500 hover:text-slate-800 transition"
              >
                تعديل البيانات
              </button>
            </div>
          </div>
        ) : (
          /* Step 1: Registration Form */
          <>
            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignUp}
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
              <span>التسجيل بنقرة واحدة عبر Google</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 border-t border-slate-200" />
              <span className="text-[11px] text-slate-400 font-medium">
                أو بالبيانات الشخصية
              </span>
              <div className="flex-1 border-t border-slate-200" />
            </div>

            {/* Error Message Box */}
            {errorMsg && (
              <div
                className={`mb-4 p-3.5 rounded-2xl text-xs flex flex-col gap-2.5 animate-in fade-in duration-200 ${
                  isEmailDuplicate
                    ? "bg-amber-50 border border-amber-200 text-amber-900"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      isEmailDuplicate ? "text-amber-600" : "text-red-600"
                    }`}
                  />
                  <span className="leading-relaxed font-semibold">{errorMsg}</span>
                </div>

                {isEmailDuplicate && (
                  <div className="flex items-center gap-2 pt-2 border-t border-amber-200/80">
                    <Link
                      href={`/login?email=${encodeURIComponent(email)}`}
                      className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] transition shadow-xs"
                    >
                      <span>الانتقال لتسجيل الدخول مباشرة</span>
                      <ArrowLeft className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/forgot-password"
                      className="text-[11px] text-amber-900 hover:underline font-bold mr-auto"
                    >
                      استعادة كلمة المرور
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الاسم الكامل (أو اسم العمل المستقل)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد عبد الله"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white transition"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

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
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (isEmailDuplicate) {
                        setIsEmailDuplicate(false);
                        setErrorMsg(null);
                      }
                    }}
                    className={`w-full pl-3 pr-10 py-2.5 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 focus:bg-white text-left dir-ltr transition ${
                      isEmailDuplicate ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200"
                    }`}
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
                <p className="text-[11px] text-slate-400 mt-1">
                  6 أحرف على الأقل
                </p>
              </div>

              {/* Bonus Perk Info */}
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center gap-2.5 text-xs text-emerald-800">
                <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  ستحصل تلقائياً على <strong>25 نقطة AI</strong> صالحة فوراً لتوليد العروض الذكية.
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span>جاري إنشاء الحساب...</span>
                ) : (
                  <>
                    <span>إنشاء الحساب واستلام رمز التحقق</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                بإنشاء الحساب أنت توافق على{" "}
                <a href="/terms" target="_blank" className="font-bold text-emerald-700 hover:underline">
                  شروط الاستخدام
                </a>{" "}
                و
                <a href="/privacy" target="_blank" className="font-bold text-emerald-700 hover:underline">
                  سياسة الخصوصية
                </a>
                .
              </p>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    if (!email) {
                      setErrorMsg("يرجى كتابة البريد الإلكتروني أولاً ثم النقر هنا لإدخال الرمز.");
                      return;
                    }
                    setStep("verify_otp");
                    setErrorMsg(null);
                  }}
                  className="text-xs text-emerald-700 hover:underline font-semibold"
                >
                  وصلك رمز التحقق بالفعل على بريدك؟ اضغط هنا لإدخاله فوراً
                </button>
              </div>
            </form>

            {/* Switch to Login */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-600">
                لديك حساب بالفعل؟{" "}
                <Link
                  href={`/login${
                    returnUrl !== "/dashboard"
                      ? `?returnUrl=${encodeURIComponent(returnUrl)}`
                      : ""
                  }`}
                  className="text-emerald-700 font-extrabold hover:underline"
                >
                  تسجيل الدخول
                </Link>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Trust Badge */}
      <div className="mt-6 text-center flex items-center justify-center gap-2 text-xs text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>إنشاء الحساب مجاني ومحمي بأحدث معايير الأمان</span>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#F8FAFC] relative">
      {/* Background Decorative Ambient Circles */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-slate-200/50 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="text-center text-xs text-slate-500">
            جاري تحميل نموذج إنشاء الحساب...
          </div>
        }
      >
        <SignUpForm />
      </Suspense>
    </div>
  );
}
