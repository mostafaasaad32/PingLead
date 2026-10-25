// ==============================================================================
// src/app/api/extension/analyze/route.ts
// PingLead Chrome Extension Copilot Endpoint
// Handles:
//   1. Full CORS for browser extension requests
//   2. Real-time client scoring (0-10, red flags, green flags)
//   3. AI Context-Aware proposal generation using user's portfolio and Gemini AI
//   4. Crowdsourcing (upserting jobs directly into Supabase projects & leads_pool)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateClientScore } from '@/lib/scoring/client-scorer';
import { generateContextAwareProposal } from '@/lib/ai/proposal-generator';
import { classifyProject } from '@/lib/taxonomy';
import { buildPostText, estimateBudgetUsd } from '@/lib/scrapers/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Standard CORS headers allowing Chrome Extension cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      platform = 'upwork',
      url,
      title = '',
      description = '',
      budget,
      externalId: rawExternalId,
      clientData = {},
      customInstructions,
      rawCategory,
      skills,
    } = body;

    // 1. Client Evaluation Algorithm
    const clientEvaluation = calculateClientScore({
      platform,
      title,
      description,
      budget,
      client_hire_rate: clientData.hireRate,
      payment_verified: clientData.paymentVerified,
      total_spent: clientData.totalSpent,
      client_rating: clientData.rating,
      client_country: clientData.country,
      client_open_projects: clientData.openProjects,
      client_in_progress: clientData.inProgressProjects,
      author: clientData.author,
    });

    // 2. Fetch Freelancer Context (if User ID is supplied)
    let freelancerProfile: any = null;
    let portfolioItems: any[] = [];

    const effectiveUserId = userId || req.headers.get('x-user-id');
    if (effectiveUserId) {
      try {
        const [profileRes, portfolioRes] = await Promise.all([
          supabaseAdmin
            .from('freelancer_profiles')
            .select('*')
            .eq('user_id', effectiveUserId)
            .maybeSingle(),
          supabaseAdmin
            .from('portfolio_items')
            .select('*')
            .eq('user_id', effectiveUserId),
        ]);

        if (profileRes.data) freelancerProfile = profileRes.data;
        if (portfolioRes.data) portfolioItems = portfolioRes.data;
      } catch (err: any) {
        console.warn('[Extension API] Could not load user profile/portfolio:', err.message);
      }
    }

    // 3. AI Proposal Generation
    const classResult = classifyProject({
      platform,
      title,
      description,
      rawCategory: rawCategory || null,
      skills: Array.isArray(skills) ? skills : null,
    });
    const category = classResult.category;

    const proposalOutput = await generateContextAwareProposal({
      title,
      description: description || title,
      platform,
      category,
      freelancerBio: freelancerProfile?.bio,
      freelancerSkills: freelancerProfile?.skills,
      toneOfVoice: freelancerProfile?.tone_of_voice || 'confident',
      portfolioItems,
      customInstructions,
      standingInstructions: freelancerProfile?.standing_instructions || null,
    });

    // 4. Crowdsourcing (Upsert into Supabase projects & leads_pool)
    let crowdsourcedProjectId: string | null = null;
    if (title && url) {
      try {
        let externalId = rawExternalId;
        if (!externalId) {
          if (platform === 'upwork') {
            const m = url.match(/~([0-9a-fA-F]+)/);
            externalId = m ? m[1] : `upwork_${Date.now()}`;
          } else if (platform === 'mostaql') {
            const m = url.match(/\/project\/(\d+)/);
            externalId = m ? m[1] : `mostaql_${Date.now()}`;
          } else {
            externalId = `${platform}_${Date.now()}`;
          }
        }

        const lang = /[\u0600-\u06FF]/.test(title + ' ' + description) ? 'ar' : 'en';
        const postText = buildPostText(platform, title, budget, description);
        const budgetEstimate = estimateBudgetUsd(
          clientData.budgetAmount || null,
          lang === 'ar' ? 'USD' : '$'
        );

        // Upsert project
        const { data: upsertedProj, error: projErr } = await (supabaseAdmin.from('projects') as any)
          .upsert(
            {
              external_id: externalId,
              platform,
              title,
              description: description || title,
              url,
              budget: budget || null,
              budget_usd_estimate: budgetEstimate,
              category,
              language: lang,
              author: clientData.author || (lang === 'ar' ? 'صاحب مشروع' : 'Client'),
              client_hire_rate: clientData.hireRate ?? null,
              client_open_projects: clientData.openProjects ?? null,
              client_in_progress: clientData.inProgressProjects ?? null,
              client_registered_at: clientData.registeredAt ?? null,
              client_country: clientData.country ?? null,
              details_fetched_at: new Date().toISOString(),
              published_at: new Date().toISOString(),
            },
            { onConflict: 'platform,external_id' }
          )
          .select('id')
          .single();

        if (projErr) {
          console.warn('[Extension API] Crowdsource project upsert error:', projErr.message);
        } else if (upsertedProj) {
          crowdsourcedProjectId = upsertedProj.id;

          // Upsert into leads_pool for real-time dashboard visibility
          await (supabaseAdmin.from('leads_pool') as any).upsert(
            {
              platform,
              external_post_id: `${platform}_${externalId}`,
              post_text: postText,
              post_url: url,
              category_slug: category,
              intent_score: 10,
              is_buyer: true,
              published_at: new Date().toISOString(),
            },
            { onConflict: 'external_post_id' }
          );
        }
      } catch (crowdErr: any) {
        console.warn('[Extension API] Failed to crowdsource job to database:', crowdErr.message);
      }
    }

    return NextResponse.json(
      {
        success: true,
        clientEvaluation,
        proposal: proposalOutput.proposal,
        referencedPortfolio: proposalOutput.selectedPortfolio,
        modelUsed: proposalOutput.modelUsed,
        crowdsourcedProjectId,
      },
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error: any) {
    console.error('[Extension API Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error processing extension request',
      },
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
