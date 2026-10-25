// ==============================================================================
// src/lib/scrapers/types.ts
// Mega Expansion: 20 Platforms & 14 Full Categories (Vollna Engine Architecture)
// Defines:
//   1. FreelancePlatform (8 Arab + 12 Global Platforms = 20 Marketplaces)
//   2. CategoryType (14 Comprehensive Domains + Backward-Compatibility Aliases)
//   3. PLATFORMS_METADATA & CATEGORIES_METADATA for Unified Dynamic UI Rendering
//   4. UnifiedProject, UserFilter, Proposal & Freelancer Profile Types
// ==============================================================================

import { ClientEvaluation, calculateClientScore } from '../scoring/client-scorer';
export type { ClientEvaluation };

// 1. The 20 Multi-Platform Freelance Marketplaces
export type ArabPlatform =
  | 'mostaql'
  | 'nafezly'
  | 'khamsat'
  | 'kafiil'
  | 'baeed';

export type GlobalPlatform =
  | 'freelancer'
  | 'remoteok'
  | 'pph'
  | 'wwr'
  | 'upwork';

export type FreelancePlatform = ArabPlatform | GlobalPlatform;

// PlatformType alias for backward compatibility with previous modules
export type PlatformType = FreelancePlatform | 'reddit' | 'twitter' | 'linkedin' | 'x';

// 2. The 14 Full Categories
export type CategoryType =
  | 'web_mobile_dev'            // 1. برمجة وتطوير المواقع والتطبيقات
  | 'ai_data_automation'         // 2. الذكاء الاصطناعي والبيانات والأتمتة
  | 'ui_ux_graphic'              // 3. التصميم والجرافيك وUI/UX
  | 'video_audio_motion'         // 4. المونتاج والموشن جرافيك والصوتيات
  | 'digital_marketing_seo'      // 5. التسويق الرقمي والإعلانات وSEO
  | 'writing_translation'        // 6. الكتابة وصناعة المحتوى والترجمة
  | 'business_accounting_legal'  // 7. المحاسبة والمالية والقانون والأعمال
  | 'sales_customer_support'     // 8. المبيعات وخدمة العملاء والمساعد الافتراضي
  | 'engineering_architecture'   // 9. الهندسة والعمارة والتصميم الداخلي
  | 'it_cybersecurity_devops'    // 10. السيرفرات والشبكات والأمن السيبراني
  | 'ecommerce_stores'           // 11. إدارة المتاجر الإلكترونية (سلة/زد/شوبيفاي)
  | 'education_training'         // 12. التعليم والتدريب والبحث العلمي
  | 'game_ar_vr'                 // 13. تطوير الألعاب والنمذجة ثلاثية الأبعاد
  | 'other';                     // 14. أخرى / عام

// Backward compatibility alias for ProjectCategory and LeadCategory
export type ProjectCategory =
  | CategoryType
  | 'web_dev'
  | 'design'
  | 'marketing'
  | 'accounting'
  | 'writing'
  | 'ui_ux';

export type LeadCategory = ProjectCategory;

export type ProjectLanguage = 'ar' | 'en';

export type ToneOfVoice = 'confident' | 'friendly' | 'analytical' | 'direct';

export type ProjectActionStatus = 'matched' | 'saved' | 'applied' | 'replied' | 'ignored' | 'won';

// ==============================================================================
// Metadata for 20 Platforms
// ==============================================================================
export interface PlatformMetadata {
  id: FreelancePlatform;
  label_ar: string;
  label_en: string;
  badge_color: string;
  text_color: string;
  border_color: string;
  region: 'arab' | 'global';
  icon_letter: string;
  website_url: string;
}

