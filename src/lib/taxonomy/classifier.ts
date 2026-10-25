// ==============================================================================
// src/lib/taxonomy/classifier.ts
// 3-Layer Source-Aware Classification Engine for PingLead
// ==============================================================================

import { CategoryType, ProjectCategory } from '../scrapers/types';
import { ClassificationInput, ClassificationResult } from './types';
import { resolveDirectNative, detectDomainFamily } from './mappings';
import { classifyWithinLockedDomain } from './domain-lock';
import { classifyByIntent } from './intent-classifier';

/**
 * Master 3-Layer Classification Pipeline:
 *
 * 1. Layer 1 (Direct Native Mapping):
 *    If the platform's raw category or subcategory has an unambiguous 1:1 match
 *    (e.g. video design, translation, engineering & architecture), resolve immediately
 *    with 100% confidence.
 *
 * 2. Layer 2 (Domain-Locked Sub-Routing):
 *    If the platform category is a broad umbrella (e.g. "برمجة وتطوير", "Websites, IT & Software",
 *    "Design & Media"), lock resolution STRICTLY inside this family. It is strictly forbidden
 *    for a marketing project to leak into dev, or dev to leak into translation.
 *    Inside the locked family: Skills (10x) > Title (5x-15x) > Description (1x).
 *
 * 3. Layer 3 (Intent-First Classifier):
 *    For platforms without categories (Khamsat community requests, RemoteOK general):
 *    Analyzes action verbs and roles in Title & first 120 chars with high weight (25x),
 *    applying strict word boundaries to avoid substring false positives.
 */
export function classifyProject(input: ClassificationInput): ClassificationResult {
  const {
    platform,
    title = '',
    description = '',
    rawCategory = null,
    rawSubCategory = null,
    skills = [],
  } = input;

  // --- LAYER 1: DIRECT NATIVE MAPPING ---
  const directMatch = resolveDirectNative(rawCategory, rawSubCategory);
  if (directMatch) {
    return {
      category: directMatch,
      confidence: 1.0,
      layer: 'direct_native',
      matchedRule: `direct_native:${rawCategory || ''} / ${rawSubCategory || ''}`,
      debugDetails: {
        rawCategory,
        rawSubCategory,
        skillsCount: skills?.length || 0,
      },
    };
  }

  // --- LAYER 2: DOMAIN-LOCKED SUB-ROUTING ---
  const domain = detectDomainFamily(rawCategory, rawSubCategory);
  if (domain) {
    const lockedRes = classifyWithinLockedDomain({
      domain,
      title,
      description,
      skills,
    });
    return {
      category: lockedRes.category,
      confidence: lockedRes.confidence,
      layer: 'domain_locked',
      matchedRule: lockedRes.matchedRule,
      debugDetails: {
        rawCategory,
        rawSubCategory,
        skillsCount: skills?.length || 0,
        lockedDomain: domain,
      },
    };
  }

  // --- LAYER 3: INTENT-FIRST CLASSIFIER ---
  const intentRes = classifyByIntent({
    title,
    description,
    skills,
  });

  return {
    category: intentRes.category,
    confidence: intentRes.confidence,
    layer: 'intent_heuristic',
    matchedRule: intentRes.matchedRule,
    debugDetails: {
      rawCategory,
      rawSubCategory,
      skillsCount: skills?.length || 0,
    },
  };
}

/**
 * Backward compatibility wrapper for categorizeProject
 */
export function categorizeProject(
  titleAndDesc: string,
  platformCategoryHint?: string
): CategoryType {
  const result = classifyProject({
    platform: 'unknown',
    title: titleAndDesc,
    description: '',
    rawCategory: platformCategoryHint,
  });
  return result.category;
}

/**
 * Backward compatibility wrapper for classifyProjectCategory
 */
export function classifyProjectCategory(
  titleAndDesc: string,
  platformCategoryHint?: string
): ProjectCategory {
  return categorizeProject(titleAndDesc, platformCategoryHint);
}
