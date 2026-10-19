// ==============================================================================
// src/app/api/insights/route.ts
// Real analytics for the signed-in user over a period (?days=7|30|90):
//   - totals: projects matched, applied, won, win rate, AI proposals (+ previous period)
//   - daily matched/applied series (user's timezone)
//   - breakdown by platform and by category
//   - market demand: projects posted per platform in the last 7 days (all users)
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PLATFORMS_METADATA } from "@/lib/scrapers/types";

export const dynamic = "force-dynamic";

const ALLOWED_DAYS = [7, 30, 90];
const MAX_ROWS = 10000;
const PAGE_SIZE = 1000;
const MARKET_WINDOW_DAYS = 7;

interface Breakdown {
  key: string;
  matched: number;
  applied: number;
  won: number;
}

function bump(map: Map<string, Breakdown>, key: string, status: string) {
  const row = map.get(key) || { key, matched: 0, applied: 0, won: 0 };
  row.matched++;
  if (status === "applied" || status === "won") row.applied++;
  if (status === "won") row.won++;
  map.set(key, row);
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });
  }

  const requested = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);
  const days = ALLOWED_DAYS.includes(requested) ? requested : 30;
  const now = Date.now();
  const since = new Date(now - days * 86400000).toISOString();
  const prevSince = new Date(now - 2 * days * 86400000).toISOString();

  const { data: profile } = await (supabaseAdmin.from("freelancer_profiles") as any)
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  const timeZone = profile?.timezone || "Africa/Cairo";

  const actionsTable = () => supabaseAdmin.from("user_project_actions") as any;

  // Supabase caps each response at 1,000 rows, so page through the period
  const fetchActions = async (): Promise<{ data: any[]; error: { message: string } | null }> => {
    const all: any[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error } = await actionsTable()
        .select("status, created_at, projects(platform, category)")
        .eq("user_id", user.id)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { data: all, error };
      all.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
    }
    return { data: all, error: null };
  };

  const [actionsRes, proposalsRes, prevMatchedRes, prevAppliedRes, ...marketRes] = await Promise.all([
    fetchActions(),
    actionsTable()
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since)
      .not("generated_proposal", "is", null),
    actionsTable()
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", prevSince)
      .lt("created_at", since),
    actionsTable()
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", prevSince)
      .lt("created_at", since)
      .in("status", ["applied", "won"]),
    ...PLATFORMS_METADATA.map((p) =>
      (supabaseAdmin.from("projects") as any)
        .select("id", { count: "exact", head: true })
        .eq("platform", p.id)
        .gte("published_at", new Date(now - MARKET_WINDOW_DAYS * 86400000).toISOString())
    ),
  ]);

  if (actionsRes.error) {
    return NextResponse.json({ error: actionsRes.error.message }, { status: 500 });
  }

  // Day buckets in the user's timezone, oldest first, including empty days
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const daily = new Map<string, { date: string; matched: number; applied: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const date = dayKey.format(new Date(now - i * 86400000));
    daily.set(date, { date, matched: 0, applied: 0 });
  }

  const byPlatform = new Map<string, Breakdown>();
  const byCategory = new Map<string, Breakdown>();
  let matched = 0;
  let applied = 0;
  let won = 0;

  for (const row of actionsRes.data || []) {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    const status: string = row.status;
    if (status === "ignored") continue;

    matched++;
    if (status === "applied" || status === "won") applied++;
    if (status === "won") won++;

    const bucket = daily.get(dayKey.format(new Date(row.created_at)));
    if (bucket) {
      bucket.matched++;
      if (status === "applied" || status === "won") bucket.applied++;
    }

    bump(byPlatform, project?.platform || "other", status);
    bump(byCategory, project?.category || "other", status);
  }

  const sortRows = (map: Map<string, Breakdown>) => Array.from(map.values()).sort((a, b) => b.matched - a.matched);

  return NextResponse.json({
    ok: true,
    days,
    timeZone,
    totals: {
      matched,
      applied,
      won,
      winRate: applied > 0 ? Math.round((won / applied) * 100) : null,
      proposals: proposalsRes.count || 0,
      prevMatched: prevMatchedRes.count || 0,
      prevApplied: prevAppliedRes.count || 0,
    },
    daily: Array.from(daily.values()),
    byPlatform: sortRows(byPlatform),
    byCategory: sortRows(byCategory),
    market: PLATFORMS_METADATA.map((p, i) => ({ key: p.id, count: marketRes[i]?.count || 0 }))
      .filter((m) => m.count > 0)
      .sort((a, b) => b.count - a.count),
    marketWindowDays: MARKET_WINDOW_DAYS,
    truncated: (actionsRes.data || []).length >= MAX_ROWS,
  });
}