export const PLATFORMS_METADATA: PlatformMetadata[] = [
  // --- 5 المنصات العربية ---
  {
    id: 'mostaql',
    label_ar: 'مستقل',
    label_en: 'Mostaql',
    badge_color: 'bg-sky-500',
    text_color: 'text-white',
    border_color: 'border-sky-600',
    region: 'arab',
    icon_letter: 'M',
    website_url: 'https://mostaql.com',
  },
  {
    id: 'nafezly',
    label_ar: 'نفذلي',
    label_en: 'Nafezly',
    badge_color: 'bg-indigo-600',
    text_color: 'text-white',
    border_color: 'border-indigo-700',
    region: 'arab',
    icon_letter: 'N',
    website_url: 'https://nafezly.com',
  },
  {
    id: 'khamsat',
    label_ar: 'خمسات',
    label_en: 'Khamsat',
    badge_color: 'bg-emerald-600',
    text_color: 'text-white',
    border_color: 'border-emerald-700',
    region: 'arab',
    icon_letter: 'K',
    website_url: 'https://khamsat.com',
  },
  {
    id: 'kafiil',
    label_ar: 'كفيل',
    label_en: 'Kafiil',
    badge_color: 'bg-amber-500',
    text_color: 'text-white',
    border_color: 'border-amber-600',
    region: 'arab',
    icon_letter: 'Kf',
    website_url: 'https://kafiil.com',
  },
  {
    id: 'baeed',
    label_ar: 'بعيد',
    label_en: 'Baeed',
    badge_color: 'bg-teal-600',
    text_color: 'text-white',
    border_color: 'border-teal-700',
    region: 'arab',
    icon_letter: 'B',
    website_url: 'https://baeed.com',
  },

  // --- 4 المنصات العالمية ---
  {
    id: 'freelancer',
    label_ar: 'فريلانسر (Freelancer)',
    label_en: 'Freelancer.com',
    badge_color: 'bg-blue-600',
    text_color: 'text-white',
    border_color: 'border-blue-700',
    region: 'global',
    icon_letter: 'F',
    website_url: 'https://www.freelancer.com',
  },
  {
    id: 'pph',
    label_ar: 'بيبول بير أور (PeoplePerHour)',
    label_en: 'PeoplePerHour',
    badge_color: 'bg-orange-500',
    text_color: 'text-white',
    border_color: 'border-orange-600',
    region: 'global',
    icon_letter: 'P',
    website_url: 'https://www.peopleperhour.com',
  },
  {
    id: 'remoteok',
    label_ar: 'ريموت أوك (RemoteOK)',
    label_en: 'RemoteOK',
    badge_color: 'bg-rose-500',
    text_color: 'text-white',
    border_color: 'border-rose-600',
    region: 'global',
    icon_letter: 'R',
    website_url: 'https://remoteok.com',
  },
  {
    id: 'wwr',
    label_ar: 'وي وورك ريموتلي (WeWorkRemotely)',
    label_en: 'WeWorkRemotely',
    badge_color: 'bg-purple-600',
    text_color: 'text-white',
    border_color: 'border-purple-700',
    region: 'global',
    icon_letter: 'W',
    website_url: 'https://weworkremotely.com',
  },
  {
    id: 'upwork',
    label_ar: 'أب وورك (Upwork)',
    label_en: 'Upwork',
    badge_color: 'bg-emerald-600',
    text_color: 'text-white',
    border_color: 'border-emerald-700',
    region: 'global',
    icon_letter: 'Up',
    website_url: 'https://www.upwork.com',
  },
];

/**
 * Remote job boards (mostly full-time roles, no bids). Kept out of filters unless the
 * user turns them on, so alerts stay freelance projects by default.
 */
export const JOB_BOARD_PLATFORMS: FreelancePlatform[] = ['baeed', 'remoteok', 'wwr'];
export const isJobBoard = (platform: string) => JOB_BOARD_PLATFORMS.includes(platform as FreelancePlatform);

// ==============================================================================
// Metadata for 14 Categories
// ==============================================================================
export interface CategoryMetadata {
  id: CategoryType;
  label_ar: string;
  label_en: string;
  icon: string;
  keywords_sample: string;
}

