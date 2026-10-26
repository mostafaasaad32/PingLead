// ==============================================================================
// src/app/api/extension/analyze/route.ts
// PingLead Chrome Extension Copilot Endpoint
// Handles:
//   1. CORS for browser extension requests
//   2. Real-time client scoring (0-10, red flags, green flags)
//   3. AI context-aware proposal generation using the user's profile and portfolio
//   4. Crowdsourcing: adds jobs the user is viewing to projects & leads_pool
//
// Security (the extension calls this from any page, without cookies):
//   - The user is identified ONLY by their personal extension key
//     ("Authorization: Bearer plk_..."; Settings → profile), never by an id in the body.
//   - Each proposal costs one AI credit, like every other proposal (refunded on failure).
//   - Crowdsourcing only inserts new jobs from the platform's own domain; it never
//     overwrites an existing project (which could otherwise swap a real job's link).
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { calculateClientScore } from '@/lib/scoring/client-scorer';
import { generateContextAwareProposal } from '@/lib/ai/proposal-generator';
import { classifyProject } from '@/lib/taxonomy';
import { buildPostText, estimateBudgetUsd } from '@/lib/scrapers/types';
import { userIdFromExtensionKey } from '@/lib/extension-keys';
import { consumeAiCredit, refundAiCredit, OUT_OF_CREDITS_MESSAGE } from '@/lib/credits';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Auth is a bearer key (no cookies), so a wildcard origin doesn't expose sessions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/** Platforms the extension runs on, and the hosts their job URLs must come from */
const CROWDSOURCE_HOSTS: Record<string, RegExp> = {
  upwork: /(^|\.)upwork\.com$/i,
  mostaql: /(^|\.)mostaql\.com$/i,
  nafezly: /(^|\.)nafezly\.com$/i,
};

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: corsHeaders });

/** Job id from the platform's own URL; null when the URL isn't a job page we recognise */
function externalIdFromUrl(platform: string, url: URL): string | null {
  if (platform === 'upwork') return url.pathname.match(/~([0-9a-zA-Z]+)/)?.[1] || null;
  if (platform === 'mostaql') return url.pathname.match(/\/project\/(\d+)/)?.[1] || null;
  if (platform === 'nafezly') return url.pathname.match(/\/project\/(\d+)/)?.[1] || null;
  return null;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  const userId = await userIdFromExtensionKey(req.headers.get('authorization'));
  if (!userId) {
    return json(
      { success: false, error: 'مفتاح الإضافة ناقص أو غلط. خد مفتاحك من PingLead ← الإعدادات ← الملف الشخصي، وحطه في إعدادات الإضافة.' },
      401
    );
  }

  let creditSpent = false;
  try {
    const body = await req.json().catch(() => ({}));
    const platform = String(body.platform || 'upwork').toLowerCase();
    const title = String(body.title || '').slice(0, 300);
    const description = String(body.description || '').slice(0, 8000);
    const budget = body.budget ? String(body.budget).slice(0, 100) : null;
    const clientData = body.clientData && typeof body.clientData === 'object' ? body.clientData : {};
    const customInstructions = body.customInstructions ? String(body.customInstructions).slice(0, 1000) : undefined;

    if (!title.trim()) return json({ success: false, error: 'مش لاقي عنوان المشروع في الصفحة.' }, 400);

    // 1. Client Evaluation Algorithm (no AI, free)
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

    // 2. One AI credit per proposal, like the dashboard and Telegram
    const credit = await consumeAiCredit(userId);
    if (!credit.ok) return json({ success: false, error: OUT_OF_CREDITS_MESSAGE, clientEvaluation }, 402);
    creditSpent = true;

    // 3. Freelancer context
    const [profileRes, portfolioRes] = await Promise.all([
      (supabaseAdmin.from('freelancer_profiles') as any)
        .select('bio, skills, tone_of_voice, proposal_instructions')
        .eq('user_id', userId)
        .maybeSingle(),
      (supabaseAdmin.from('portfolio_items') as any).select('*').eq('user_id', userId),
    ]);
    const profile = profileRes.data;

    // 4. AI Proposal Generation
    const classResult = classifyProject({
      platform,
      title,
      description,
      rawCategory: body.rawCategory ? String(body.rawCategory) : null,
      skills: Array.isArray(body.skills) ? body.skills.slice(0, 50).map(String) : null,
    });
    const category = classResult.category;

    const proposalOutput = await generateContextAwareProposal({
      title,
      description: description || title,
      platform,
      category,
      freelancerBio: profile?.bio,
      freelancerSkills: profile?.skills,
      toneOfVoice: profile?.tone_of_voice || 'confident',
      portfolioItems: portfolioRes.data || [],
      customInstructions,
      standingInstructions: profile?.proposal_instructions || null,
    });
    creditSpent = false; // delivered: the credit stays spent

    // 5. Crowdsourcing: new jobs only, from the platform's own domain
    let crowdsourcedProjectId: string | null = null;
    let url: URL | null = null;
    try {
      url = body.url ? new URL(String(body.url)) : null;
    } catch {
      url = null;
    }
    const hostOk = url && url.protocol === 'https:' && CROWDSOURCE_HOSTS[platform]?.test(url.hostname);
    const externalId = hostOk && url ? externalIdFromUrl(platform, url) : null;

    if (hostOk && url && externalId) {
      try {
        const lang = /[؀-ۿ]/.test(title + ' ' + description) ? 'ar' : 'en';
        const cleanUrl = `${url.origin}${url.pathname}`;
        const { data: inserted, error: projErr } = await (supabaseAdmin.from('projects') as any)
          .upsert(
            {
              external_id: externalId,
              platform,
              title,
              description: description || title,
              url: cleanUrl,
              budget,
              budget_usd_estimate: estimateBudgetUsd(clientData.budgetAmount || null, lang === 'ar' ? 'USD' : '$'),
              category,
              language: lang,
              author: clientData.author ? String(clientData.author).slice(0, 120) : lang === 'ar' ? 'صاحب مشروع' : 'Client',
              client_hire_rate: typeof clientData.hireRate === 'number' ? clientData.hireRate : null,
              client_country: clientData.country ? String(clientData.country).slice(0, 80) : null,
              published_at: new Date().toISOString(),
            },
            { onConflict: 'platform,external_id', ignoreDuplicates: true }
          )
          .select('id');

        if (projErr) {
          console.warn('[Extension API] Crowdsource insert error:', projErr.message);
        } else if (inserted?.length) {
          crowdsourcedProjectId = inserted[0].id;
          await (supabaseAdmin.from('leads_pool') as any).upsert(
            {
              platform,
              external_post_id: `${platform}_${externalId}`,
              post_text: buildPostText(platform, title, budget, description),
              post_url: cleanUrl,
              category_slug: category,
              intent_score: 10,
              is_buyer: true,
              published_at: new Date().toISOString(),
            },
            { onConflict: 'external_post_id', ignoreDuplicates: true }
          );
        }
      } catch (crowdErr: any) {
        console.warn('[Extension API] Crowdsourcing failed:', crowdErr.message);
      }
    }

    return json({
      success: true,
      clientEvaluation,
      proposal: proposalOutput.proposal,
      referencedPortfolio: proposalOutput.selectedPortfolio,
      modelUsed: proposalOutput.modelUsed,
      crowdsourcedProjectId,
      remainingCredits: credit.remaining,
    });
  } catch (error: any) {
    if (creditSpent) await refundAiCredit(userId);
    console.error('[Extension API Error]:', error);
    return json({ success: false, error: 'تعذر توليد العرض دلوقتي، والرصيد مااتخصمش. جرّب تاني.' }, 500);
  }
}
