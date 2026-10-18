import Link from "next/link";
import { Radar, Bot, Sparkles, ShieldCheck, Zap, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function Home() {
  const categories = [
    { slug: "web_dev", name: "تطوير البرمجيات والمواقع", count: "12 فرصة اليوم", icon: "💻" },
    { slug: "ui_ux", name: "تصميم الواجهات وتجربة المستخدم", count: "8 فرص اليوم", icon: "🎨" },
    { slug: "marketing", name: "التسويق الرقمي وإدارة الحملات", count: "15 فرصة اليوم", icon: "📈" },
    { slug: "accounting", name: "المحاسبة والخدمات المالية", count: "5 فرص اليوم", icon: "📑" },
  ];

  return (
    <main className="min-h-screen relative overflow-hidden bg-gradient-to-b from-[#090d16] via-[#0d1527] to-[#090d16] p-6 lg:p-12">
      {/* Background glow effects */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-green-500 to-emerald-400 flex items-center justify-center text-black font-bold shadow-lg shadow-green-500/20">
              <Radar className="w-6 h-6 animate-spin-slow" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                PingLead <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 font-mono">الإصدار 1.0</span>
              </span>
              <p className="text-xs text-gray-400">رادار اصطياد العملاء بالذكاء الاصطناعي</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://t.me/Ping_Lead22_bot"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 text-xs bg-white/5 hover:bg-white/10 border border-white/10 px-3.5 py-2 rounded-lg transition"
            >
              <Bot className="w-4 h-4 text-sky-400" />
              <span>بوت تليجرام @Ping_Lead22_bot</span>
            </a>
            <Link
              href="/login"
              className="text-xs font-semibold bg-green-500 hover:bg-green-400 text-black px-4 py-2 rounded-lg transition shadow-md shadow-green-500/20 flex items-center gap-1.5"
            >
              <span>لوحة التحكم</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <section className="text-center py-16 sm:py-24">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>نظام رصد نية الشراء اللحظية واقتناص الصفقات</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight max-w-4xl mx-auto">
            احصل على عملاء حقيقيين يبحثون عن خدماتك <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300">في ثوانٍ على هاتفك</span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            محرك ذكي يرصد منصات العمل الحر، يستبعد العروض غير المناسبة عبر فلتر فوري، ويحلل متطلبات العملاء عبر الذكاء الاصطناعي ويرسل تنبيهاً فورياً مع زر لتوليد عرض مخصص ومقنع فوراً.
          </p>

          {/* Core Feature Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto mt-12 text-right">
            <div className="glass-panel p-5 rounded-2xl">
              <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 mb-3">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-sm">فلترة ذكية مسبقة ومجانية</h3>
              <p className="text-xs text-gray-400 mt-1">استبعاد تلقائي لعروض السبام والمشاريع غير المطابقة دون استهلاك أي رصيد.</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400 mb-3">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-sm">تحليل وتصنيف متقدم بالذكاء الاصطناعي</h3>
              <p className="text-xs text-gray-400 mt-1">معالجة فائقة السرعة للمشاريع واستخراج المهارات المطلوبة وتحديد درجة الجدية.</p>
            </div>

            <div className="glass-panel p-5 rounded-2xl">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-3">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-white text-sm">تنبيهات فورية وتوليد عروض عند الطلب</h3>
              <p className="text-xs text-gray-400 mt-1">إشعار تليجرام فوري وزر صياغة مقترح مخصص ومقنع فور ضغط الزر من هاتفك أو المتصفح.</p>
            </div>
          </div>
        </section>

        {/* Active Categories Section */}
        <section className="py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span>المجالات والتخصصات المدعومة في الرادار</span>
            </h2>
            <span className="text-xs text-gray-400">تحديث لحظي ومستمر للمشاريع</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((c) => (
              <div key={c.slug} className="glass-panel p-5 rounded-2xl hover:border-green-500/30 transition group">
                <div className="text-2xl mb-2">{c.icon}</div>
                <h4 className="font-semibold text-white text-sm group-hover:text-green-400 transition">{c.name}</h4>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs text-gray-400">
                  <span className="font-mono text-[11px] text-gray-500">{c.slug}</span>
                  <span className="text-green-400/80 font-medium">{c.count}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <div>© 2026 بينج ليد (PingLead). جميع الحقوق محفوظة.</div>
          <div className="flex items-center gap-6">
            <span>منصة سحابية متقدمة</span>
            <span>بيانات فورية وآمنة</span>
            <span>ذكاء اصطناعي فائق الدقة</span>
          </div>
        </footer>
      </div>
    </main>
  );
}
