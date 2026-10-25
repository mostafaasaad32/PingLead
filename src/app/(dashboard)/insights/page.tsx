"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, TrendingUp, TrendingDown, Target, Send, Trophy, Sparkles, Filter, MessageCircle } from "lucide-react";
import { PLATFORMS_METADATA, CATEGORIES_METADATA } from "@/lib/scrapers/types";

interface Breakdown {
  key: string;
  matched: number;
  applied: number;
  replied: number;
  won: number;
}

interface InsightsData {
  days: number;
  totals: {
    matched: number;
    applied: number;
    replied: number;
    won: number;
    replyRate: number | null;
    winRate: number | null;
    proposals: number;
    prevMatched: number;
    prevApplied: number;
  };
  daily: { date: string; matched: number; applied: number }[];
  byPlatform: Breakdown[];
  byCategory: Breakdown[];
  templates: { key: string; name: string | null; sent: number; replied: number; won: number }[];
  market: { key: string; count: number }[];
  marketWindowDays: number;
}

const PERIODS = [
  { days: 7, label: "آخر 7 أيام" },
  { days: 30, label: "آخر 30 يوم" },
  { days: 90, label: "آخر 90 يوم" },
];

// Legacy category slugs still stored on older projects
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  web_dev: "برمجة وتطوير المواقع والتطبيقات",
  design: "التصميم والجرافيك وUI/UX",
  ui_ux: "التصميم والجرافيك وUI/UX",
  marketing: "التسويق الرقمي والإعلانات وSEO",
  writing: "الكتابة وصناعة المحتوى والترجمة",
  accounting: "المحاسبة والمالية والقانون والأعمال",
};

const platformLabel = (key: string) =>
  PLATFORMS_METADATA.find((p) => p.id === key)?.label_ar.replace(/\s*\(.*\)$/, "") || key;
const categoryLabel = (key: string) =>
  CATEGORIES_METADATA.find((c) => c.id === key)?.label_ar || LEGACY_CATEGORY_LABELS[key] || "أخرى";

const fmt = (n: number) => n.toLocaleString("en-US");

function formatDay(date: string) {
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short" });
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <span className="text-[11px] text-slate-400">بدون تغيير</span>;
  const up = change > 0;
  return (
    <span className={`text-[11px] font-semibold flex items-center gap-0.5 ${up ? "text-emerald-700" : "text-slate-500"}`}>
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}
      {change}% عن الفترة السابقة
    </span>
  );
}

function StatTile({
  label,
  value,
  icon,
  footer,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="vollna-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500">{label}</span>
        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">{icon}</div>
      </div>
      <span className="text-3xl font-black text-slate-900">{value}</span>
      <div className="min-h-[16px]">{footer}</div>
    </div>
  );
}

