import Link from "next/link";
import { Radar, Bot, Sparkles, ShieldAlert, Gauge, BellRing, ArrowLeft, Coins, Target, Send } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CATEGORIES_METADATA, PLATFORMS_METADATA } from "@/lib/scrapers/types";

// Public landing page. Every number on it comes from the projects table (refreshed every
// 10 minutes); nothing is invented.
export const revalidate = 600;

const FREELANCE_PLATFORMS = ["mostaql", "nafezly", "khamsat", "kafiil", "freelancer", "pph"];

async function liveStats() {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    // Counted in the database: fetching rows would stop at Supabase's 1,000-row cap
    const countWhere = async (column: "category" | "platform" | null, value?: string) => {
      let q = (supabaseAdmin.from("projects") as any).select("id", { count: "exact", head: true }).gte("created_at", since);
      if (column) q = q.eq(column, value);
      const { count } = await q;
      return count || 0;
    };
    const [total, categoryCounts, platformCounts] = await Promise.all([
      countWhere(null),
      Promise.all(CATEGORIES_METADATA.filter((c) => c.id !== "other").map(async (c) => ({ ...c, count: await countWhere("category", c.id) }))),
      Promise.all(PLATFORMS_METADATA.map((p) => countWhere("platform", p.id))),
    ]);
    const categories = categoryCounts
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    return { total, platforms: platformCounts.filter((n) => n > 0).length, categories };
  } catch {
    return { total: 0, platforms: 0, categories: [] as ((typeof CATEGORIES_METADATA)[number] & { count: number })[] };
  }
}

const STEPS = [
  {
    icon: Target,
    title: "اختار تخصصك وشروطك",
    text: "المنصات، والتخصص، وأقل ميزانية، وتقدر كمان تكتب بكلامك: «عايز مشاريع React بس، ومن غير واجبات جامعة».",
  },
  {
    icon: BellRing,
    title: "يوصلك المشروع أول ما يتنشر",
    text: "على تليجرام أو كإشعار على الموبايل، خلال دقيقة تقريباً من نشره، ومعاه عدد العروض، وتقييم العميل، والميزانية بالجنيه.",
  },
  {
    icon: Send,
    title: "اكتب العرض بدوسة وقدّم بنفسك",
    text: "الـ AI بيكتب عرض بملفك وأعمالك وسعر ومدة مقترحين. انت بتراجعه وتقدّم من حسابك. إحنا عمرنا ما بنقدّم باسمك.",
  },
];

const FEATURES = [
  { icon: Gauge, title: "توافق بالـ AI", text: "كل مشروع بياخد نسبة توافق مع شروطك وسبب، ومش بيوصلك غير المناسب." },
  { icon: ShieldAlert, title: "كاشف النصب", text: "تحذير على المشاريع اللي بتطلب رسوم، أو بيانات بطاقة، أو تواصل برا المنصة." },
  { icon: Coins, title: "سعر مقترح بالجنيه", text: "سعر ومدة مقترحين حسب الميزانية والمنافسة، والميزانية محوّلة بسعر اليوم." },
  { icon: Bot, title: "ملخص كل صباح", text: "رسالة الساعة 9: وصلك كام مشروع، وأحسن اللي لسه ملحقتش تقدّم عليه." },
];

