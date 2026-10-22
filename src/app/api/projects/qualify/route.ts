// ==============================================================================
// src/app/api/projects/qualify/route.ts
// "فحص التوافق" on the filters page: scores the given projects against the criteria
// the user is writing, so they can test them before saving. Uses the same monthly
// evaluation quota as the automatic qualifier in the ingest cron.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  MONTHLY_AI_EVALUATIONS,
  qualifyProjects,
  releaseEvaluations,
  remainingEvaluations,
  reserveEvaluations,
} from "@/lib/ai/project-qualifier";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_PROJECTS = 30;

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });

  return NextResponse.json({ ok: true, remaining: await remainingEvaluations(user.id), monthly: MONTHLY_AI_EVALUATIONS });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const criteria = typeof body.criteria === "string" ? body.criteria.trim().slice(0, 1000) : "";
  const ids: string[] = Array.isArray(body.project_ids)
    ? Array.from(new Set<string>(body.project_ids.filter((id: any) => typeof id === "string"))).slice(0, MAX_PROJECTS)
    : [];

  if (criteria.length < 5) {
    return NextResponse.json({ error: "اكتب شروطك الأول في خانة \"شروطك للـ AI\"." }, { status: 400 });
  }
  if (!ids.length) return NextResponse.json({ error: "مفيش مشاريع للفحص." }, { status: 400 });

  const { data: projects, error } = await (supabaseAdmin.from("projects") as any)
    .select("id, title, description, platform, budget, budget_usd_estimate")
    .in("id", ids);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!projects?.length) return NextResponse.json({ error: "المشاريع دي مش موجودة." }, { status: 404 });

  const granted = await reserveEvaluations(user.id, projects.length);
  if (granted === 0) {
    return NextResponse.json(
      { error: `رصيد تقييم الـ AI خلص. الرصيد بيتجدد أول كل شهر (${MONTHLY_AI_EVALUATIONS} تقييم).`, remaining: 0 },
      { status: 402 }
    );
  }

  const toScore = projects.slice(0, granted);
  const { data: profile } = await (supabaseAdmin.from("freelancer_profiles") as any)
    .select("skills")
    .eq("user_id", user.id)
    .maybeSingle();

  const { results } = await qualifyProjects(
    criteria,
    toScore.map((p: any) => ({ ...p, budget_usd: p.budget_usd_estimate })),
    profile?.skills || []
  );
  const unscored = results.filter((r) => !r).length;
  if (unscored > 0) await releaseEvaluations(user.id, unscored);

  const scores: Record<string, { score: number; reason: string }> = {};
  toScore.forEach((p: any, i: number) => {
    if (results[i]) scores[p.id] = results[i]!;
  });

  if (!Object.keys(scores).length) {
    return NextResponse.json({ error: "الـ AI مردّش دلوقتي. جرّب تاني بعد شوية (الرصيد مااتخصمش)." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    scores,
    skipped: projects.length - toScore.length,
    remaining: await remainingEvaluations(user.id),
  });
}
