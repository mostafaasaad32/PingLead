// ==============================================================================
// src/app/api/proposals/generate/route.ts
// Phase 4: Context-Aware AI Proposal Engine (Vollna Architecture)
// Generates winning proposals tailored to project details, freelancer bio,
// and automatically cites the best 1-2 matching portfolio proof items with live links.
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { PortfolioItem } from '@/lib/scrapers/types';
import { generateContextAwareProposal } from '@/lib/ai/proposal-generator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      project_id,
      lead_id,
      user_id,
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

    // 1. Fetch project details if project_id or lead_id provided
    if (project_id) {
      const { data: proj } = await supabaseAdmin
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .maybeSingle();

      if (proj) {
        title = proj.title || title;
        description = proj.description || description;
        category = proj.category || category;
        platform = proj.platform || platform;
      }
    }

    if (!title && lead_id) {
      const { data: lead } = await supabaseAdmin
        .from('leads_pool')
        .select('*')
        .eq('id', lead_id)
        .maybeSingle();

      if (lead) {
        description = lead.post_text || description;
        const firstLine = (lead.post_text || '').split('\n')[0] || '';
        title = firstLine.replace(/\[.*?\]/g, '').trim() || title;
        category = lead.category_slug || category;
        platform = lead.platform || platform;
      }
    }

    if (!title && !description) {
      return NextResponse.json(
        { error: 'Project title or description is required to generate a proposal.' },
        { status: 400 }
      );
    }

    // 2. Identify effective user context (freelancer_profiles)
    let effectiveUserId = user_id || null;
    let effectiveBio = freelancer_bio || '';
    let effectiveSkills = freelancer_skills || '';
    let effectiveTone = tone_of_voice || 'confident';

    if (!effectiveUserId) {
      // Fallback to first profile in database if available
      const { data: defaultProfile } = await supabaseAdmin
        .from('freelancer_profiles')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (defaultProfile) {
        effectiveUserId = defaultProfile.user_id;
        effectiveBio = effectiveBio || defaultProfile.bio || defaultProfile.title || '';
        effectiveSkills = effectiveSkills || defaultProfile.skills || '';
        effectiveTone = effectiveTone || defaultProfile.tone_of_voice || 'confident';
      }
    } else {
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
    }

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

    // 4. Generate proposal via context-aware AI engine
    const result = await generateContextAwareProposal({
      title,
      description,
      category,
      platform,
      freelancerBio: effectiveBio,
      freelancerSkills: effectiveSkills,
      toneOfVoice: effectiveTone,
      customInstructions: custom_instructions,
      portfolioItems,
    });

    // 4.5. Deduct 1 credit from freelancer_profiles in Supabase
    let remainingCredits: number | null = null;
    if (effectiveUserId) {
      try {
        const { data: prof } = await (supabaseAdmin
          .from('freelancer_profiles') as any)
          .select('ai_credits')
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        if (prof && typeof prof.ai_credits === 'number' && prof.ai_credits > 0) {
          const newCredit = prof.ai_credits - 1;
          await (supabaseAdmin
            .from('freelancer_profiles') as any)
            .update({ ai_credits: newCredit, updated_at: new Date().toISOString() })
            .eq('user_id', effectiveUserId);
          remainingCredits = newCredit;
        }
      } catch (err: any) {
        console.warn('[AI Proposal Generator] Credit deduction error:', err.message);
      }
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
