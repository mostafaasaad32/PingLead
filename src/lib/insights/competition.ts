// ==============================================================================
// src/lib/insights/competition.ts
// Turns raw platform signals (bid count, client hire rate, ...) into the short
// verdicts shown on Telegram alerts and dashboard cards.
// ==============================================================================

import type { ProjectInsights } from '@/lib/scrapers/types';

export type CompetitionLevel = 'low' | 'medium' | 'high' | 'unknown';
export type ClientLevel = 'good' | 'medium' | 'low' | 'new' | 'unknown';

export interface CompetitionVerdict {
  level: CompetitionLevel;
  bids: number | null;
  label: string; // e.g. "3 عروض"
  advice: string; // e.g. "منافسة قليلة، قدّم الآن"
  emoji: string;
}

export interface ClientVerdict {
  level: ClientLevel;
  label: string; // e.g. "معدل توظيف 80%"; empty when nothing is known
  details: string[]; // extra facts, e.g. "3 مشاريع مفتوحة"
  emoji: string;
}

const LOW_COMPETITION_MAX = 5;
const MEDIUM_COMPETITION_MAX = 15;

/** Arabic plural for bids: عرض واحد / عرضان / 3 عروض / 11 عرض */
export function formatBidsAr(count: number): string {
  if (count === 0) return 'لا توجد عروض بعد';
  if (count === 1) return 'عرض واحد';
  if (count === 2) return 'عرضان';
  if (count <= 10) return `${count} عروض`;
  return `${count} عرض`;
}

export function getCompetitionVerdict(p: ProjectInsights): CompetitionVerdict {
  const bids = typeof p.bids_count === 'number' ? p.bids_count : null;

  if (bids === null) {
    return { level: 'unknown', bids: null, label: 'غير متاح', advice: '', emoji: '⚪' };
  }

  const label = formatBidsAr(bids);
  if (bids <= LOW_COMPETITION_MAX) {
    return { level: 'low', bids, label, advice: 'منافسة قليلة، قدّم الآن', emoji: '🟢' };
  }
  if (bids <= MEDIUM_COMPETITION_MAX) {
    return { level: 'medium', bids, label, advice: 'منافسة متوسطة', emoji: '🟡' };
  }
  return { level: 'high', bids, label, advice: 'منافسة عالية، ميّز عرضك', emoji: '🔴' };
}

export function getClientVerdict(p: ProjectInsights): ClientVerdict {
  const details: string[] = [];

  if (typeof p.client_open_projects === 'number' && p.client_open_projects > 1) {
    details.push(`${p.client_open_projects} مشاريع مفتوحة`);
  }
  if (typeof p.client_in_progress === 'number' && p.client_in_progress > 0) {
    details.push(`${p.client_in_progress} قيد التنفيذ`);
  }
  if (p.client_registered_at) details.push(`مسجل منذ ${p.client_registered_at}`);
  if (p.client_country) details.push(p.client_country);

  const rate = typeof p.client_hire_rate === 'number' ? p.client_hire_rate : null;

  if (rate === null) {
    // Mostaql pages were read but the platform hasn't computed a rate yet => no hires so far
    if (p.details_fetched_at) {
      return { level: 'new', label: 'لم يوظّف أحداً بعد', details, emoji: '🆕' };
    }
    return { level: 'unknown', label: '', details, emoji: '👤' };
  }

  const label = `معدل توظيف ${Math.round(rate)}%`;
  if (rate >= 60) return { level: 'good', label, details, emoji: '⭐' };
  if (rate >= 30) return { level: 'medium', label, details, emoji: '👤' };
  return { level: 'low', label, details, emoji: '⚠️' };
}