export default async function Home() {
  const stats = await liveStats();
  const platformNames = PLATFORMS_METADATA.filter((p) => FREELANCE_PLATFORMS.includes(p.id)).map((p) => p.label_ar);

  return (
    <main dir="rtl" className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#090d16] via-[#0d1527] to-[#090d16] px-4 py-6 sm:px-8 lg:px-12">
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between gap-3 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center text-black shadow-lg shadow-green-500/20">
              <Radar className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                PingLead
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-bold">
                  تجربة مجانية
                </span>
              </span>
              <p className="text-xs text-gray-400">مشاريع العمل الحر المناسبة ليك، أول ما تتنشر</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/login" className="text-xs font-semibold text-gray-300 hover:text-white px-3 py-2 rounded-lg transition">
              دخول
            </Link>
            <Link
              href="/signup"
              className="text-xs font-bold bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-lg transition shadow-md shadow-green-500/20 flex items-center gap-1.5"
            >
              <span>ابدأ مجاناً</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="text-center py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>للفريلانسرز على {platformNames.join(" و")}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight max-w-3xl mx-auto">
            المشروع اللي يناسبك يوصلك{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">أول ما يتنشر</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            أول عروض بتتقدّم على المشروع هي اللي بتتقري. PingLead بيتابع منصات العمل الحر كل دقيقة، ويبعتلك المشاريع اللي
            تناسب شغلك بس، ومعاها عرض جاهز تراجعه وتقدّم بيه.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="text-sm font-bold bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-xl transition shadow-lg shadow-green-500/20 flex items-center gap-2"
            >
              <span>ابدأ مجاناً</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <a
              href="https://t.me/Ping_Lead22_bot"
              target="_blank"
              rel="noreferrer"
              className="text-sm font-semibold text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 px-5 py-3 rounded-xl transition flex items-center gap-2"
            >
              <Bot className="w-4 h-4 text-sky-400" />
              <span>شوف البوت على تليجرام</span>
            </a>
          </div>

          {stats.total > 0 && (
            <p className="mt-8 text-sm text-gray-400">
              آخر 24 ساعة: <b className="text-white tabular-nums">{stats.total.toLocaleString("ar-EG")}</b> مشروع جديد من{" "}
              <b className="text-white tabular-nums">{stats.platforms.toLocaleString("ar-EG")}</b> منصات
            </p>
          )}
        </section>

        {/* How it works */}
        <section className="py-8">
          <h2 className="text-lg font-bold text-white mb-6">بيشتغل إزاي</h2>
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center text-sm font-black">
                    {(i + 1).toLocaleString("ar-EG")}
                  </span>
                  <s.icon className="w-5 h-5 text-green-400" />
                </div>
                <h3 className="font-bold text-white text-sm">{s.title}</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Features */}
        <section className="py-8">
          <h2 className="text-lg font-bold text-white mb-6">مع كل مشروع</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <f.icon className="w-5 h-5 text-green-400 mb-3" />
                <h3 className="font-bold text-white text-sm">{f.title}</h3>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live categories (real counts) */}
        {stats.categories.length > 0 && (
          <section className="py-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-6">
              <h2 className="text-lg font-bold text-white">اتنشر إيه آخر 24 ساعة</h2>
              <span className="text-xs text-gray-500">أرقام حقيقية من الرادار، بتتحدّث كل 10 دقايق</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.categories.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xl mb-1.5">{c.icon}</div>
                  <h3 className="font-semibold text-white text-xs leading-relaxed">{c.label_ar}</h3>
                  <div className="mt-3 pt-2 border-t border-white/5 text-xs text-green-400 font-bold tabular-nums">
                    {c.count.toLocaleString("ar-EG")} مشروع
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Closing CTA */}
        <section className="py-12 text-center">
          <h2 className="text-2xl font-black text-white">جرّبه ببلاش أثناء الـ Beta</h2>
          <p className="text-sm text-gray-400 mt-2">من غير بطاقة دفع. 25 عرض بالـ AI كل شهر.</p>
          <Link
            href="/signup"
            className="mt-6 inline-flex text-sm font-bold bg-green-500 hover:bg-green-400 text-black px-6 py-3 rounded-xl transition shadow-lg shadow-green-500/20 items-center gap-2"
          >
            <span>اعمل حسابك</span>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </section>

        {/* Footer */}
        <footer className="mt-8 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <div>© 2026 PingLead</div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-gray-300 transition">
              سياسة الخصوصية
            </Link>
            <Link href="/terms" className="hover:text-gray-300 transition">
              شروط الاستخدام
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
