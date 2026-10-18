// ==============================================================================
// src/lib/filters/negative-regex.ts - OBSOLETE (MVP Focus: 100% Freelance Platforms)
// All posts come directly from verified freelance platforms (Mostaql, Nafezly, Khamsat,
// Kafiil, Baeed, Freelancer, RemoteOK, PPH, WWR) where 100% are client projects.
// ==============================================================================

import { UnifiedLead } from '../scrapers/types';

export interface PreFilterResult {
  passed: boolean;
  reason?: string;
}

export function passesPreFilter(text: string): PreFilterResult {
  const clean = (text || '').trim();
  if (clean.length < 8) {
    return { passed: false, reason: 'invalid_length' };
  }
  return { passed: true };
}

export function filterLeadBySourceType(lead: UnifiedLead): PreFilterResult & { isMarketplace: boolean } {
  const textLength = (lead.title || '').trim().length + (lead.description || '').trim().length;
  if (textLength < 8) {
    return { passed: false, reason: 'invalid_length', isMarketplace: true };
  }
  return { passed: true, isMarketplace: true };
}
