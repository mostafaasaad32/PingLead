// ==============================================================================
// src/lib/taxonomy/mappings.ts
// Layer 1 Direct Mappings & Domain-Lock Umbrellas
// ==============================================================================

import { CategoryType } from '../scrapers/types';
import { DomainFamily } from './types';

/**
 * Normalizes any category string by trimming, lowercasing, and stripping punctuation
 */
export function normalizeCategoryText(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[,\-_&/\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------------------------
// LAYER 1: DIRECT NATIVE 100% CONFIDENCE MAPPINGS
// If the raw category or subcategory matches one of these, it's 100% resolved.
// ------------------------------------------------------------------------------
export const DIRECT_NATIVE_MAP: Record<string, CategoryType> = {
  // --- Video, Audio, Motion ---
  'video editing': 'video_audio_motion',
  'video animation': 'video_audio_motion',
  'video production': 'video_audio_motion',
  'motion graphics': 'video_audio_motion',
  'animation': 'video_audio_motion',
  'videography': 'video_audio_motion',
  'voiceover': 'video_audio_motion',
  'voice talent': 'video_audio_motion',
  'audio production': 'video_audio_motion',
  'audio music': 'video_audio_motion',
  'sound design': 'video_audio_motion',
  'مونتاج فيديو': 'video_audio_motion',
  'موشن جرافيك': 'video_audio_motion',
  'تعليق صوتي': 'video_audio_motion',
  'صوتيات': 'video_audio_motion',
  'فيديو وأنيميشن': 'video_audio_motion',
  'تصميم فيديو': 'video_audio_motion',

  // --- Writing & Translation ---
  'writing translation': 'writing_translation',
  'writing and translation': 'writing_translation',
  'writing content': 'writing_translation',
  'content writing': 'writing_translation',
  'article writing': 'writing_translation',
  'copywriting': 'writing_translation',
  'creative writing': 'writing_translation',
  'translation': 'writing_translation',
  'translation languages': 'writing_translation',
  'proofreading': 'writing_translation',
  'editing': 'writing_translation',
  'كتابة وترجمة': 'writing_translation',
  'كتابة ومحتوى': 'writing_translation',
  'ترجمة': 'writing_translation',
  'كتابة مقالات': 'writing_translation',
  'صناعة محتوى': 'writing_translation',
  'تدقيق لغوي': 'writing_translation',
  'كتابة صناعة محتوي ترجمة و لغات': 'writing_translation',
  'remote translation jobs': 'writing_translation',

  // --- Engineering & Architecture ---
  'engineering architecture': 'engineering_architecture',
  'engineering science': 'engineering_architecture',
  'civil engineering': 'engineering_architecture',
  'mechanical engineering': 'engineering_architecture',
  'electrical engineering': 'engineering_architecture',
  'interior design': 'engineering_architecture',
  'exterior design': 'engineering_architecture',
  'interior exterior design': 'engineering_architecture',
  'architectural design': 'engineering_architecture',
  'building design': 'engineering_architecture',
  'cad cam': 'engineering_architecture',
  'autocad': 'engineering_architecture',
  'solidworks': 'engineering_architecture',
  'هندسة وعمارة': 'engineering_architecture',
  'هندسة عمارة وتصميم داخلي': 'engineering_architecture',
  'تصميم معماري': 'engineering_architecture',
  'تصميم داخلي': 'engineering_architecture',
  'ديكور': 'engineering_architecture',

  // --- AI, Data & Automation ---
  'artificial intelligence': 'ai_data_automation',
  'ai machine learning': 'ai_data_automation',
  'machine learning': 'ai_data_automation',
  'data science': 'ai_data_automation',
  'data science analysis': 'ai_data_automation',
  'data science analytics': 'ai_data_automation',
  'deep learning': 'ai_data_automation',
  'ذكاء اصطناعي': 'ai_data_automation',
  'ذكاء اصطناعي تعلم الآلة علم البيانات': 'ai_data_automation',
  'تعلم الآلة': 'ai_data_automation',
  'علم البيانات': 'ai_data_automation',

  // --- Education & Training ---
  'education': 'education_training',
  'training': 'education_training',
  'tutoring education': 'education_training',
  'online tutoring': 'education_training',
  'academic research': 'education_training',
  'تدريب': 'education_training',
  'تعليم وتدريب عن بعد': 'education_training',
  'تدريس': 'education_training',
  'أبحاث علمية': 'education_training',

  // --- IT, DevOps & Cybersecurity ---
  'devops sysadmin': 'it_cybersecurity_devops',
  'devops cloud engineering': 'it_cybersecurity_devops',
  'cybersecurity data protection': 'it_cybersecurity_devops',
  'network system administration': 'it_cybersecurity_devops',
  'information security': 'it_cybersecurity_devops',
  'سيرفرات وشبكات': 'it_cybersecurity_devops',
  'أمن سيبراني': 'it_cybersecurity_devops',

  // --- E-commerce & Stores ---
  'ecommerce management': 'ecommerce_stores',
  'shopify development': 'ecommerce_stores',
  'woocommerce management': 'ecommerce_stores',
  'إدارة متاجر': 'ecommerce_stores',
  'متاجر الكترونية': 'ecommerce_stores',
  'سلة وزد': 'ecommerce_stores',

  // --- Sales & Customer Support ---
  'customer support': 'sales_customer_support',
  'customer service': 'sales_customer_support',
  'customer service tech support': 'sales_customer_support',
  'virtual assistance': 'sales_customer_support',
  'admin support': 'sales_customer_support',
  'administration assistance': 'sales_customer_support',
  'data entry admin': 'sales_customer_support',
  'data entry': 'sales_customer_support',
  'دعم فني': 'sales_customer_support',
  'خدمة عملاء': 'sales_customer_support',
  'مساعد افتراضي': 'sales_customer_support',
  'إدخال بيانات': 'sales_customer_support',
  'remote customer support jobs': 'sales_customer_support',

  // --- Business, Accounting & Legal ---
  'finance accounting': 'business_accounting_legal',
  'accounting bookkeeping': 'business_accounting_legal',
  'management finance': 'business_accounting_legal',
  'legal consulting': 'business_accounting_legal',
  'legal services': 'business_accounting_legal',
  'محاسبة ومالية': 'business_accounting_legal',
  'ضرائب وزاتكا': 'business_accounting_legal',
  'دراسات جدوى': 'business_accounting_legal',
  'استشارات قانونية': 'business_accounting_legal',

  // --- Specific Subcategory Direct Hits ---
  'mobile app development': 'web_mobile_dev',
  'website development': 'web_mobile_dev',
  'web development': 'web_mobile_dev',
  'mobile development': 'web_mobile_dev',
  'logo design': 'ui_ux_graphic',
  'brand identity design': 'ui_ux_graphic',
  'graphic design': 'ui_ux_graphic',
  'fashion clothing': 'ui_ux_graphic',
  'seo search engine optimization': 'digital_marketing_seo',
  'social media marketing': 'digital_marketing_seo',
  'direct marketing': 'digital_marketing_seo',
};

// ------------------------------------------------------------------------------
// LAYER 2: UMBRELLA DOMAIN LOCK TRIGGERS
// Broad marketplace categories that group several related specialties together.
// When matched, the classifier locks resolution strictly to the subcategories
// of this domain.
// ------------------------------------------------------------------------------
export const UMBRELLA_DOMAIN_TRIGGERS: { pattern: RegExp; domain: DomainFamily }[] = [
  // Development umbrella
  {
    pattern: /^(?:development|programming|websites it software|technology programming|web dev|full stack|remote programming jobs|برمجة|تطوير|مشاريع برمجة|برمجة وتطوير|برمجة تطوير المواقع و التطبيقات)$/i,
    domain: 'development',
  },
  // Design & Media umbrella
  {
    pattern: /^(?:design|design media architecture|video photo image|remote design jobs|تصميم|مشاريع تصميم|تصميم فيديو صوتيات|تصميم فيديو و صوتيات)$/i,
    domain: 'design_media',
  },
  // Marketing & Sales umbrella
  {
    pattern: /^(?:marketing|sales marketing|marketing branding sales|sales and marketing|remote marketing sales jobs|تسويق|مشاريع تسويق|التسويق و المبيعات|تسويق ومبيعات)$/i,
    domain: 'marketing_sales',
  },
  // Writing & Translation umbrella
  {
    pattern: /^(?:writing|writing translation|writing content|translation|كتابة|ترجمة|كتابة وترجمة|مشاريع كتابة وترجمة)$/i,
    domain: 'writing_translation',
  },
  // Business, Accounting & Support umbrella
  {
    pattern: /^(?:business|business support|management finance|remote business jobs|أعمال|مشاريع أعمال|إدارة وأعمال|دعم ومساعدة|أمور اخرى)$/i,
    domain: 'business_finance_admin',
  },
  // Engineering & CAD umbrella
  {
    pattern: /^(?:engineering|engineering architecture|engineering science|هندسة|هندسة وعمارة|مشاريع هندسة وعمارة)$/i,
    domain: 'engineering_cad',
  },
  // Education umbrella
  {
    pattern: /^(?:education|training|تدريب|تعليم|تدريب تعليم و مساعدة عن بعد|مشاريع تدريب)$/i,
    domain: 'education_academic',
  },
];

/**
 * Attempts direct native resolution (Layer 1).
 * Returns CategoryType if 100% matched, or null if broad/unknown.
 */
export function resolveDirectNative(
  rawCategory?: string | null,
  rawSubCategory?: string | null
): CategoryType | null {
  const normSub = normalizeCategoryText(rawSubCategory);
  if (normSub && DIRECT_NATIVE_MAP[normSub]) {
    return DIRECT_NATIVE_MAP[normSub];
  }

  const normCat = normalizeCategoryText(rawCategory);
  if (normCat && DIRECT_NATIVE_MAP[normCat]) {
    return DIRECT_NATIVE_MAP[normCat];
  }

  return null;
}

/**
 * Detects if the raw category belongs to an umbrella domain (Layer 2).
 * Returns the DomainFamily if locked, or null.
 */
export function detectDomainFamily(
  rawCategory?: string | null,
  rawSubCategory?: string | null
): DomainFamily | null {
  const normSub = normalizeCategoryText(rawSubCategory);
  for (const trigger of UMBRELLA_DOMAIN_TRIGGERS) {
    if (normSub && trigger.pattern.test(normSub)) {
      return trigger.domain;
    }
  }

  const normCat = normalizeCategoryText(rawCategory);
  for (const trigger of UMBRELLA_DOMAIN_TRIGGERS) {
    if (normCat && trigger.pattern.test(normCat)) {
      return trigger.domain;
    }
  }

  return null;
}
