// ==============================================================================
// src/lib/taxonomy/domain-lock.ts
// Layer 2: Domain-Locked Sub-Routing Engine
// ==============================================================================

import { CategoryType } from '../scrapers/types';
import { DomainFamily, DOMAIN_ALLOWED_CATEGORIES } from './types';
import { CATEGORY_RULES } from './rules';

export interface ScoredCategory {
  category: CategoryType;
  score: number;
  matchedRules: string[];
}

/**
 * Default fallback category for each domain family when sub-specialty signals are zero.
 */
const DOMAIN_DEFAULTS: Record<DomainFamily, CategoryType> = {
  development: 'web_mobile_dev',
  design_media: 'ui_ux_graphic',
  marketing_sales: 'digital_marketing_seo',
  writing_translation: 'writing_translation',
  business_finance_admin: 'business_accounting_legal',
  engineering_cad: 'engineering_architecture',
  education_academic: 'education_training',
};

/**
 * Classifies a project within a locked domain umbrella.
 * It is strictly forbidden from selecting any category outside DOMAIN_ALLOWED_CATEGORIES[domain].
 */
export function classifyWithinLockedDomain(params: {
  domain: DomainFamily;
  title: string;
  description?: string | null;
  skills?: string[] | null;
}): { category: CategoryType; confidence: number; matchedRule: string } {
  const { domain, title, description = '', skills = [] } = params;
  const allowedCategories = DOMAIN_ALLOWED_CATEGORIES[domain];

  // If the domain has only 1 allowed category (e.g. writing_translation), return immediately
  if (allowedCategories.length === 1) {
    return {
      category: allowedCategories[0],
      confidence: 0.98,
      matchedRule: `domain_lock_single:${domain}`,
    };
  }

  const scores: ScoredCategory[] = [];
  const cleanTitle = (title || '').trim();
  const cleanDesc = (description || '').trim();
  const cleanSkills = (skills || []).filter(Boolean);

  for (const cat of allowedCategories) {
    const rules = CATEGORY_RULES[cat];
    let score = 0;
    const matches: string[] = [];

    // 1. Official Skills Array Matching (Weight: 10x per match)
    if (cleanSkills.length > 0) {
      for (const skill of cleanSkills) {
        for (const kw of rules.keywords) {
          if (kw.test(skill)) {
            score += 10;
            matches.push(`skill:${skill}`);
            break;
          }
        }
      }
    }

    // 2. Title Intent & Role Matching (Weight: 15x)
    for (const rolePat of rules.intentRoles) {
      if (rolePat.test(cleanTitle)) {
        score += 15;
        matches.push(`title_intent:${rolePat.source}`);
        break;
      }
    }

    // 3. Title Keywords Matching (Weight: 5x)
    for (const kw of rules.keywords) {
      if (kw.test(cleanTitle)) {
        score += 5;
        matches.push(`title_kw:${kw.source}`);
      }
    }

    // 4. Description Keywords Matching (Weight: 1x, capped at 3x)
    let descPoints = 0;
    for (const kw of rules.keywords) {
      if (kw.test(cleanDesc)) {
        descPoints += 1;
        matches.push(`desc_kw:${kw.source}`);
        if (descPoints >= 3) break;
      }
    }
    score += descPoints;

    // 5. Negative Keywords Penalty (-15x)
    if (rules.negativeKeywords) {
      for (const neg of rules.negativeKeywords) {
        if (neg.test(cleanTitle) || neg.test(cleanDesc.slice(0, 150))) {
          score -= 15;
          matches.push(`negative_penalized:${neg.source}`);
          break;
        }
      }
    }

    scores.push({ category: cat, score, matchedRules: matches });
  }

  // Sort by highest score descending
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  if (best && best.score > 0) {
    return {
      category: best.category,
      confidence: Math.min(0.95, 0.7 + best.score * 0.03),
      matchedRule: `domain_lock:${domain}:${best.matchedRules.slice(0, 2).join('|')}`,
    };
  }

  // Fallback to domain default
  const defaultCat = DOMAIN_DEFAULTS[domain];
  return {
    category: defaultCat,
    confidence: 0.75,
    matchedRule: `domain_lock_default:${domain}`,
  };
}
