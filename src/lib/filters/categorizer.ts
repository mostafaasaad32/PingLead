// ==============================================================================
// src/lib/filters/categorizer.ts
// Comprehensive Smart Categorizer & Budget Extractor (14 Full Domains)
// $0 Cost Pure Algorithmic Classifier in Arabic & English
// ==============================================================================

import { CategoryType, ProjectCategory, estimateBudgetUsd } from '../scrapers/types';

// ==============================================================================
// 14 Comprehensive Category Regex Dictionaries (Arabic + English)
// ==============================================================================
const CATEGORY_PATTERNS: Record<CategoryType, RegExp[]> = {
  // 1. Web & Mobile Development
  web_mobile_dev: [
    /برمج|مبرمج|تطوير مواقع|تطوير ويب|مطور برمجيات|برمجة موقع/i,
    /تطبيق|تطبيقات|أندرويد|اندرويد|ايفون|آيفون|ios|android/i,
    /react|react native|flutter|vue|angular|next\.?js|nuxt|svelte/i,
    /node\.?js|express|nest\.?js|django|fastapi|flask|laravel|php|asp\.net|\.net core/i,
    /python|javascript|typescript|golang|rust|ruby|rails/i,
    /api|rest api|graphql|web service|webhook|backend|frontend|fullstack|full-stack/i,
    /sql|postgresql|mysql|mongodb|redis|supabase|firebase|prisma/i,
    /software engineer|web developer|mobile developer|app developer|full stack/i,
  ],

  // 2. AI, Data & Automation
  ai_data_automation: [
    /ذكاء اصطناعي|تعلم آلي|تعلم العميق|ai|machine learning|deep learning/i,
    /chatgpt|gpt-?4|openai|claude|gemini|llm|nlp|rag|langchain|llamaindex/i,
    /بوت|أتمتة|اتمتة|أتمته|automation|bot|n8n|zapier|make\.com/i,
    /علم بيانات|تحليل بيانات|data science|data analyst|data analysis|pandas|numpy/i,
    /سحب بيانات|كشط بيانات|scraping|web scraper|crawler|selenium|playwright|puppeteer/i,
    /computer vision|yolo|ocr|speech to text|stt|tts|diffusion|stable diffusion/i,
  ],

  // 3. UI/UX & Graphic Design
  ui_ux_graphic: [
    /تصميم|مصمم|غرافيك|جرافيك|جرافكس|graphic design/i,
    /واجهة|واجهات|تجربة مستخدم|ui|ux|ui\/ux|user interface|user experience/i,
    /figma|adobe xd|sketch|invision|wireframe|prototype/i,
    /شعار|شعارات|لوجو|لوقو|هوية بصرية|هوية تجارية|branding|brand identity/i,
    /فوتوشوب|photoshop|إليستريتور|اليستريتور|illustrator|indesign/i,
    /بنر|بوستر|فلاير|بروشور|سوشيال ميديا ديزاين|منيو|كروت شخصية|packaging/i,
    /رسم رقمي|digital art|vector|illustration|رسام/i,
  ],

  // 4. Video, Motion & Audio
  video_audio_motion: [
    /مونتاج|مونتير|تحرير فيديو|تعديل فيديو|video editing|video editor/i,
    /موشن جرافيك|موشن غرافيك|motion graphic|motion design|animation|انيميشن/i,
    /ريلز|شورتس|تيك توك|reels|shorts|tiktok video/i,
    /بريمير|premiere|افتر افكت|after effects|davinci|final cut/i,
    /صوت|صوتيات|تعليق صوتي|فويس أوفر|voiceover|voice over|audio/i,
    /هندسة صوتية|بودكاست|podcast|sound design|مكساج|تعديل صوت/i,
  ],

  // 5. Digital Marketing & SEO
  digital_marketing_seo: [
    /تسويق|مسوق|تسويق الكتروني|digital marketing|marketing specialist/i,
    /حملة إعلانية|حملة اعلانية|إعلانات ممولة|اعلانات ممولة|ads campaign/i,
    /سيو|seo|تحسين محركات البحث|search engine optimization|backlinks/i,
    /google ads|meta ads|facebook ads|tiktok ads|snapchat ads|x ads/i,
    /إدارة صفحات|مدير صفحات|social media management|media buyer/i,
    /بريد الكتروني|email marketing|mailchimp|klaviyo|funnel|قمع تسويقي/i,
    /growth hacker|conversion rate|cro|semrush|ahrefs/i,
  ],

  // 6. Writing & Translation
  writing_translation: [
    /كتابة|كاتب|كتابة مقالات|صناعة محتوى|كاتب محتوى|content writer|copywriting/i,
    /ترجمة|مترجم|ترجمة معتمدة|translation|translator|localize/i,
    /تدقيق لغوي|تدقيق إملائي|proofreading|editing|مصحح لغوي/i,
    /تفريغ صوتي|تفريغ نصوص|transcription|تلخيص/i,
    /سيناريو|كتابة سكربت|scriptwriting|storytelling|أبحاث/i,
    /ghostwriter|technical writer|creative writing|مقالات حصرية/i,
  ],

  // 7. Business, Accounting & Legal
  business_accounting_legal: [
    /محاسب|محاسبة|مالي|مالية|accounting|accountant|financial/i,
    /ضرائب|ضريبة|زاتكا|zatca|قيمة مضافة|vat|ضريبة الدخل/i,
    /قوائم مالية|ميزانية عمومية|ميزان مراجعة|دفاتر|قيود|دفتر الأستاذ/i,
    /دراسة جدوى|خطة عمل|business plan|feasibility study/i,
    /استشارات أعمال|تطوير أعمال|business consultant/i,
    /قانون|قانوني|عقد|عقود|اتفاقية|محامي|legal|contract/i,
    /quickbooks|xero|zoho books|sap|odoo accounting/i,
  ],

  // 8. Sales, Customer Support & Virtual Assistance
  sales_customer_support: [
    /خدمة عملاء|خدمة العملاء|customer service|customer support/i,
    /دعم فني|help desk|ticket support|zendesk|intercom/i,
    /مبيعات|مندوب مبيعات|sales|cold calling|telemarketing/i,
    /مساعد افتراضي|مساعدة افتراضية|virtual assistant|va|admin support/i,
    /إدخال بيانات|ادخال بيانات|data entry|copy paste|تنسيق ملفات/i,
    /crm|hubspot|salesforce|lead qualification/i,
  ],

  // 9. Engineering & Architecture
  engineering_architecture: [
    /هندسة|مهندس|معماري|عمارة|architecture|architect/i,
    /تصميم داخلي|ديكور|interior design|ديكورات/i,
    /أوتوكاد|اوتوكاد|autocad|revit|ريفت|ريفيت/i,
    /3d max|3ds max|v-ray|sketchup|lumion|رندر|render/i,
    /إنشائي|مدني|كهربائي|ميكانيكي|civil engineer|structural/i,
    /مخطط|مخططات|حساب كميات|رسومات تنفيذية/i,
  ],

  // 10. IT, DevOps & Cybersecurity
  it_cybersecurity_devops: [
    /سيرفر|سيرفرات|خوادم|خادم|server|linux|ubuntu|centos/i,
    /أمن سيبراني|أمن المعلومات|cybersecurity|infosec|security/i,
    /اختراق أخلاقي|pen testing|penetration testing|vulnerability/i,
    /devops|docker|kubernetes|k8s|ci\/cd|github actions/i,
    /aws|azure|google cloud|gcp|cloudflare|terraform/i,
    /شبكات|راوتر|سويتش|vpn|cisco|system administrator|sysadmin/i,
  ],

  // 11. E-commerce & Stores Management
  ecommerce_stores: [
    /متجر الكتروني|متاجر|تجارة الكترونية|e-?commerce/i,
    /سلة|منصة سلة|salla/i,
    /زد|منصة زد|zid/i,
    /شوبيفاي|shopify|woocommerce|ووكومرس/i,
    /دروب شيبينج|dropshipping|aliexpress|cjdropshipping/i,
    /رفع منتجات|إضافة منتجات|تعديل أسعار|إدارة المخزون|inventory/i,
    /بوابة دفع|ربط الدفع|مدى|تمارا|تابي|stripe|paypal/i,
  ],

  // 12. Education & Training
  education_training: [
    /تدريس|معلم|مدرس|أستاذ|tutor|teacher|teaching/i,
    /دورة تدريبية|كورس|تدريب|training|course/i,
    /بحث علمي|رسالة ماجستير|أطروحة دكتوراه|academic research|thesis/i,
    /شرح مادة|حل مسائل|رياضيات|فيزياء|كيمياء|لغة إنجليزية/i,
    /إعداد حقائب تدريبية|حقيبة تدريبية|مناهج|curriculum/i,
  ],

  // 13. Game Dev & 3D/VR
  game_ar_vr: [
    /ألعاب|تطوير ألعاب|برمجة ألعاب|game dev|game developer/i,
    /unity|unreal engine|godot|c# game|roblox/i,
    /نمذجة ثلاثية الأبعاد|3d modeling|blender|maya|zbrush/i,
    /vr|ar|virtual reality|augmented reality|واقع معزز|واقع افتراضي/i,
    /شخصيات 3d|ريجينج|rigging|3d assets/i,
  ],

  // 14. Other
  other: [],
};

