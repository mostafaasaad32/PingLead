"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Zap,
  Check,
  Crown,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type BillingPeriod = "monthly" | "3months" | "6months" | "yearly";

export default function SubscriptionSettingsPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState(25);
  // AI project evaluations (filter criteria), separate monthly quota
  const [evals, setEvals] = useState<{ remaining: number | null; monthly: number } | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");

  useEffect(() => {
    fetch("/api/projects/qualify")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setEvals({ remaining: data.remaining, monthly: data.monthly });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function loadSubscription() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await (supabase
            .from("freelancer_profiles") as any)
            .select("ai_credits")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile) {
            setCredits(profile.ai_credits ?? 25);
          }
        }
      } catch (err) {
        console.error("Error loading subscription info:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSubscription();
  }, [supabase]);

  // Pricing Matrix based on Vollna interval discounts
  const plans = {
    starter: {
      name: "باقة البداية (Starter)",
      tagline: "مثالية للمستقل المبتدئ الذي يريد مراقبة المشاريع أولاً بأول",
      prices: {
        monthly: 19,
        "3months": 16,
        "6months": 14,
        yearly: 12,
      },
      features: [
        "3 فلاتر مشاريع نشطة متزامنة",
        "50 رصيد لتوليد العروض بالذكاء الاصطناعي شهرياً",
        "تنبيهات فورية على تليجرام في أقل من ثانية",
        "رصد وتحديث مستمر لـ 9 منصات عمل حر عربية وعالمية",
        "تخصيص الكلمات المفتاحية والمستبعدة والحد الأدنى للميزانية",
        "دعم فني عبر البريد الإلكتروني وتليجرام",
      ],
    },
    pro: {
      name: "الباقة الاحترافية (Professional)",
      isPopular: true,
      tagline: "الخيار الأقوى للمستقل المحترف لزيادة أرباحه واقتناص أكبر عدد من المشاريع",
      prices: {
        monthly: 39,
        "3months": 33,
        "6months": 29,
        yearly: 24,
      },
      features: [
        "فلاتر مشاريع غير محدودة",
        "250 رصيد لتوليد عروض الذكاء الاصطناعي شهرياً",
        "تنبيهات تليجرام فائقة السرعة مع أزرار التقديم والتوليد الفوري",
        "ربط كامل بمخزن سابقة الأعمال لإثبات الخبرة في كل عرض",
        "أداة تتبع العروض وإدارة العملاء المتكاملة",
        "صياغة العروض الذكية بأربع نبرات صوتية احترافية",
        "أولوية قصوى ودعم فني متميز على مدار الساعة",
      ],
    },
  };

  return (
    <div className="space-y-6">
      {/* Current Balance Card */}
      <div className="vollna-card p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200/60">
              <Zap className="w-6 h-6 fill-emerald-600" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">رصيدك الحالي المتاح</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">
                  {loading ? "..." : credits}
                </span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/50">
                  رصيد عروض الذكاء الاصطناعي
                </span>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 sm:text-left">
            <span>كل رصيد = عرض واحد بالـ AI. بيتجدد أول كل شهر.</span>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-200/60 text-xl">
              🤖
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium">تقييم المشاريع بالـ AI الشهر ده</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-black text-slate-900">
                  {evals === null ? "..." : evals.remaining ?? "—"}
                </span>
                {evals && <span className="text-xs text-slate-500">من {evals.monthly}</span>}
              </div>
              {evals && typeof evals.remaining === "number" && (
                <div
                  className="mt-2 h-1.5 w-48 max-w-full rounded-full bg-slate-100 overflow-hidden"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={evals.monthly}
                  aria-valuenow={evals.remaining}
                  aria-label="التقييمات المتبقية"
                >
                  <div
                    className="h-full rounded-full bg-sky-500"
                    style={{ width: `${Math.round((evals.remaining / Math.max(1, evals.monthly)) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 sm:text-left max-w-xs">
            <span>
              بيتخصم تقييم لكل مشروع جديد بيعدّي فلتر فيه "شروطك للـ AI"، أو لما تدوس "فحص التوافق". بيتجدد أول كل شهر.
            </span>
          </div>
        </div>
      </div>

      {/* Vollna Billing Period Switcher with Discount Badges */}
      <div className="text-center pt-2">
        <h2 className="text-lg font-black text-slate-900 tracking-tight">
          اختر باقة الاشتراك المناسبة لنمو أعمالك
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">
          وفر حتى 33% باختيار فترات الاشتراك الأطول مع ضمان استرجاع الأموال لمدة 7 أيام.
        </p>

        {/* Switcher Bar */}
        <div className="inline-flex p-1.5 bg-slate-100 rounded-2xl border border-slate-200 max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setBillingPeriod("monthly")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              billingPeriod === "monthly"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            شهري
          </button>

          <button
            type="button"
            onClick={() => setBillingPeriod("3months")}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              billingPeriod === "3months"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>3 أشهر</span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              -16%
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBillingPeriod("6months")}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              billingPeriod === "6months"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>6 أشهر</span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              -25%
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBillingPeriod("yearly")}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
              billingPeriod === "yearly"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>سنوي</span>
            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white shadow-xs">
              وفر 33% 🔥
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid (Vollna Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Starter Plan */}
        <div className="vollna-card p-6 sm:p-8 bg-white border border-slate-200 rounded-3xl flex flex-col justify-between shadow-xs hover:border-slate-300 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-slate-900">
                {plans.starter.name}
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {plans.starter.tagline}
            </p>

            <div className="mb-6 flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-slate-900">
                ${plans.starter.prices[billingPeriod]}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                / شهرياً (تدفع دورياً)
              </span>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <span className="text-xs font-bold text-slate-900 block mb-3">
                المميزات المشمولة:
              </span>
              <ul className="space-y-3">
                {plans.starter.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-4">
            <button
              type="button"
              onClick={() =>
                alert("بوابة الدفع الإلكتروني (Stripe) سيتم تفعيلها في الإنتاج المباشر.")
              }
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-900 font-bold text-xs transition shadow-xs"
            >
              اختيار باقة البداية
            </button>
          </div>
        </div>

        {/* Professional Plan (Most Popular) */}
        <div className="vollna-card p-6 sm:p-8 bg-white border-2 border-emerald-500 rounded-3xl flex flex-col justify-between shadow-lg shadow-emerald-500/5 relative">
          {/* Most Popular Badge */}
          <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
            <Crown className="w-3 h-3" />
            <span>الأكثر طلباً واختياراً</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <span>{plans.pro.name}</span>
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {plans.pro.tagline}
            </p>

            <div className="mb-6 flex items-baseline gap-1.5">
              <span className="text-4xl font-black text-emerald-700">
                ${plans.pro.prices[billingPeriod]}
              </span>
              <span className="text-xs text-slate-400 font-semibold">
                / شهرياً (أفضل قيمة)
              </span>
            </div>

            <div className="border-t border-slate-100 pt-6">
              <span className="text-xs font-bold text-slate-900 block mb-3">
                كل مميزات باقة البداية بالإضافة إلى:
              </span>
              <ul className="space-y-3">
                {plans.pro.features.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-800">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed font-medium">{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-4">
            <button
              type="button"
              onClick={() =>
                alert("بوابة الدفع الإلكتروني (Stripe) سيتم تفعيلها في الإنتاج المباشر.")
              }
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>الترقية إلى الباقة الاحترافية فوراً</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trust & Guarantee Box */}
      <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-right">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              ضمان استرجاع الأموال لمدة 7 أيام دون أي أسئلة
            </h4>
            <p className="text-[11px] text-slate-500">
              يمكنك إلغاء الاشتراك في أي وقت من لوحة التحكم بنقرة واحدة.
            </p>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          دفع آمن ومشفر عبر Stripe & PayPal
        </div>
      </div>
    </div>
  );
}
