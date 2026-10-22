// ==============================================================================
// src/lib/insights/pricing.ts
// One place that turns a project's budget into what users see:
//   - the budget converted to EGP ("≈ 1,250 - 2,500 ج.م")
//   - an instant suggested bid (price + delivery time) with short reasons
// Server-side only (reads exchange rates and market stats).
// ==============================================================================

import { getRates, convert, formatBudgetInEgp, formatEgp, type RatesSnapshot } from '@/lib/currency/rates';
import { getMarketMedianUsd } from '@/lib/insights/market-stats';
import { suggestPrice, formatDaysAr } from '@/lib/insights/price-suggestion';
import { isJobBoard } from '@/lib/scrapers/types';

export interface PricingInput {
  platform: string;
  category?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string | null;
  bids_count?: number | null;
  bids_avg?: number | null; // already USD
  duration_text?: string | null;
}

export interface ProjectPricing {
  budgetEgpText: string | null; // "≈ 1,250 - 2,500 ج.م"
  suggestion: {
    priceUsd: number;
    priceEgpText: string | null; // "≈ 2,150 ج.م"
    days: number;
    daysText: string; // "3 أيام"
    reasons: string[];
  } | null;
}

export async function getProjectPricing(
  p: PricingInput,
  snapshot?: RatesSnapshot
): Promise<ProjectPricing> {
  const rates = snapshot || (await getRates());

  const minUsd = convert(p.budget_min, p.currency, 'USD', rates);
  const maxUsd = convert(p.budget_max, p.currency, 'USD', rates);
  const marketMedianUsd = p.category ? await getMarketMedianUsd(p.platform, p.category) : null;

  // Job boards list salaried roles (often yearly salaries): a project price/timeline makes no sense
  const s = isJobBoard(p.platform) ? null : suggestPrice({
    budgetMinUsd: minUsd,
    budgetMaxUsd: maxUsd,
    bidsCount: p.bids_count,
    bidsAvgUsd: p.bids_avg,
    marketMedianUsd,
    durationText: p.duration_text,
  });

  const priceEgp = s ? convert(s.priceUsd, 'USD', 'EGP', rates) : null;

  return {
    budgetEgpText: formatBudgetInEgp(p.budget_min, p.budget_max, p.currency, rates),
    suggestion: s
      ? {
          priceUsd: s.priceUsd,
          priceEgpText: priceEgp ? `≈ ${formatEgp(priceEgp)} ج.م` : null,
          days: s.days,
          daysText: formatDaysAr(s.days),
          reasons: s.reasons,
        }
      : null,
  };
}

/**
 * Guidance block for the AI proposal prompt: the market baseline, which the model
 * adjusts after reading the actual scope.
 */
export function pricingPromptHint(pricing: ProjectPricing): string | undefined {
  if (!pricing.suggestion) return undefined;
  const s = pricing.suggestion;
  return (
    `Market baseline for this project: about $${s.priceUsd}${s.priceEgpText ? ` (${s.priceEgpText})` : ''} ` +
    `delivered in ${s.days} days (${s.reasons.join('; ')}). ` +
    `Read the requirements and adjust this price and timeline up or down if the real scope is bigger or smaller, ` +
    `then state your price and delivery time clearly in the proposal. ` +
    `If the work splits naturally into stages, propose 2-3 milestones with a price for each.`
  );
}
