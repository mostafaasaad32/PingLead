// ==============================================================================
// src/lib/insights/price-suggestion.ts
// Instant (non-AI) bid suggestion: a price and a delivery time for a project,
// from its budget range, the platform's average bid, similar projects' budgets,
// and how crowded it already is. Pure function - no I/O.
// ==============================================================================

export interface PriceSuggestionInput {
  budgetMinUsd?: number | null;
  budgetMaxUsd?: number | null;
  bidsCount?: number | null;
  bidsAvgUsd?: number | null; // Freelancer.com exposes the real average bid
  marketMedianUsd?: number | null; // median budget of similar recent projects
  durationText?: string | null; // client's requested delivery time, e.g. "5 أيام"
}

export interface PriceSuggestion {
  priceUsd: number;
  days: number;
  reasons: string[];
}

const LOW_COMPETITION_MAX = 5;
const HIGH_COMPETITION_MIN = 16;

function roundPrice(usd: number): number {
  const step = usd < 100 ? 5 : usd < 1000 ? 10 : 50;
  return Math.max(step, Math.round(usd / step) * step);
}

/** "5 أيام" -> 5, "2 يومين" -> 2, "1 يوم" -> 1, "أسبوعين" -> 14, "شهر" -> 30 */
export function parseDurationDays(text: string | null | undefined): number | null {
  if (!text) return null;
  const digits = text.match(/\d+/);
  const n = digits ? parseInt(digits[0], 10) : null;
  if (/شهر|month/i.test(text)) return (n || 1) * 30;
  if (/أسبوع|اسبوع|week/i.test(text)) return (n || (/أسبوعين|اسبوعين/.test(text) ? 2 : 1)) * 7;
  if (n) return n;
  if (/يومين/.test(text)) return 2;
  if (/يوم|day/i.test(text)) return 1;
  return null;
}

function estimateDays(priceUsd: number): number {
  if (priceUsd <= 50) return 2;
  if (priceUsd <= 150) return 4;
  if (priceUsd <= 400) return 7;
  if (priceUsd <= 1000) return 14;
  return 21;
}

export function suggestPrice(input: PriceSuggestionInput): PriceSuggestion | null {
  const reasons: string[] = [];
  let min = input.budgetMinUsd && input.budgetMinUsd > 0 ? input.budgetMinUsd : null;
  let max = input.budgetMaxUsd && input.budgetMaxUsd > 0 ? input.budgetMaxUsd : null;
  if (min && max && min > max) [min, max] = [max, min];

  // 1. Anchor
  let anchor: number | null = null;
  if (input.bidsAvgUsd && input.bidsAvgUsd > 0) {
    anchor = input.bidsAvgUsd;
    reasons.push(`متوسط العروض المقدمة ${Math.round(input.bidsAvgUsd)}$`);
  } else if (min && max) {
    anchor = (min + max) / 2;
    if (input.marketMedianUsd && input.marketMedianUsd >= min && input.marketMedianUsd <= max) {
      anchor = (anchor + input.marketMedianUsd) / 2;
      reasons.push(`متوسط مشاريع مشابهة ${Math.round(input.marketMedianUsd)}$`);
    } else {
      reasons.push('منتصف ميزانية العميل');
    }
  } else if (max || min) {
    anchor = (max || min)!;
    reasons.push('حسب ميزانية العميل');
  } else if (input.marketMedianUsd) {
    anchor = input.marketMedianUsd;
    reasons.push(`متوسط مشاريع مشابهة ${Math.round(input.marketMedianUsd)}$`);
  }

  if (!anchor) return null;

  // 2. Competition: crowded projects reward a slightly lower bid, quiet ones a higher one
  const bids = input.bidsCount;
  if (typeof bids === 'number') {
    if (bids <= LOW_COMPETITION_MAX) {
      anchor *= 1.1;
      reasons.push('عروض قليلة، تقدر تطلب أعلى شوية');
    } else if (bids >= HIGH_COMPETITION_MIN) {
      anchor *= 0.9;
      reasons.push(`عروض كتير (${bids})، قدّم أقل شوية`);
    }
  }

  // 3. Stay inside the client's range when there is one
  if (min && anchor < min) anchor = min;
  if (max && anchor > max) anchor = max;

  const priceUsd = roundPrice(anchor);

  // 4. Delivery time: the client's requested time if the platform shows it
  const requestedDays = parseDurationDays(input.durationText);
  const days = requestedDays || estimateDays(priceUsd);
  if (requestedDays) reasons.push(`المدة اللي طلبها العميل`);

  return { priceUsd, days, reasons };
}

export function formatDaysAr(days: number): string {
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومين';
  if (days <= 10) return `${days} أيام`;
  return `${days} يوم`;
}
