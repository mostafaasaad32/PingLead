// ==============================================================================
// src/app/(dashboard)/admin/page.tsx
// Team-only beta dashboard: signups, activation, alerts, proposals, funnel, scraper
// health and user feedback. Admins only (see src/lib/admin.ts); others get a 404.
// Reads with the service role on the server; nothing here is sent to non-admins.
// ==============================================================================

import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { PLATFORMS_METADATA } from "@/lib/scrapers/types";

export const dynamic = "force-dynamic";

const DAY = 86400e3;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString("ar-EG", { timeZone: "Africa/Cairo", dateStyle: "short", timeStyle: "short" }) : "—";

async function count(table: string, build: (q: any) => any = (q) => q): Promise<number> {
  const { count: n } = await build((supabaseAdmin.from(table) as any).select("id", { count: "exact", head: true }));
  return n || 0;
}

const KIND_LABEL: Record<string, string> = { bug: "🐞 مشكلة", idea: "💡 اقتراح", praise: "👍 عجبته", other: "💬 تانية" };

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAdmin(user)) notFound();

  // ---- Users
  const users: any[] = [];
  for (let page = 1; page < 20; page++) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    users.push(...(data?.users || []));
    if (!data || data.users.length < 1000) break;
  }
  const { data: profiles } = await (supabaseAdmin.from("freelancer_profiles") as any).select(
    "user_id, full_name, telegram_chat_id, ai_credits, email_digest"
  );
  const profileByUser = new Map<string, any>((profiles || []).map((p: any) => [p.user_id, p]));
  const { data: filters } = await (supabaseAdmin.from("user_filters") as any)
    .select("user_id, ai_criteria")
    .eq("is_active", true);
  const { data: pushRows } = await (supabaseAdmin.from("push_subscriptions") as any).select("user_id");

  const signups7 = users.filter((u) => Date.now() - new Date(u.created_at).getTime() < 7 * DAY).length;
  const active7 = users.filter((u) => u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at).getTime() < 7 * DAY).length;
  const onboarded = users.filter((u) => u.user_metadata?.onboarded).length;
  const telegram = (profiles || []).filter((p: any) => p.telegram_chat_id).length;
  const pushUsers = new Set((pushRows || []).map((r: any) => r.user_id)).size;
  const filterUsers = new Set((filters || []).map((f: any) => f.user_id)).size;
  const aiCriteriaUsers = new Set((filters || []).filter((f: any) => f.ai_criteria).map((f: any) => f.user_id)).size;

  // ---- Activity (last 7 days)
  const [matches24, matches7, proposals7, applied, replied, won, feedbackNew] = await Promise.all([
    count("user_project_actions", (q) => q.gte("created_at", iso(DAY))),
    count("user_project_actions", (q) => q.gte("created_at", iso(7 * DAY))),
    count("user_project_actions", (q) => q.not("generated_proposal", "is", null).gte("updated_at", iso(7 * DAY))),
    count("user_project_actions", (q) => q.in("status", ["applied", "replied", "won"])),
    count("user_project_actions", (q) => q.in("status", ["replied", "won"])),
    count("user_project_actions", (q) => q.eq("status", "won")),
    count("feedback", (q) => q.eq("status", "new")),
  ]);

  // ---- Scraper health: new projects per platform in the last 24 h
  const platformCounts = await Promise.all(
    PLATFORMS_METADATA.filter((p) => ["mostaql", "nafezly", "khamsat", "kafiil", "freelancer", "pph", "baeed", "remoteok", "wwr"].includes(p.id)).map(
      async (p) => {
        const { data: last } = await (supabaseAdmin.from("projects") as any)
          .select("created_at")
          .eq("platform", p.id)
          .order("created_at", { ascending: false })
          .limit(1);
        return {
          id: p.id,
          label: p.label_ar,
          day: await count("projects", (q) => q.eq("platform", p.id).gte("created_at", iso(DAY))),
          last: last?.[0]?.created_at || null,
        };
      }
    )
  );

  // ---- Per-user table
  const perUser = await Promise.all(
    [...users]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 100)
      .map(async (u) => {
        const [m7, props, appliedU] = await Promise.all([
          count("user_project_actions", (q) => q.eq("user_id", u.id).gte("created_at", iso(7 * DAY))),
          count("user_project_actions", (q) => q.eq("user_id", u.id).not("generated_proposal", "is", null)),
          count("user_project_actions", (q) => q.eq("user_id", u.id).in("status", ["applied", "replied", "won"])),
        ]);
        const p = profileByUser.get(u.id);
        return {
          id: u.id,
          email: u.email,
          name: p?.full_name,
          created: u.created_at,
          lastSeen: u.last_sign_in_at,
          onboarded: Boolean(u.user_metadata?.onboarded),
          telegram: Boolean(p?.telegram_chat_id),
          filters: (filters || []).filter((f: any) => f.user_id === u.id).length,
          m7,
          props,
          applied: appliedU,
          credits: p?.ai_credits,
        };
      })
  );

  // ---- Feedback
  const { data: feedback } = await (supabaseAdmin.from("feedback") as any)
    .select("id, user_id, kind, message, page, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  const tiles = [
    { label: "مستخدمين", value: users.length, sub: `+${signups7} آخر 7 أيام` },
    { label: "دخلوا آخر 7 أيام", value: active7, sub: `من ${users.length}` },
    { label: "كمّلوا الإعداد", value: onboarded, sub: "خطوات أول مرة" },
    { label: "ربطوا تليجرام", value: telegram, sub: `${pushUsers} فعّلوا إشعارات المتصفح` },
    { label: "عندهم فلتر شغال", value: filterUsers, sub: `${aiCriteriaUsers} كاتبين شروط للـ AI` },
    { label: "تطابقات", value: matches24, sub: `${matches7} آخر 7 أيام` },
    { label: "عروض اتكتبت", value: proposals7, sub: "آخر 7 أيام" },
    { label: "قدّموا / رد / كسبوا", value: `${applied} / ${replied} / ${won}`, sub: "من الأول" },
  ];

  return (
    <div dir="rtl" className="space-y-8">
      <div>
        <h1 className="text-xl font-black text-slate-900">متابعة الـ Beta</h1>
        <p className="text-xs text-slate-500 mt-1">للفريق بس. الأرقام لحظية من الداتابيز.</p>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-[11px] text-slate-500 font-bold">{t.label}</div>
            <div className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{t.value}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{t.sub}</div>
          </div>
        ))}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">صحة السحب (مشاريع جديدة آخر 24 ساعة)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {platformCounts.map((p) => {
            const stale = !p.last || Date.now() - new Date(p.last).getTime() > 6 * 3600e3;
            return (
              <div
                key={p.id}
                className={`rounded-xl border px-3 py-2 ${stale ? "border-rose-200 bg-rose-50" : "border-slate-200"}`}
                title={`آخر مشروع: ${fmtDate(p.last)}`}
              >
                <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>{p.label}</span>
                  <span className="tabular-nums">{p.day}</span>
                </div>
                <div className={`text-[10px] mt-0.5 ${stale ? "text-rose-700 font-bold" : "text-slate-400"}`}>
                  {stale ? "⚠️ متوقف؟ " : ""}آخر مشروع: {fmtDate(p.last)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">
          آراء المستخدمين {feedbackNew > 0 && <span className="text-emerald-700">({feedbackNew} جديد)</span>}
        </h2>
        {!feedback?.length ? (
          <p className="text-xs text-slate-500">لسه مفيش رسايل. زرار «رأيك» موجود تحت على الشمال في كل صفحات الموقع.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {feedback.map((f: any) => (
              <li key={f.id} className="py-3 space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span className="font-bold text-slate-700">{KIND_LABEL[f.kind] || f.kind}</span>
                  <bdi dir="ltr">{emailById.get(f.user_id) || "—"}</bdi>
                  <span>·</span>
                  <span>{fmtDate(f.created_at)}</span>
                  {f.page && (
                    <>
                      <span>·</span>
                      <code dir="ltr" className="bg-slate-100 px-1.5 rounded">{f.page}</code>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{f.message}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">المستخدمين (أحدث 100)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[860px]">
            <thead>
              <tr className="text-slate-500 text-[11px] border-b border-slate-200">
                <th className="text-start py-2 px-2">المستخدم</th>
                <th className="text-start py-2 px-2">سجّل</th>
                <th className="text-start py-2 px-2">آخر دخول</th>
                <th className="py-2 px-2">الإعداد</th>
                <th className="py-2 px-2">تليجرام</th>
                <th className="py-2 px-2">فلاتر</th>
                <th className="py-2 px-2">تطابقات 7 أيام</th>
                <th className="py-2 px-2">عروض</th>
                <th className="py-2 px-2">قدّم</th>
                <th className="py-2 px-2">رصيد</th>
              </tr>
            </thead>
            <tbody>
              {perUser.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="py-2 px-2">
                    <div className="font-bold text-slate-800">{u.name || "—"}</div>
                    <bdi dir="ltr" className="text-[11px] text-slate-500">{u.email}</bdi>
                  </td>
                  <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{fmtDate(u.created)}</td>
                  <td className="py-2 px-2 text-slate-600 whitespace-nowrap">{fmtDate(u.lastSeen)}</td>
                  <td className="py-2 px-2 text-center">{u.onboarded ? "✅" : "—"}</td>
                  <td className="py-2 px-2 text-center">{u.telegram ? "✅" : "—"}</td>
                  <td className="py-2 px-2 text-center tabular-nums">{u.filters}</td>
                  <td className="py-2 px-2 text-center tabular-nums">{u.m7}</td>
                  <td className="py-2 px-2 text-center tabular-nums">{u.props}</td>
                  <td className="py-2 px-2 text-center tabular-nums">{u.applied}</td>
                  <td className="py-2 px-2 text-center tabular-nums">{u.credits ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
