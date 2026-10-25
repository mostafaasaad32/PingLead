// ==============================================================================
// src/lib/filters/categorizer.ts
// Comprehensive Smart Categorizer & Budget Extractor (14 Full Domains)
// Powered by the 3-Layer Source-Aware Master Freelancer Taxonomy
// ==============================================================================

import { CategoryType, ProjectCategory, estimateBudgetUsd } from '../scrapers/types';
import { classifyProject } from '../taxonomy/classifier';

export * from '../taxonomy';

/**
 * Classifies project text into one of the 14 comprehensive domains
 * using the 3-Layer Master Freelancer Taxonomy.
 */
export function categorizeProject(
  titleAndDesc: string,
  platformCategoryHint?: string
): CategoryType {
  const result = classifyProject({
    platform: 'unknown',
    title: titleAndDesc || '',
    description: '',
    rawCategory: platformCategoryHint || null,
  });
  return result.category;
}

// Backward compatibility alias for classifyProjectCategory
export function classifyProjectCategory(
  titleAndDesc: string,
  platformCategoryHint?: string
): ProjectCategory {
  return categorizeProject(titleAndDesc, platformCategoryHint);
}

/**
 * Checks if a project category matches a target category filter,
 * seamlessly bridging between the 14 comprehensive domains and legacy slugs.
 */
export function isCategoryMatch(
  projectCategory?: string | null,
  filterCategory?: string | null
): boolean {
  if (!filterCategory || filterCategory === 'all') return true;
  if (!projectCategory) return false;
  if (projectCategory === filterCategory) return true;

  const aliases: Record<string, string[]> = {
    web_mobile_dev: ['web_mobile_dev', 'web_dev'],
    web_dev: ['web_mobile_dev', 'web_dev'],
    ui_ux_graphic: ['ui_ux_graphic', 'ui_ux', 'design'],
    ui_ux: ['ui_ux_graphic', 'ui_ux', 'design'],
    design: ['ui_ux_graphic', 'ui_ux', 'design'],
    digital_marketing_seo: ['digital_marketing_seo', 'marketing'],
    marketing: ['digital_marketing_seo', 'marketing'],
    business_accounting_legal: ['business_accounting_legal', 'accounting', 'business'],
    accounting: ['business_accounting_legal', 'accounting', 'business'],
    business: ['business_accounting_legal', 'accounting', 'business'],
    writing_translation: ['writing_translation', 'writing'],
    writing: ['writing_translation', 'writing'],
    sales_customer_support: ['sales_customer_support', 'support'],
    support: ['sales_customer_support', 'support'],
    ecommerce_stores: ['ecommerce_stores'],
    ai_data_automation: ['ai_data_automation'],
    video_audio_motion: ['video_audio_motion'],
    engineering_architecture: ['engineering_architecture'],
    it_cybersecurity_devops: ['it_cybersecurity_devops'],
    education_training: ['education_training'],
    game_ar_vr: ['game_ar_vr'],
    other: ['other'],
  };

  const valid = aliases[filterCategory] || [filterCategory];
  return valid.includes(projectCategory);
}

// ==============================================================================
// Budget Extractor with Multi-Currency Normalization
// ==============================================================================
export interface ExtractedBudget {
  budget_min: number | null;
  budget_max: number | null;
  currency: string | null;
  budget_text: string | null;
  budget_min_usd: number | null;
  budget_max_usd: number | null;
  budget_usd_estimate: number | null;
}

/**
 * Extracts clean numeric budget bounds and converts to estimated USD values
 */
export function extractBudget(text: string): ExtractedBudget {
  if (!text) {
    return {
      budget_min: null,
      budget_max: null,
      currency: null,
      budget_text: null,
      budget_min_usd: null,
      budget_max_usd: null,
      budget_usd_estimate: null,
    };
  }

  // Detect currency
  let currency: string | null = null;
  if (/ريال|SAR|رس/i.test(text)) currency = 'SAR';
  else if (/جنيه|EGP|ج\.م/i.test(text)) currency = 'EGP';
  else if (/درهم|AED|د\.إ/i.test(text)) currency = 'AED';
  else if (/€|EUR|يورو/i.test(text)) currency = 'EUR';
  else if (/£|GBP|استرليني/i.test(text)) currency = 'GBP';
  else if (/CAD|دولار كندي/i.test(text)) currency = 'CAD';
  else if (/KWD|دينار كويتي/i.test(text)) currency = 'KWD';
  else if (/QAR|ريال قطري/i.test(text)) currency = 'QAR';
  else if (/INR|روبية/i.test(text)) currency = 'INR';
  else if (/\$|USD|دولار/i.test(text)) currency = 'USD';

  // Pattern 1: Range like "$100 - $250" or "100 - 250 USD" or "100 إلى 250"
  const rangeMatch = text.match(
    /[$€£]?\s*(\d{1,7})\s*(?:-|–|إلى|to)\s*[$€£]?\s*(\d{1,7})\s*([a-zA-Z$€£ريالجنيهدرهم]+)?/i
  );
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    const detectedCurr = currency || (rangeMatch[3] ? rangeMatch[3].trim() : 'USD');
    const bestAmount = max || min;

    const minUsd = estimateBudgetUsd(min, detectedCurr);
    const maxUsd = estimateBudgetUsd(max, detectedCurr);
    const estimateUsd = estimateBudgetUsd(bestAmount, detectedCurr);

    return {
      budget_min: min,
      budget_max: max,
      currency: detectedCurr,
      budget_text: `${min} - ${max} ${detectedCurr}`,
      budget_min_usd: minUsd,
      budget_max_usd: maxUsd,
      budget_usd_estimate: estimateUsd,
    };
  }

  // Pattern 2: Single budget amount like "الميزانية: $150" or "مقابل 500 ريال" or "Rate: $45/hr"
  const singleMatch = text.match(
    /(?:ميزانية|الميزانية|budget|مقابل|بسعر|salary|rate)\s*[:=]?\s*[$€£]?\s*(\d{1,7})\s*([a-zA-Z$€£ريالجنيهدرهم]+)?/i
  );
  if (singleMatch) {
    const amount = parseInt(singleMatch[1], 10);
    const detectedCurr = currency || (singleMatch[2] ? singleMatch[2].trim() : 'USD');
    const usd = estimateBudgetUsd(amount, detectedCurr);

    return {
      budget_min: amount,
      budget_max: amount,
      currency: detectedCurr,
      budget_text: `${amount} ${detectedCurr}`,
      budget_min_usd: usd,
      budget_max_usd: usd,
      budget_usd_estimate: usd,
    };
  }

  return {
    budget_min: null,
    budget_max: null,
    currency,
    budget_text: null,
    budget_min_usd: null,
    budget_max_usd: null,
    budget_usd_estimate: null,
  };
}

// Backward compatibility alias for extractCleanBudget
export function extractCleanBudget(text: string): ExtractedBudget {
  return extractBudget(text);
}
