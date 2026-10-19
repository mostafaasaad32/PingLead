// ==============================================================================
// src/lib/matching/filter-matcher.ts
// Vollna-Style Smart Filtering & Multi-Platform Match Engine
// High-performance, in-memory matching with Arabic normalization and negative keyword rejection.
// ==============================================================================

import { UnifiedProject, UserFilter, ProjectCategory, FreelancePlatform, isJobBoard } from '../scrapers/types';
import { isCategoryMatch } from '../filters/categorizer';
import { countryCodeFor } from '../filters/countries';

// Arab marketplaces only post fixed-price projects
const FIXED_PRICE_PLATFORMS: string[] = ['mostaql', 'nafezly', 'khamsat', 'kafiil'];

export interface FilterMatchResult {
  matched: boolean;
  filterId: string;
  filterName: string;
  userId: string;
  reasons: string[];
  matchedKeywords: string[];
  excludedByKeyword?: string;
}

/**
 * Normalizes text for resilient Arabic and multilingual keyword matching:
 * - Unifies Alef variants (أ, إ, آ, ٱ -> ا)
 * - Unifies Taa Marbuta (ة -> ه)
 * - Unifies Yaa / Alef Maqsura (ى -> ي)
 * - Removes Arabic Tashkeel / Harakat (diacritics)
 * - Case-insensitive lowercase
 * - Normalizes underscores and excessive whitespace
 */