export const CATEGORIES_METADATA: CategoryMetadata[] = [
  {
    id: 'web_mobile_dev',
    label_ar: 'برمجة وتطوير المواقع والتطبيقات',
    label_en: 'Web & Mobile Development',
    icon: '💻',
    keywords_sample: 'Next.js, React, Node.js, Flutter, Python, API, PHP',
  },
  {
    id: 'ai_data_automation',
    label_ar: 'الذكاء الاصطناعي والبيانات والأتمتة',
    label_en: 'AI, Data & Automation',
    icon: '🤖',
    keywords_sample: 'ChatGPT, n8n, Zapier, Scraping, Python, Machine Learning',
  },
  {
    id: 'ui_ux_graphic',
    label_ar: 'التصميم والجرافيك وUI/UX',
    label_en: 'UI/UX & Graphic Design',
    icon: '🎨',
    keywords_sample: 'Figma, Photoshop, Illustrator, واجهات, شعار, هوية',
  },
  {
    id: 'video_audio_motion',
    label_ar: 'المونتاج والموشن جرافيك والصوتيات',
    label_en: 'Video, Motion & Audio',
    icon: '🎬',
    keywords_sample: 'مونتاج, ريلز, موشن جرافيك, Premiere, After Effects, تعليق صوتي',
  },
  {
    id: 'digital_marketing_seo',
    label_ar: 'التسويق الرقمي والإعلانات وSEO',
    label_en: 'Digital Marketing & SEO',
    icon: '📈',
    keywords_sample: 'SEO, Google Ads, Meta Ads, إدارة صفحات, حملات إعلانية',
  },
  {
    id: 'writing_translation',
    label_ar: 'الكتابة وصناعة المحتوى والترجمة',
    label_en: 'Writing & Translation',
    icon: '✍️',
    keywords_sample: 'كتابة محتوى, مقالات, ترجمة معتمدة, تدقيق لغوي, Copywriting',
  },
  {
    id: 'business_accounting_legal',
    label_ar: 'المحاسبة والمالية والقانون والأعمال',
    label_en: 'Business, Accounting & Legal',
    icon: '📊',
    keywords_sample: 'محاسبة, ضرائب, دراسة جدوى, Excel, شجرة حسابات, زاتكا',
  },
  {
    id: 'sales_customer_support',
    label_ar: 'المبيعات وخدمة العملاء والمساعد الافتراضي',
    label_en: 'Sales, Support & Virtual Assistance',
    icon: '🎧',
    keywords_sample: 'خدمة عملاء, كول سنتر, مبيعات, Virtual Assistant, مساعدة عن بعد',
  },
  {
    id: 'engineering_architecture',
    label_ar: 'الهندسة والعمارة والتصميم الداخلي',
    label_en: 'Engineering & Architecture',
    icon: '📐',
    keywords_sample: 'AutoCAD, 3D Max, Revit, تصميم معماري, ديكور, إنشائي',
  },
  {
    id: 'it_cybersecurity_devops',
    label_ar: 'السيرفرات والشبكات والأمن السيبراني',
    label_en: 'IT, DevOps & Cybersecurity',
    icon: '🛡️',
    keywords_sample: 'Docker, Linux, AWS, إعداد خادم, اختراق أخلاقي, شبكات',
  },
  {
    id: 'ecommerce_stores',
    label_ar: 'إدارة المتاجر الإلكترونية (سلة/زد/شوبيفاي)',
    label_en: 'E-commerce & Stores',
    icon: '🛍️',
    keywords_sample: 'سلة, زد, شوبيفاي, دروب شيبينج, رفع منتجات, ربط الدفع',
  },
  {
    id: 'education_training',
    label_ar: 'التعليم والتدريب والبحث العلمي',
    label_en: 'Education & Training',
    icon: '🎓',
    keywords_sample: 'تدريس, دورات, أبحاث علمية, تلخيص, رسائل ماجستير',
  },
  {
    id: 'game_ar_vr',
    label_ar: 'تطوير الألعاب والنمذجة ثلاثية الأبعاد',
    label_en: 'Game Dev & 3D/VR',
    icon: '🎮',
    keywords_sample: 'Unity, Unreal Engine, Blender, 3D Models, C#',
  },
  {
    id: 'other',
    label_ar: 'أخرى / عام',
    label_en: 'Other Freelance Services',
    icon: '⚡',
    keywords_sample: 'خدمات متنوعة عامة',
  },
];

/**
 * Standard Unified Project Model for all freelance marketplaces.
 * Corresponds to public.projects table in Supabase.
 */
export interface UnifiedProject extends ProjectInsights {
  id?: string;
  external_id: string;
  platform: FreelancePlatform;
  source_type: 'marketplace';
  title: string;
  description: string;
  url: string;
  budget: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string | null;
  budget_usd_estimate?: number | null;
  language: ProjectLanguage;
  category: ProjectCategory;
  raw_category?: string | null;
  raw_subcategory?: string | null;
  raw_skills?: string[] | null;
  author: string;
  published_at: string; // ISO 8601 string
  created_at?: string;
  updated_at?: string;

  // Backward compatibility fields for leads_pool and dispatcher
  external_post_id: string;
  author_handle: string;
  post_text: string;
  post_url: string;
  category_slug: string;
  intent_score?: number;
  is_buyer?: boolean;
  ai_reason_short?: string;
}

/**
 * Competition & client signals read from the source platform (all optional -
 * each platform exposes a different subset). Stored on public.projects (migration 0010).
 */
