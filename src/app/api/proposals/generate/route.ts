// ==============================================================================
// src/app/api/proposals/generate/route.ts
// Phase 4: Context-Aware AI Proposal Engine (Vollna Architecture)
// Generates winning proposals tailored to project details, freelancer bio,
// and automatically cites the best 1-2 matching portfolio proof items with live links.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PortfolioItem, extractTitleFromPostText, extractDetailsFromPostText } from '@/lib/scrapers/types';
import { generateContextAwareProposal } from '@/lib/ai/proposal-generator';
import { getProjectPricing, pricingPromptHint } from '@/lib/insights/pricing';
import { consumeAiCredit, refundAiCredit, OUT_OF_CREDITS_MESSAGE } from '@/lib/credits';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 0. Require an authenticated session; the user is always taken from the cookie, never the body
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'غير مصرح - يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      project_id,
      lead_id,
      project_title,
      project_description,
      freelancer_bio,
      freelancer_skills,
      tone_of_voice,
      custom_instructions,
    } = body;

    let targetProjectId = project_id || null;
    let title = project_title || '';
    let description = project_description || '';
    let category = 'web_dev';
    let platform = '';

    // 1. Resolve the stored project (directly, or through the dashboard's leads_pool row)
    let proj: any = null;
    if (project_id) {
      const { data } = await supabaseAdmin.from('projects').select('*').eq('id', project_id).maybeSingle();
      proj = data;
    } else if (lead_id) {
      const { data: lead } = await supabaseAdmin
        .from('leads_pool')
        .select('*')
        .eq('id', lead_id)
        .maybeSingle();

      if (lead) {
        title = title || extractTitleFromPostText(lead.post_text);
        description = description || extractDetailsFromPostText(lead.post_text);
        category = lead.category_slug || category;
        platform = lead.platform || platform;

        const prefix = `${lead.platform}_`;
        if (lead.external_post_id?.startsWith(prefix)) {
          const { data } = await (supabaseAdmin.from('projects') as any)
            .select('*')
            .eq('platform', lead.platform)
            .eq('external_id', lead.external_post_id.slice(prefix.length))
            .maybeSingle();
          proj = data;
        }
      }
    }

    if (proj) {
      targetProjectId = proj.id;
      title = proj.title || title;
      // Mostaql projects store the full page description; prefer it over the listing snippet
      if (proj.description && proj.description.length > description.length) description = proj.description;
      category = proj.category || category;
      platform = proj.platform || platform;
    }

    // 1b. Market price/timeline baseline for the AI to adjust
    const pricing = proj
      ? await getProjectPricing({
          platform: proj.platform,
          category: proj.category,
          budget_min: proj.budget_min,
          budget_max: proj.budget_max,
          currency: proj.currency,
          bids_count: proj.bids_count,
          bids_avg: proj.bids_avg,
          duration_text: proj.duration_text,
        }).catch(() => null)
      : null;

    if (!title && !description) {
      return NextResponse.json(
        { error: 'Project title or description is required to generate a proposal.' },
        { status: 400 }
      );
    }

    // 2. Identify effective user context (freelancer_profiles)
    const effectiveUserId = user.id;
    let effectiveBio = freelancer_bio || '';
    let effectiveSkills = freelancer_skills || '';
    let effectiveTone = tone_of_voice || '';

    const { data: profile } = await supabaseAdmin
      .from('freelancer_profiles')
      .select('*')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    if (profile) {
      effectiveBio = effectiveBio || profile.bio || profile.title || '';
      effectiveSkills = effectiveSkills || profile.skills || '';
      effectiveTone = effectiveTone || profile.tone_of_voice || 'confident';
    }
    effectiveTone = effectiveTone || 'confident';

    // 3. Fetch Portfolio Items
    let portfolioItems: PortfolioItem[] = [];
    if (effectiveUserId) {
      const { data: userPortfolio } = await supabaseAdmin
        .from('portfolio_items')
        .select('*')
        .eq('user_id', effectiveUserId);

      if (userPortfolio && userPortfolio.length > 0) {
        portfolioItems = userPortfolio.map((item: any) => ({
          id: item.id,
          user_id: item.user_id,
          project_title: item.project_title,
          description: item.description,
          live_url: item.live_url,
          tags: item.tags || [],
          category: item.category,
        }));
      }
    }

    // 4. Spend one credit up front (atomic), refunded if generation fails
    const credit = await consumeAiCredit(effectiveUserId);
    if (!credit.ok) {
      return NextResponse.json(
        { error: credit.remaining === 0 ? OUT_OF_CREDITS_MESSAGE : 'تعذر خصم الرصيد، حاول مرة أخرى.' },
        { status: 402 }
      );
    }
    const remainingCredits = credit.remaining;

    // 4.5. Generate proposal via context-aware AI engine
    let result;
    try {
      result = await generateContextAwareProposal({
        title,
        description,
        category,
        platform,
        freelancerBio: effectiveBio,
        freelancerSkills: effectiveSkills,
        toneOfVoice: effectiveTone,
        customInstructions: custom_instructions,
        portfolioItems,
        pricingHint: pricing ? pricingPromptHint(pricing) : undefined,
      });
    } catch (err) {
      await refundAiCredit(effectiveUserId);
      throw err;
    }

    // 5. Save Proposal to user_project_actions (Mini-CRM)
    let savedActionId: string | null = null;
    if (effectiveUserId && targetProjectId) {
      try {
        const { data: action, error: actionErr } = await (supabaseAdmin
          .from('user_project_actions') as any)
          .upsert(
            {
              user_id: effectiveUserId,
              project_id: targetProjectId,
              status: 'applied',
              generated_proposal: result.proposal,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,project_id' }
          )
          .select('id')
          .single();

        if (!actionErr && action) {
          savedActionId = action.id;
        }
      } catch (err: any) {
        console.warn('[AI Proposal Generator] Could not upsert user_project_actions:', err.message);
      }
    }

    return NextResponse.json({
      ok: true,
      proposal: result.proposal,
      remaining_credits: remainingCredits,
      selectedPortfolio: result.selectedPortfolio.map((sp) => ({
        id: sp.item.id,
        title: sp.item.project_title,
        live_url: sp.item.live_url,
        matchReasons: sp.matchReasons,
        score: sp.score,
      })),
      action_id: savedActionId,
      model_used: result.modelUsed,
      execution_time_ms: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error('[AI Proposal Generator] Pipeline failure:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
