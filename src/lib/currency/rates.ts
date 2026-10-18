// ==============================================================================
// src/lib/currency/rates.ts
// Daily exchange rates (base USD) from open.er-api.com, cached in memory.
// Falls back to USD_EGP_FALLBACK_RATE (or 50) for EGP when the API is unreachable.
// Server-side only.
// ==============================================================================

const RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_MS = 12 * 60 * 60 * 1000; // the API updates once a day
const RETRY_AFTER_FAILURE_MS = 10 * 60 * 1000;

// Currency labels scraped from Arabic platforms -> ISO codes
const CURRENCY_ALIASES: Record<string, string> = {
  '$': 'USD',
  'دولار': 'USD',
  'ريال': 'SAR',
  'رس': 'SAR',
  'درهم': 'AED',
  'د.إ': 'AED',
  'جنيه': 'EGP',
  'ج.م': 'EGP',
  'يورو': 'EUR',
  '€': 'EUR',
  '£': 'GBP',
  'استرليني': 'GBP',
};

export interface RatesSnapshot {
  rates: Record<string, number>; // units of currency per 1 USD
  updatedAt: string;
  source: 'live' | 'fallback';
}

let cached: RatesSnapshot | null = null;
let cachedAt = 0;
let lastFailureAt = 0;

function fallbackSnapshot(): RatesSnapshot {
  const egp = Number(process.env.USD_EGP_FALLBACK_RATE) || 50;
  return { rates: { USD: 1, EGP: egp }, updatedAt: new Date().toISOString(), source: 'fallback' };
}

export async function getRates(): Promise<RatesSnapshot> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) return cached;
  if (now - lastFailureAt < RETRY_AFTER_FAILURE_MS) return cached || fallbackSnapshot();

  try {
    const res = await fetch(RATES_URL, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    if (data.result !== 'success' || !data.rates?.EGP) throw new Error('unexpected response');
    cached = {
      rates: data.rates,
      updatedAt: data.time_last_update_utc || new Date().toISOString(),
      source: 'live',
    };
    cachedAt = now;
    return cached;
  } catch (err: any) {
    lastFailureAt = now;
    console.warn('[Currency] Exchange rates unavailable, using fallback:', err.message);
    return cached || fallbackSnapshot();
  }
}

export function normalizeCurrency(currency: string | null | undefined): string {
  const raw = (currency || 'USD').trim();
  return CURRENCY_ALIASES[raw] || raw.toUpperCase();
}

/** Converts an amount between currencies; null when either currency is unknown. */
export function convert(
  amount: number | null | undefined,
  from: string | null | undefined,
  to: string,
  snapshot: RatesSnapshot
): number | null {
  if (amount == null || isNaN(amount)) return null;
  const fromCode = normalizeCurrency(from);
  const toCode = normalizeCurrency(to);
  if (fromCode === toCode) return amount;
  const fromRate = snapshot.rates[fromCode];
  const toRate = snapshot.rates[toCode];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

/** "1,250" style grouping with Western digits, rounded to a sensible step. */
export function formatEgp(amount: number): string {
  const step = amount >= 10000 ? 100 : amount >= 1000 ? 50 : 10;
  return (Math.round(amount / step) * step).toLocaleString('en-US');
}

/**
 * "≈ 1,250 - 2,500 ج.م" for a budget range in any currency; null if the budget is already
 * in EGP or can't be converted.
 */
export function formatBudgetInEgp(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  snapshot: RatesSnapshot
): string | null {
  if (normalizeCurrency(currency) === 'EGP') return null;
  const lo = convert(min || null, currency, 'EGP', snapshot);
  const hi = convert(max || null, currency, 'EGP', snapshot);
  if (lo && hi && Math.round(lo) !== Math.round(hi)) return `≈ ${formatEgp(lo)} - ${formatEgp(hi)} ج.م`;
  const single = hi || lo;
  return single ? `≈ ${formatEgp(single)} ج.م` : null;
}