export interface ProjectInsights {
  bids_count?: number | null;
  proposals_count?: number | null;
  bids_avg?: number | null;
  client_hire_rate?: number | null; // 0-100
  client_open_projects?: number | null;
  client_in_progress?: number | null;
  client_registered_at?: string | null;
  client_country?: string | null;
  client_profession?: string | null;
  duration_text?: string | null;
  details_fetched_at?: string | null;
  /** Fixed-price or hourly. Used for matching only (not stored). */
  job_type?: 'fixed' | 'hourly' | null;
  payment_verified?: boolean | null;
  client_payment_verified?: boolean | null;
  total_spent?: string | null;
  client_rating?: number | null;
  client_evaluation?: ClientEvaluation | null;
}

export const PROJECT_INSIGHT_KEYS: (keyof ProjectInsights)[] = [
  'bids_count',
  'bids_avg',
  'client_hire_rate',
  'client_open_projects',
  'client_in_progress',
  'client_registered_at',
  'client_country',
  'duration_text',
  'details_fetched_at',
];

export type UnifiedLead = UnifiedProject;
export type RawScrapedPost = UnifiedProject;

/**
 * Freelancer Profile (Context & Identity)
 * Corresponds to public.freelancer_profiles table in Supabase.
 */
export interface FreelancerProfile {
  id?: string;
  user_id: string;
  full_name: string | null;
  title: string | null;
  bio: string | null;
  skills: string[];
  tone_of_voice: ToneOfVoice;
  telegram_chat_id: string | null;
  telegram_connect_token?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Portfolio Item (AI Vault)
 */
export interface PortfolioItem {
  id: string;
  user_id: string;
  project_title: string;
  description: string;
  live_url?: string | null;
  tags: string[];
  category: ProjectCategory | string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Vollna-Style Smart Filter Rule
 * Corresponds to public.user_filters table in Supabase.
 */
export interface UserFilter {
  id: string;
  user_id: string;
  filter_name: string;
  platforms: FreelancePlatform[]; // Empty means all 20 platforms
  categories: ProjectCategory[];  // Empty means all categories
  include_keywords: string[];
  exclude_keywords: string[];
  min_budget_usd: number;
  is_active: boolean;
  notify_telegram: boolean;
  // Competition & client-quality conditions (migration 0012); unknown project values pass
  max_bids?: number | null;
  min_client_hire_rate?: number | null;
  exclude_new_clients?: boolean;
  job_type?: 'any' | 'fixed' | 'hourly';
  client_countries?: string[];
  // AI qualifier (migration 0017): plain-language criteria; alerts need ai_min_score or more
  ai_criteria?: string | null;
  ai_min_score?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * User Project Action (Mini-CRM Status & Proposals)
 */
export interface UserProjectAction {
  id: string;
  user_id: string;
  project_id: string;
  status: ProjectActionStatus;
  generated_proposal: string | null;
  notes: string | null;
  matched_filter_id: string | null;
  created_at: string;
  updated_at: string;
  project?: UnifiedProject;
}

/**
 * Payload for Proposal Generation
 */
export interface ProposalGenerationParams {
  project_id?: string;
  user_id?: string;
  project_title?: string;
  project_description?: string;
  freelancer_bio?: string;
  freelancer_skills?: string[] | string;
  tone_of_voice?: ToneOfVoice;
  portfolio_items?: PortfolioItem[];
  custom_instructions?: string;
}

export interface ProposalGenerationResult {
  ok: boolean;
  proposal?: string;
  referenced_portfolio_ids?: string[];
  execution_time_ms: number;
  error?: string;
}

export interface ScraperResult {
  platform: FreelancePlatform;
  category_slug: string;
  totalFetched: number;
  projects: UnifiedProject[];
  error?: string;
}

/**
 * Estimate approximate USD value for budget bounds across global & regional currencies
 */
export function estimateBudgetUsd(
  amount: number | null | undefined,
  currency: string | null | undefined
): number | null {
  if (amount == null || isNaN(amount)) return null;
  const curr = (currency || '').toUpperCase();
  if (curr === 'USD' || curr === '$') return amount;
  if (curr === 'SAR' || curr === 'ريال' || curr === 'رس') return Math.round(amount / 3.75);
  if (curr === 'AED' || curr === 'درهم' || curr === 'د.إ') return Math.round(amount / 3.67);
  if (curr === 'EGP' || curr === 'جنيه' || curr === 'ج.م') return Math.round(amount / 50.0);
  if (curr === 'EUR' || curr === '€' || curr === 'يورو') return Math.round(amount * 1.08);
  if (curr === 'GBP' || curr === '£' || curr === 'استرليني') return Math.round(amount * 1.28);
  if (curr === 'CAD') return Math.round(amount * 0.73);
  if (curr === 'INR') return Math.round(amount * 0.012);
  if (curr === 'KWD' || curr === 'دينار كويتي') return Math.round(amount * 3.25);
  if (curr === 'QAR' || curr === 'ريال قطري') return Math.round(amount / 3.64);
  return amount; // Default fallback
}

/** The leads_pool text format read back by extractTitleFromPostText / extractDetailsFromPostText. */
export function buildPostText(
  platform: string,
  title: string,
  budget: string | null | undefined,
  description: string
): string {
  return `[${platform.toUpperCase()} - طلب مشروع]\nعنوان: ${title}\n${budget ? `الميزانية: ${budget}\n` : ''}التفاصيل: ${description}`.trim();
}

/**
 * Factory helper to construct a typed UnifiedProject with formatted post_text
 */
export function createUnifiedProject(params: {
  external_id: string;
  platform: FreelancePlatform;
  title: string;
  description: string;
  url: string;
  budget?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string | null;
  language: ProjectLanguage;
  category: ProjectCategory;
  raw_category?: string | null;
  raw_subcategory?: string | null;
  raw_skills?: string[] | null;
  published_at?: string;
  author?: string;
  insights?: ProjectInsights;
}): UnifiedProject {
  const published_at = params.published_at || new Date().toISOString();
  const author = params.author || 'صاحب مشروع';
  const currency = params.currency || (params.language === 'ar' ? 'USD' : '$');

  const budget = params.budget || (
    params.budget_min || params.budget_max
      ? `${params.budget_min || 0} - ${params.budget_max || 0} ${currency}`
      : null
  );

  const bestAmount = params.budget_max || params.budget_min || null;
  const budget_usd_estimate = estimateBudgetUsd(bestAmount, currency);

  const post_text = buildPostText(params.platform, params.title, budget, params.description);

  return {
    external_id: params.external_id,
    platform: params.platform,
    source_type: 'marketplace',
    title: params.title,
    description: params.description,
    url: params.url,
    budget,
    budget_min: params.budget_min || null,
    budget_max: params.budget_max || null,
    currency,
    budget_usd_estimate,
    language: params.language,
    category: params.category,
    raw_category: params.raw_category || null,
    raw_subcategory: params.raw_subcategory || null,
    raw_skills: params.raw_skills || null,
    published_at,
    author,
    // Aliases for backward compatibility
    external_post_id: `${params.platform}_${params.external_id}`,
    author_handle: author,
    post_text,
    post_url: params.url,
    category_slug: params.category,
    intent_score: 10,
    is_buyer: true,
    ...(params.insights || {}),
    client_evaluation:
      params.insights?.client_evaluation ??
      calculateClientScore({
        platform: params.platform,
        title: params.title,
        description: params.description,
        budget,
        budget_min: params.budget_min,
        budget_max: params.budget_max,
        budget_usd_estimate,
        currency,
        author,
        insights: params.insights,
      }),
  };
}

/**
 * Reads the title back out of a post_text built by createUnifiedProject:
 * "[PLATFORM - طلب مشروع]\nعنوان: <title>\nالميزانية: ...\nالتفاصيل: <description>"
 * Falls back to the first non-tag line for older/other formats.
 */
export function extractTitleFromPostText(postText: string | null | undefined): string {
  const text = postText || '';
  const titleLine = text.match(/^عنوان:\s*(.+)$/m);
  if (titleLine) return titleLine[1].trim();
  const firstReal = text
    .split('\n')
    .map((l) => l.replace(/\[.*?\]/g, '').trim())
    .find(Boolean);
  return firstReal || '';
}

/** The description part of a post_text (everything after "التفاصيل:"), or the whole text. */
export function extractDetailsFromPostText(postText: string | null | undefined): string {
  const text = postText || '';
  const idx = text.indexOf('التفاصيل:');
  return idx >= 0 ? text.slice(idx + 'التفاصيل:'.length).trim() : text;
}

// Alias for createUnifiedLead
export const createUnifiedLead = (params: any): UnifiedProject => {
  return createUnifiedProject(params);
};