export function normalizeText(text?: string | null): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic diacritics/tashkeel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[_\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Evaluates whether a keyword is present in content with full Arabic and case-insensitive normalization.
 * For very short keywords (<= 3 chars, e.g. "ai", "ui", "go", "php"), uses word boundaries.
 */
export function matchesKeyword(content: string, rawKeyword: string): boolean {
  const normContent = normalizeText(content);
  const normKw = normalizeText(rawKeyword);
  if (!normContent || !normKw) return false;

  // Short Latin words require word boundaries to avoid false positives (e.g. "ai" matching "email")
  if (normKw.length <= 3 && /^[a-z0-9+#]+$/.test(normKw)) {
    const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRegex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    return boundaryRegex.test(normContent);
  }

  return normContent.includes(normKw);
}

/**
 * Evaluates a single project against a specific UserFilter rule.
 */
export function evaluateProjectAgainstFilter(
  project: UnifiedProject,
  filter: UserFilter
): FilterMatchResult {
  const baseResult: FilterMatchResult = {
    matched: false,
    filterId: filter.id,
    filterName: filter.filter_name,
    userId: filter.user_id,
    reasons: [],
    matchedKeywords: [],
  };

  // 1. If filter is disabled, skip immediately
  if (!filter.is_active) {
    baseResult.reasons.push('Filter is inactive');
    return baseResult;
  }

  // 2. Platform match. Empty array = every freelance platform; remote job boards
  //    (full-time roles) only match when the user explicitly selects them.
  if (!filter.platforms || filter.platforms.length === 0) {
    if (isJobBoard(project.platform)) {
      baseResult.reasons.push(`Job board ${project.platform} not selected`);
      return baseResult;
    }
  } else {
    const platformMatch = filter.platforms.some(
      (p) => p.toLowerCase() === project.platform.toLowerCase()
    );
    if (!platformMatch) {
      baseResult.reasons.push(`Platform ${project.platform} not in filter platforms`);
      return baseResult;
    }
  }

  // 3. Category match (Empty categories array means ALL categories are accepted)
  if (filter.categories && filter.categories.length > 0) {
    const catMatch = filter.categories.some((c) =>
      isCategoryMatch(project.category, c)
    );
    if (!catMatch) {
      baseResult.reasons.push(`Category ${project.category} not in filter categories`);
      return baseResult;
    }
  }

  // 4. Budget match (min_budget_usd)
  if (filter.min_budget_usd && filter.min_budget_usd > 0) {
    const est = project.budget_usd_estimate || 0;
    const maxVal = project.budget_max || 0;
    const minVal = project.budget_min || 0;
    const highestRecordedBudget = Math.max(est, maxVal, minVal);

    // If project specifies a budget and it is below the filter threshold
    if (highestRecordedBudget > 0 && highestRecordedBudget < filter.min_budget_usd) {
      baseResult.reasons.push(
        `Budget ($${highestRecordedBudget} USD) is below filter minimum ($${filter.min_budget_usd} USD)`
      );
      return baseResult;
    }
  }

  // 4b. Competition & client quality (migration 0012). A value the platform doesn't
  //     expose never rejects a project; only known values are compared.
  if (filter.max_bids && filter.max_bids > 0 && typeof project.bids_count === 'number' && project.bids_count > filter.max_bids) {
    baseResult.reasons.push(`Too many bids (${project.bids_count} > ${filter.max_bids})`);
    return baseResult;
  }
  if (
    filter.min_client_hire_rate &&
    filter.min_client_hire_rate > 0 &&
    typeof project.client_hire_rate === 'number' &&
    project.client_hire_rate < filter.min_client_hire_rate
  ) {
    baseResult.reasons.push(`Client hire rate ${project.client_hire_rate}% < ${filter.min_client_hire_rate}%`);
    return baseResult;
  }
  // Mostaql pages were read and show no hire rate = this client has never hired anyone
  if (filter.exclude_new_clients && project.details_fetched_at && project.client_hire_rate == null) {
    baseResult.reasons.push('Client has never hired');
    return baseResult;
  }
  if (filter.job_type && filter.job_type !== 'any') {
    const jobType = project.job_type ?? (FIXED_PRICE_PLATFORMS.includes(project.platform) ? 'fixed' : null);
    if (jobType && jobType !== filter.job_type) {
      baseResult.reasons.push(`Job type ${jobType} is not ${filter.job_type}`);
      return baseResult;
    }
  }
  if (filter.client_countries && filter.client_countries.length > 0) {
    const code = countryCodeFor(project.client_country);
    if (code && !filter.client_countries.includes(code)) {
      baseResult.reasons.push(`Client country ${project.client_country} not in filter`);
      return baseResult;
    }
  }

  // Prepare normalized project content for keyword testing
  const searchableText = `${project.title || ''} ${project.description || ''}`;
  const normalizedContent = normalizeText(searchableText);

  // 5. Exclude keywords check (Negative Filter: Instant disqualification)
  if (filter.exclude_keywords && filter.exclude_keywords.length > 0) {
    for (const rawExcludeKw of filter.exclude_keywords) {
      if (matchesKeyword(normalizedContent, rawExcludeKw)) {
        baseResult.reasons.push(`Excluded by negative keyword: "${rawExcludeKw}"`);
        baseResult.excludedByKeyword = rawExcludeKw;
        return baseResult;
      }
    }
  }

  // 6. Include keywords check (Positive Filter)
  if (filter.include_keywords && filter.include_keywords.length > 0) {
    const matchedKws: string[] = [];
    for (const rawIncludeKw of filter.include_keywords) {
      if (matchesKeyword(normalizedContent, rawIncludeKw)) {
        matchedKws.push(rawIncludeKw);
      }
    }

    if (matchedKws.length === 0) {
      baseResult.reasons.push('None of the required include_keywords matched');
      return baseResult;
    }

    baseResult.matchedKeywords = matchedKws;
  }

  // All checks passed!
  baseResult.matched = true;
  baseResult.reasons.push('All filter constraints satisfied');
  return baseResult;
}

/**
 * Matches a candidate project against all active user filters.
 * Returns an array of all filters that matched the project.
 */
export function matchProjectAgainstUserFilters(
  project: UnifiedProject,
  filters: UserFilter[]
): UserFilter[] {
  const matchingFilters: UserFilter[] = [];

  for (const filter of filters) {
    const evaluation = evaluateProjectAgainstFilter(project, filter);
    if (evaluation.matched) {
      matchingFilters.push(filter);
    }
  }

  return matchingFilters;
}

/**
 * In-memory batch matching of newly ingested projects against active filters.
 * Returns a map of project external_id to matching filters and user actions to queue.
 */
export function batchMatchProjects(
  projects: UnifiedProject[],
  filters: UserFilter[]
): Map<string, { project: UnifiedProject; matches: FilterMatchResult[] }> {
  const matchMap = new Map<string, { project: UnifiedProject; matches: FilterMatchResult[] }>();

  // Only consider active filters
  const activeFilters = filters.filter((f) => f.is_active);
  if (activeFilters.length === 0 || projects.length === 0) {
    return matchMap;
  }

  for (const project of projects) {
    const projectMatches: FilterMatchResult[] = [];

    for (const filter of activeFilters) {
      const evaluation = evaluateProjectAgainstFilter(project, filter);
      if (evaluation.matched) {
        projectMatches.push(evaluation);
      }
    }

    if (projectMatches.length > 0) {
      matchMap.set(`${project.platform}_${project.external_id}`, {
        project,
        matches: projectMatches,
      });
    }
  }

  return matchMap;
}