/** Daily matched projects: one series, hover/focus tooltip with the applied count. */
function DailyChart({ daily }: { daily: InsightsData["daily"] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...daily.map((d) => d.matched));
  const niceMax = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const ticks = [niceMax, Math.round(niceMax / 2), 0];
  const PLOT_H = 180;
  const labelEvery = Math.ceil(daily.length / 6);
  const point = active !== null ? daily[active] : null;

  return (
    <div dir="ltr" className="relative">
      <div className="flex">
        {/* y axis */}
        <div className="flex flex-col justify-between text-[10px] text-slate-400 pr-2 tabular-nums" style={{ height: PLOT_H }}>
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>

        {/* plot */}
        <div className="relative flex-1" style={{ height: PLOT_H }} onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute inset-x-0 ${t === 0 ? "border-t border-slate-300" : "border-t border-slate-100"}`}
              style={{ bottom: `${(t / niceMax) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end" style={{ gap: daily.length > 40 ? 1 : 2 }}>
            {daily.map((d, i) => (
              <button
                key={d.date}
                type="button"
                aria-label={`${formatDay(d.date)}: ${d.matched} مشروع، قدّمت على ${d.applied}`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="relative flex-1 h-full flex items-end focus:outline-none group"
              >
                <span
                  className={`block w-full rounded-t-[4px] transition-colors ${
                    active === i ? "bg-emerald-700" : "bg-emerald-500"
                  } ${d.matched === 0 ? "opacity-0" : ""}`}
                  style={{ height: `${Math.max(d.matched > 0 ? 2 : 0, (d.matched / niceMax) * 100)}%` }}
                />
              </button>
            ))}
          </div>

          {point && (
            <div
              className="absolute -top-2 z-10 -translate-x-1/2 -translate-y-full pointer-events-none bg-slate-900 text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap"
              style={{ left: `${((active! + 0.5) / daily.length) * 100}%` }}
              dir="rtl"
            >
              <div className="font-bold">{formatDay(point.date)}</div>
              <div>{point.matched} مشروع وصلك</div>
              <div className="text-emerald-300">قدّمت على {point.applied}</div>
            </div>
          )}
        </div>
      </div>

      {/* x axis */}
      <div className="flex pl-6 mt-1.5 text-[10px] text-slate-400 tabular-nums">
        {daily.map((d, i) => (
          <span key={d.date} className="flex-1 text-center overflow-visible whitespace-nowrap">
            {i % labelEvery === 0 || i === daily.length - 1 ? formatDay(d.date) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Horizontal bars for a ranked list; label and value stay in text ink. */
function HBarList({
  rows,
  colorClass,
  emptyText,
}: {
  rows: { label: string; value: number; hint?: string }[];
  colorClass: string;
  emptyText: string;
}) {
  if (rows.length === 0) return <p className="text-xs text-slate-400 py-6 text-center">{emptyText}</p>;
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="space-y-1" title={r.hint}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-700 truncate">{r.label}</span>
            <span className="font-bold text-slate-900 tabular-nums shrink-0">{fmt(r.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function InsightsPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/insights?days=${days}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "تعذر تحميل التحليلات");
        if (!cancelled) setData(json);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const categoryRows = useMemo(() => {
    if (!data) return [];
    const top = data.byCategory.slice(0, 6);
    const rest = data.byCategory.slice(6).reduce((sum, r) => sum + r.matched, 0);
    const rows: { label: string; value: number; hint?: string }[] = top.map((r) => ({
      label: categoryLabel(r.key),
      value: r.matched,
      hint: `قدّمت على ${r.applied}`,
    }));
    if (rest > 0) rows.push({ label: "باقي التخصصات", value: rest });
    return rows;
  }, [data]);

  const t = data?.totals;
  const isEmpty = !!data && t!.matched === 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header + period filter (one row scoping every chart below) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
            <span>التحليلات والمؤشرات</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">المشاريع اللي وصلتك، واللي قدّمت عليها وكسبتها، وفين الطلب أكتر.</p>
        </div>
        <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start" role="tablist">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              role="tab"
              aria-selected={days === p.days}
              onClick={() => setDays(p.days)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                days === p.days ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {!data && loading && (
        <div className="vollna-card p-10 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-500">جاري حساب التحليلات...</p>
        </div>
      )}

      {data && (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {/* KPI tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatTile
              label="مشاريع وصلتك"
              value={fmt(t!.matched)}
              icon={<Target className="w-4 h-4" />}
              footer={<Delta current={t!.matched} previous={t!.prevMatched} />}
            />
            <StatTile
              label="قدّمت عليها"
              value={fmt(t!.applied)}
              icon={<Send className="w-4 h-4" />}
              footer={
                t!.matched > 0 ? (
                  <span className="text-[11px] text-slate-400">
                    {Math.round((t!.applied / t!.matched) * 100)}% من المشاريع اللي وصلتك
                  </span>
                ) : null
              }
            />
            <StatTile
              label="العميل رد"
              value={fmt(t!.replied)}
              icon={<MessageCircle className="w-4 h-4" />}
              footer={
                t!.replyRate !== null ? (
                  <span className="text-[11px] text-slate-500">
                    معدل الرد <b className="text-slate-800">{t!.replyRate}%</b>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">علّم «العميل رد» من المتتبع</span>
                )
              }
            />
            <StatTile
              label="كسبتها"
              value={fmt(t!.won)}
              icon={<Trophy className="w-4 h-4" />}
              footer={
                t!.winRate !== null ? (
                  <span className="text-[11px] text-slate-500">
                    معدل الفوز <b className="text-slate-800">{t!.winRate}%</b>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">علّم المشروع «فوز» من المتتبع</span>
                )
              }
            />
            <StatTile
              label="عروض AI اتولّدت"
              value={fmt(t!.proposals)}
              icon={<Sparkles className="w-4 h-4" />}
            />
          </div>

          {isEmpty ? (
            <div className="vollna-card p-10 bg-white border border-slate-200 rounded-2xl text-center space-y-3">
              <p className="text-sm font-bold text-slate-800">مفيش مشاريع وصلتك في الفترة دي لسه</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                المشاريع بتتحسب هنا لما تطابق فلتر من فلاترك. اتأكد إن عندك فلتر شغال، ووسّع الفترة لو عملت حسابك من قريب.
              </p>
              <Link
                href="/filters"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>ظبّط فلاترك</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Daily */}
              <section className="vollna-card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
                <div>
                  <h2 className="text-sm font-black text-slate-900">المشاريع اللي وصلتك يومياً</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">مرّر على أي يوم عشان تشوف عدد اللي قدّمت عليه</p>
                </div>
                <DailyChart daily={data.daily} />
              </section>

              {/* Platforms table */}
              <section className="vollna-card bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="p-5 sm:p-6 pb-3">
                  <h2 className="text-sm font-black text-slate-900">حسب المنصة</h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">فين بتجيلك مشاريع أكتر، وفين بتكسب أكتر</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs min-w-[520px]">
                    <thead>
                      <tr className="text-slate-500 border-y border-slate-100 bg-slate-50/60">
                        <th className="text-right font-semibold px-5 py-2.5">المنصة</th>
                        <th className="text-right font-semibold px-3 py-2.5 w-[40%]">وصلتك</th>
                        <th className="text-right font-semibold px-3 py-2.5">قدّمت</th>
                        <th className="text-right font-semibold px-3 py-2.5">رد</th>
                        <th className="text-right font-semibold px-3 py-2.5">كسبت</th>
                        <th className="text-right font-semibold px-5 py-2.5">معدل الفوز</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byPlatform.map((r) => {
                        const maxMatched = data.byPlatform[0]?.matched || 1;
                        return (
                          <tr key={r.key} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3 font-bold text-slate-800 whitespace-nowrap">{platformLabel(r.key)}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span className="w-8 font-bold text-slate-900 tabular-nums">{fmt(r.matched)}</span>
                                <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-emerald-500"
                                    style={{ width: `${(r.matched / maxMatched) * 100}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-700">{fmt(r.applied)}</td>
                            <td className="px-3 py-3 tabular-nums text-slate-700">{fmt(r.replied)}</td>
                            <td className="px-3 py-3 tabular-nums text-slate-700">{fmt(r.won)}</td>
                            <td className="px-5 py-3 tabular-nums text-slate-700">
                              {r.applied > 0 ? `${Math.round((r.won / r.applied) * 100)}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {data.templates.length > 0 && (
                <section className="vollna-card bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="p-5 sm:p-6 pb-3">
                    <h2 className="text-sm font-black text-slate-900">نتايج قوالب A/B</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">العروض التي قدّمتها بمختلف القوالب، ونسبة الرد على كل قالب</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[420px]">
                      <thead>
                        <tr className="text-slate-500 border-y border-slate-100 bg-slate-50/60">
                          <th className="text-right font-semibold px-5 py-2.5">القالب</th>
                          <th className="text-right font-semibold px-3 py-2.5">اتقدّم</th>
                          <th className="text-right font-semibold px-3 py-2.5">رد</th>
                          <th className="text-right font-semibold px-3 py-2.5">كسب</th>
                          <th className="text-right font-semibold px-5 py-2.5">معدل الرد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.templates.map((tpl) => (
                          <tr key={tpl.key} className="border-b border-slate-100 last:border-0">
                            <td className="px-5 py-3 font-bold text-slate-800">
                              {tpl.key}
                              {tpl.name ? <span className="font-normal text-slate-500"> · {tpl.name}</span> : null}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-slate-700">{fmt(tpl.sent)}</td>
                            <td className="px-3 py-3 tabular-nums text-slate-700">{fmt(tpl.replied)}</td>
                            <td className="px-3 py-3 tabular-nums text-slate-700">{fmt(tpl.won)}</td>
                            <td className="px-5 py-3 tabular-nums font-bold text-slate-900">
                              {tpl.sent > 0 ? `${Math.round((tpl.replied / tpl.sent) * 100)}%` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <section className="vollna-card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">حسب التخصص</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">المشاريع اللي وصلتك في كل تخصص</p>
                  </div>
                  <HBarList rows={categoryRows} colorClass="bg-emerald-500" emptyText="مفيش بيانات" />
                </section>

                <section className="vollna-card p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl space-y-4">
                  <div>
                    <h2 className="text-sm font-black text-slate-900">الطلب في السوق</h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      كل المشاريع اللي نزلت على كل منصة في آخر {data.marketWindowDays} أيام، لكل المستخدمين
                    </p>
                  </div>
                  <HBarList
                    rows={data.market.map((m) => ({ label: platformLabel(m.key), value: m.count }))}
                    colorClass="bg-slate-400"
                    emptyText="مفيش مشاريع اتسحبت في الفترة دي"
                  />
                </section>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
