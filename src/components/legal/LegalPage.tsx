import Link from "next/link";
import type { ReactNode } from "react";

// Shared shell for /privacy and /terms: public pages (no login), plain readable layout.

export const LEGAL_UPDATED_AT = "23 أكتوبر 2026";

/** Where users send privacy requests. Set NEXT_PUBLIC_CONTACT_EMAIL in production. */
export function contactLine(): ReactNode {
  const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;
  return email ? (
    <>
      على البريد{" "}
      <bdi dir="ltr" className="font-semibold text-slate-800">
        {email}
      </bdi>
    </>
  ) : (
    <>من خلال صفحة الإعدادات داخل حسابك أو عبر بوت تليجرام @Ping_Lead22_bot</>
  );
}

export function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-6">
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="space-y-3 text-[15px] leading-8 text-slate-700">{children}</div>
    </section>
  );
}

export default function LegalPage({
  title,
  intro,
  sections,
  children,
}: {
  title: string;
  intro: string;
  sections: { id: string; title: string }[];
  children: ReactNode;
}) {
  return (
    <main dir="rtl" className="min-h-screen bg-[#F8FAFC] px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-slate-200 pb-6">
          <Link href="/" className="text-sm font-bold text-emerald-700 hover:underline">
            PingLead
          </Link>
          <h1 className="text-3xl font-black text-slate-900">{title}</h1>
          <p className="text-[15px] leading-8 text-slate-600">{intro}</p>
          <p className="text-xs text-slate-400">آخر تحديث: {LEGAL_UPDATED_AT}</p>
        </header>

        <nav aria-label="المحتويات" className="rounded-xl border border-slate-200 bg-white p-4">
          <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-slate-600 hover:text-emerald-700">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="space-y-9">{children}</div>

        <footer className="flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm text-slate-500">
          <Link href="/privacy" className="hover:text-emerald-700">
            سياسة الخصوصية
          </Link>
          <Link href="/terms" className="hover:text-emerald-700">
            شروط الاستخدام
          </Link>
          <Link href="/" className="hover:text-emerald-700">
            الصفحة الرئيسية
          </Link>
        </footer>
      </div>
    </main>
  );
}