/**
 * Classifies project text into one of the 14 comprehensive domains.
 * Prioritizes content-specific patterns first, then falls back to platform category hints.
 */
export function categorizeProject(
  titleAndDesc: string,
  platformCategoryHint?: string
): CategoryType {
  const content = (titleAndDesc || '').toLowerCase();
  const combined = `${content} ${(platformCategoryHint || '').toLowerCase()}`;

  // Priority order for domain pattern scanning:
  // Specific domains take precedence over broad domains like web or design
  const priorityOrder: CategoryType[] = [
    'ecommerce_stores',
    'ai_data_automation',
    'video_audio_motion',
    'it_cybersecurity_devops',
    'engineering_architecture',
    'game_ar_vr',
    'sales_customer_support',
    'writing_translation',
    'business_accounting_legal',
    'digital_marketing_seo',
    'education_training',
    'ui_ux_graphic',
    'web_mobile_dev',
  ];

  // 1. Scan direct project text first
  for (const cat of priorityOrder) {
    const patterns = CATEGORY_PATTERNS[cat];
    for (const pat of patterns) {
      if (pat.test(content)) {
        return cat;
      }
    }
  }

  // 2. Fast Category Hint Mapping if content didn't match a specific regex
  if (platformCategoryHint) {
    const hint = platformCategoryHint.toLowerCase();
    if (hint.includes('ai') || hint.includes('data') || hint.includes('أتمتة')) return 'ai_data_automation';
    if (hint.includes('video') || hint.includes('motion') || hint.includes('فيديو') || hint.includes('صوت')) return 'video_audio_motion';
    if (hint.includes('market') || hint.includes('seo') || hint.includes('تسويق')) return 'digital_marketing_seo';
    if (hint.includes('writ') || hint.includes('translat') || hint.includes('كتاب') || hint.includes('ترجم')) return 'writing_translation';
    if (hint.includes('account') || hint.includes('financ') || hint.includes('محاسب')) return 'business_accounting_legal';
    if (hint.includes('store') || hint.includes('shop') || hint.includes('متجر') || hint.includes('سلة')) return 'ecommerce_stores';
    if (hint.includes('architect') || hint.includes('interior') || hint.includes('هندس') || hint.includes('معمار')) return 'engineering_architecture';
    if (hint.includes('devops') || hint.includes('security') || hint.includes('سيرفر') || hint.includes('شبك')) return 'it_cybersecurity_devops';
    if (hint.includes('sales') || hint.includes('support') || hint.includes('خدمة عملاء')) return 'sales_customer_support';
    if (hint.includes('game') || hint.includes('3d') || hint.includes('لعب')) return 'game_ar_vr';
    if (hint.includes('educat') || hint.includes('teach') || hint.includes('تعليم') || hint.includes('تدريب')) return 'education_training';
    if (hint.includes('design') || hint.includes('ui') || hint.includes('تصميم')) return 'ui_ux_graphic';
    if (hint.includes('mobile') || hint.includes('web') || hint.includes('dev') || hint.includes('برمج')) return 'web_mobile_dev';
  }

  // 3. Scan combined (content + hint)
  for (const cat of priorityOrder) {
    const patterns = CATEGORY_PATTERNS[cat];
    for (const pat of patterns) {
      if (pat.test(combined)) {
        return cat;
      }
    }
  }

  return 'web_mobile_dev'; // Default primary domain
}

// Backward compatibility alias for classifyProjectCategory
export function classifyProjectCategory(
  titleAndDesc: string,
  platformCategoryHint?: string
): ProjectCategory {
  const result = categorizeProject(titleAndDesc, platformCategoryHint);
  return result;
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
