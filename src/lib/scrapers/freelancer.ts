// ==============================================================================
// src/lib/scrapers/freelancer.ts
// Global Freelance Platform Scraper (Freelancer.com Public API)
// Siphons live global client projects with verified budgets at $0 API Cost
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory, estimateBudgetUsd } from './types';
import { classifyProject } from '../taxonomy';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const CATEGORY_QUERY_MAP: Record<string, string> = {
  web_mobile_dev: 'developer web mobile react flutter python node',
  web_dev: 'developer web software',
  ai_data_automation: 'ai python machine learning bot automation n8n scraping',
  ui_ux_graphic: 'UI UX design figma logo graphic website design',
  ui_ux: 'UI UX figma web design',
  design: 'UI UX design figma logo graphic',
  video_audio_motion: 'video editing motion animation premiere after effects audio',
  digital_marketing_seo: 'marketing SEO social media ads google ads facebook ads',
  marketing: 'marketing SEO social media ads',
  writing_translation: 'writing translation content copywriting articles',
  writing: 'writing translation content copywriting',
  business_accounting_legal: 'accounting financial bookkeeping tax legal business plan',
  accounting: 'accounting financial bookkeeping tax',
  sales_customer_support: 'customer support virtual assistant sales cold calling lead',
  engineering_architecture: 'architecture autocad 3d max interior engineering revit',
  it_cybersecurity_devops: 'devops docker linux aws server cybersecurity network',
  ecommerce_stores: 'shopify ecommerce woocommerce salla store dropshipping',
  education_training: 'tutor teacher education training course academic research',
  game_ar_vr: 'game unity unreal 3d blender vr ar c#',
  other: '',
};

/**
 * Fetches active projects from Freelancer.com Public API sorted by latest time_submitted.
 */
export async function scrapeFreelancerCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 25
): Promise<UnifiedProject[]> {
  const query = encodeURIComponent(CATEGORY_QUERY_MAP[categorySlug] || '');
  const queryParam = query ? `&query=${query}` : '';
  const url = `https://www.freelancer.com/api/projects/0.1/projects/active/?sort_field=time_submitted&compact=false&full_description=true&job_details=true&user_details=true&user_status=true&user_reputation=true&user_employer_reputation=true&limit=${limit}${queryParam}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      console.warn(`[Freelancer Scraper] API returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const projects = data.result?.projects || [];
    const users = data.result?.users || {};
    const results: UnifiedProject[] = [];

    for (const p of projects) {
      if (!p.title || !p.seo_url) continue;

      const projectUrl = `https://www.freelancer.com/projects/${p.seo_url}`;
      const currency = p.currency?.code || 'USD';
      const min = p.budget?.minimum || null;
      const max = p.budget?.maximum || null;
      const budgetStr = (min || max) ? `${min || 0} - ${max || 0} ${currency}` : null;
      // Extract genuine full description from official API response
      const description = p.description || p.preview_description || p.title;

      // Extract client metrics from result.users[owner_id]
      const ownerId = p.owner_id;
      const ownerUser = ownerId && users[ownerId] ? users[ownerId] : (p.owner || null);

      const hasDeposit = Boolean(ownerUser?.status?.deposit_made || ownerUser?.deposit_made);
      const isPaymentVerified = Boolean(
        ownerUser?.status?.payment_verified ||
        ownerUser?.payment_verified ||
        hasDeposit ||
        p.is_escrow_project ||
        p.is_buyer_kyc_required ||
        p.active_prepaid_milestone ||
        p.upgrades?.active_prepaid_milestone ||
        p.upgrades?.featured ||
        p.upgrades?.urgent ||
        p.upgrades?.recruiter ||
        p.upgrades?.NDA ||
        p.upgrades?.sealed
      );

      const clientRating =
        typeof ownerUser?.employer_reputation?.overall === 'number'
          ? ownerUser.employer_reputation.overall
          : typeof ownerUser?.reputation?.overall === 'number'
            ? ownerUser.reputation.overall
            : null;

      const completionRate =
        typeof ownerUser?.employer_reputation?.completion_rate === 'number'
          ? Math.round(ownerUser.employer_reputation.completion_rate * 100)
          : typeof ownerUser?.reputation?.completion_rate === 'number'
            ? Math.round(ownerUser.reputation.completion_rate * 100)
            : null;

      // Extract native category and skills array from official Freelancer API
      const primaryCategory = p.jobs?.[0]?.category?.name || null;
      const jobSkills: string[] = (p.jobs || []).map((j: any) => j.name).filter(Boolean);

      const classResult = classifyProject({
        platform: 'freelancer',
        title: p.title,
        description,
        rawCategory: primaryCategory || categorySlug,
        skills: jobSkills,
      });

      const detectedCountry =
        ownerUser?.location?.country?.name ||
        p.location?.country?.name ||
        null;

      const authorName =
        ownerUser?.username ||
        (p.upgrades?.featured
          ? 'عميل مميز (Featured)'
          : p.upgrades?.urgent
            ? 'عميل عاجل (Urgent)'
            : 'عميل دولي (Freelancer)');

      const bidsCount = typeof p.bid_stats?.bid_count === 'number' ? p.bid_stats.bid_count : null;

      results.push(
        createUnifiedProject({
          external_id: String(p.id),
          platform: 'freelancer',
          title: p.title,
          description,
          url: projectUrl,
          budget: budgetStr,
          budget_min: min,
          budget_max: max,
          currency,
          language: 'en',
          category: classResult.category,
          raw_category: primaryCategory,
          raw_skills: jobSkills.length > 0 ? jobSkills : null,
          published_at: p.submitdate ? new Date(p.submitdate * 1000).toISOString() : new Date().toISOString(),
          author: authorName,
          insights: {
            job_type: p.type === 'hourly' ? 'hourly' : p.type === 'fixed' ? 'fixed' : null,
            bids_count: bidsCount,
            // bid_avg is in the project's currency; store it in USD like budget_usd_estimate
            bids_avg: typeof p.bid_stats?.bid_avg === 'number'
              ? estimateBudgetUsd(Math.round(p.bid_stats.bid_avg), currency)
              : null,
            client_country: detectedCountry,
            client_rating: clientRating,
            client_hire_rate: completionRate,
            payment_verified: isPaymentVerified,
            details_fetched_at: new Date().toISOString(),
          },
        })
      );
    }

    console.log(`[Freelancer Scraper] Extracted ${results.length} live projects with full details for #${categorySlug}`);
    return results;
  } catch (err: any) {
    console.error(`[Freelancer Scraper] Error querying API:`, err.message);
    return [];
  }
}
