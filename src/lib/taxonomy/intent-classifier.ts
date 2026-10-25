// ==============================================================================
// src/lib/taxonomy/intent-classifier.ts
// Layer 3: Intent-First Classifier for Platforms Without Categories (Khamsat, etc.)
// ==============================================================================

import { CategoryType } from '../scrapers/types';
import { CATEGORY_RULES, CategoryRule } from './rules';

const ALL_CATEGORY_KEYS: CategoryType[] = [
  'web_mobile_dev',
  'ecommerce_stores',
  'ai_data_automation',
  'ui_ux_graphic',
  'video_audio_motion',
  'digital_marketing_seo',
  'writing_translation',
  'business_accounting_legal',
  'sales_customer_support',
  'engineering_architecture',
  'it_cybersecurity_devops',
  'education_training',
  'game_ar_vr',
];

export interface IntentClassificationResult {
  category: CategoryType;
  confidence: number;
  matchedRule: string;
}

/**
 * High-precision intent classifier for text-only requests (e.g. Khamsat community requests).
 * Focuses on action verbs and requested roles in the title and first 100 characters.
 */
export function classifyByIntent(params: {
  title: string;
  description?: string | null;
  skills?: string[] | null;
}): IntentClassificationResult {
  const { title = '', description = '', skills = [] } = params;
  const cleanTitle = title.trim();
  const titleAndStart = `${cleanTitle} ${(description || '').slice(0, 120)}`.trim();
  const cleanDesc = (description || '').trim();
  const cleanSkills = (skills || []).filter(Boolean);

  let bestCat: CategoryType = 'other';
  let bestScore = 0;
  let bestMatches: string[] = [];

  for (const cat of ALL_CATEGORY_KEYS) {
    const rules = CATEGORY_RULES[cat];
    let score = 0;
    const matches: string[] = [];

    // 1. Direct Intent & Role in Title & First 120 Chars (Weight: 25x)
    for (const rolePat of rules.intentRoles) {
      if (rolePat.test(titleAndStart)) {
        score += 25;
        matches.push(`role_intent:${rolePat.source}`);
        break;
      }
    }

    // 2. Official Skills tags (Weight: 10x per match)
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

    // 3. Title Keywords (Weight: 6x per match)
    for (const kw of rules.keywords) {
      if (kw.test(cleanTitle)) {
        score += 6;
        matches.push(`title_kw:${kw.source}`);
      }
    }

    // 4. Description Keywords (Weight: 1x, capped at 3x)
    let descPoints = 0;
    for (const kw of rules.keywords) {
      if (kw.test(cleanDesc)) {
        descPoints += 1;
        matches.push(`desc_kw:${kw.source}`);
        if (descPoints >= 3) break;
      }
    }
    score += descPoints;

    // 5. Negative Keywords Penalty (-30x)
    if (rules.negativeKeywords) {
      for (const neg of rules.negativeKeywords) {
        if (neg.test(cleanTitle) || neg.test(cleanDesc.slice(0, 200))) {
          score -= 30;
          matches.push(`neg_penalty:${neg.source}`);
          break;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCat = cat;
      bestMatches = matches;
    }
  }

  // Threshold: at least 5 points required to assign a category
  if (bestScore >= 5) {
    return {
      category: bestCat,
      confidence: Math.min(0.95, 0.6 + bestScore * 0.02),
      matchedRule: `intent:${bestMatches.slice(0, 2).join('|')}`,
    };
  }

  return {
    category: 'other',
    confidence: 0.3,
    matchedRule: 'intent_no_match',
  };
}
