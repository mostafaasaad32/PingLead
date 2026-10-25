// ==============================================================================
// src/lib/taxonomy/types.ts
// Master Freelancer Taxonomy Definitions & Types for PingLead
// ==============================================================================

import { CategoryType, ProjectCategory } from '../scrapers/types';

export interface ClassificationInput {
  platform: string;
  title: string;
  description?: string | null;
  rawCategory?: string | null;
  rawSubCategory?: string | null;
  skills?: string[] | null;
}

export interface ClassificationResult {
  category: CategoryType;
  confidence: number; // 0.0 - 1.0 (1.0 = 100% direct native match)
  layer: 'direct_native' | 'domain_locked' | 'intent_heuristic' | 'fallback';
  matchedRule?: string;
  debugDetails?: {
    rawCategory?: string | null;
    rawSubCategory?: string | null;
    skillsCount?: number;
    lockedDomain?: string | null;
  };
}

/**
 * Umbrella Domain Families for Layer 2 Domain-Locking.
 * When a project comes from an umbrella category, it is strictly forbidden
 * from escaping into unrelated domains.
 */
export type DomainFamily =
  | 'development'
  | 'design_media'
  | 'marketing_sales'
  | 'writing_translation'
  | 'business_finance_admin'
  | 'engineering_cad'
  | 'education_academic';

export const DOMAIN_ALLOWED_CATEGORIES: Record<DomainFamily, CategoryType[]> = {
  // Software, Web, Mobile, Data/AI, Cloud, and Games
  development: [
    'web_mobile_dev',
    'ecommerce_stores',
    'ai_data_automation',
    'it_cybersecurity_devops',
    'game_ar_vr',
  ],
  // Visual arts, UI/UX, Motion, Video, Audio
  design_media: [
    'ui_ux_graphic',
    'video_audio_motion',
    'game_ar_vr',
    'engineering_architecture', // 3D Max, interior design often categorized under Design in some sites
  ],
  // Marketing, SEO, Social Media, Growth, Paid Ads, Telemarketing
  marketing_sales: [
    'digital_marketing_seo',
    'sales_customer_support',
  ],
  // Writing, Editing, Copywriting, Translation, Proofreading
  writing_translation: [
    'writing_translation',
  ],
  // Accounting, Finance, Legal, Virtual Assistance, Data Entry, Customer Support
  business_finance_admin: [
    'business_accounting_legal',
    'sales_customer_support',
  ],
  // Architecture, AutoCAD, Engineering, Interior Design
  engineering_cad: [
    'engineering_architecture',
    'ui_ux_graphic',
  ],
  // Education, Tutoring, Research
  education_academic: [
    'education_training',
    'writing_translation',
  ],
};
