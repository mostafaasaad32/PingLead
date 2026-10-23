// ==============================================================================
// src/app/api/cron/digest/route.ts
// Email digest of new matches. Call it every hour (cron-job.org, same Bearer
// CRON_SECRET as /api/cron/ingest):
//   - 'hourly' users: matches since their last digest, at most once an hour
//   - 'daily' users: at 9:00 in their timezone, matches since the last digest
// Matches below the filter's AI threshold and ignored projects are left out.
// A user is only emailed when there is at least one match.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLATFORMS_METADATA } from "@/lib/scrapers/types";
import { digestEmailHtml, isEmailConfigured, sendEmail } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAILY_HOUR = 9;
const MAX_PROJECTS_IN_EMAIL = 15;
const MAX_USERS_PER_RUN = 200;
const DEFAULT_AI_MIN_SCORE = 70;

function localHour(timeZone: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(new Date()));
  } catch {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", hour12: false }).format(new Date()));
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ ok: true, skipped: "RESEND_API_KEY / EMAIL_FROM not set" });
  }

  const now = Date.now();
  const { data: profiles, error } = await (supabaseAdmin.from("freelancer_profiles") as any)
    .select("user_id, full_name, timezone, email_digest, email_digest_sent_at")
    .in("email_digest", ["hourly", "daily"])
    .limit(MAX_USERS_PER_RUN);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "https://ping-lead.vercel.app").replace(/\/$/, "");
  let sent = 0;
  let due = 0;

  for (const p of profiles || []) {
    const lastSent = p.email_digest_sent_at ? new Date(p.email_digest_sent_at).getTime() : 0;
    const isDue =
      p.email_digest === "hourly"
        ? now - lastSent >= 55 * 60 * 1000
        : localHour(p.timezone || "Africa/Cairo") === DAILY_HOUR && now - lastSent >= 20 * 60 * 60 * 1000;
    if (!isDue) continue;
    due++;

    const since = new Date(lastSent || now - (p.email_digest === "hourly" ? 3600e3 : 86400e3)).toISOString();
    const { data: rows } = await (supabaseAdmin.from("user_project_actions") as any)
      .select("created_at, status, ai_score, ai_reason, user_filters ( ai_min_score ), projects ( title, url, platform, budget )")
      .eq("user_id", p.user_id)
      .gt("created_at", since)
      .neq("status", "ignored")
      .order("created_at", { ascending: false })
      .limit(300);

    const matches = (rows || []).filter((r: any) => {
      if (!r.projects) return false;
      if (typeof r.ai_score !== "number") return true;
      return r.ai_score >= (r.user_filters?.ai_min_score ?? DEFAULT_AI_MIN_SCORE);
    });

    let failed = false;
    if (matches.length) {
      const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
      const email = userRes?.user?.email;
      if (email) {
        // Best fits first (scored ones by score), then the newest
        const ordered = [...matches].sort((a: any, b: any) => (b.ai_score ?? -1) - (a.ai_score ?? -1));
        const html = digestEmailHtml({
          name: p.full_name,
          periodLabel: p.email_digest === "hourly" ? "ملخص آخر ساعة" : "ملخص آخر 24 ساعة",
          totalCount: matches.length,
          siteUrl,
          projects: ordered.slice(0, MAX_PROJECTS_IN_EMAIL).map((r: any) => ({
            title: r.projects.title,
            url: r.projects.url,
            platformLabel: PLATFORMS_METADATA.find((x) => x.id === r.projects.platform)?.label_ar || r.projects.platform,
            budget: r.projects.budget,
            aiScore: r.ai_score,
            aiReason: r.ai_reason,
          })),
        });
        if (await sendEmail(email, `🎯 ${matches.length} مشروع جديد يطابق فلاترك`, html)) sent++;
        else failed = true; // keep the window so the next run retries these matches
      }
    }

    // Move the window (also when nothing matched), unless sending failed
    if (!failed) await (supabaseAdmin.from("freelancer_profiles") as any)
      .update({ email_digest_sent_at: new Date(now).toISOString() })
      .eq("user_id", p.user_id);
  }

  return NextResponse.json({ ok: true, subscribers: profiles?.length || 0, due, sent });
}
