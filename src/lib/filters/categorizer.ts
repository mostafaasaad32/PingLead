// ==============================================================================
// src/lib/filters/categorizer.ts
// Comprehensive Smart Categorizer & Budget Extractor (14 Full Domains)
// $0 Cost Pure Algorithmic Classifier in Arabic & English
// ==============================================================================

import { CategoryType, ProjectCategory, estimateBudgetUsd } from '../scrapers/types';

// ==============================================================================
// 14 Comprehensive Category Regex Dictionaries (Arabic + English)
// Latin terms are whole-word (\b...\b): unbounded "ai" matched "email", "ar" matched
// "are", "unity" matched "community", which pushed most English posts into AI/games.
// Ambiguous short Arabic terms use arWord(), since \b doesn't work on Arabic letters.
// ==============================================================================

/** Matches an Arabic word only when it isn't part of a longer Arabic word. */
const arWord = (word: string) => new RegExp(`(?:^|[^\\u0600-\\u06FF])${word}(?:$|[^\\u0600-\\u06FF])`);

const CATEGORY_PATTERNS: Record<CategoryType, RegExp[]> = {
  // 1. Web & Mobile Development
  web_mobile_dev: [
    /برمج|مبرمج|تطوير مواقع|تطوير ويب|مطور برمجيات|برمجة موقع/i,
    /تطبيق جوال|تطبيقات|تطبيق اندرويد|تطبيق أندرويد|أندرويد|اندرويد|ايفون|آيفون/i,
    /\b(?:ios|android|react|react native|flutter|vue|angular|next\.?js|nuxt|svelte)\b/i,
    /\b(?:node\.?js|express\.?js|nest\.?js|django|fastapi|flask|laravel|php|asp\.net|\.net core)\b/i,
    /\b(?:python|javascript|typescript|golang|ruby on rails|rails)\b/i,
    /\b(?:apis?|rest api|graphql|web service|webhooks?|backend|back-end|frontend|front-end|fullstack|full-stack)\b/i,
    /\b(?:sql|postgresql|mysql|mongodb|redis|supabase|firebase|prisma)\b/i,
    /\b(?:software engineer|software developer|web developer|mobile developer|app developer|full stack|website)\b/i,
  ],

  // 2. AI, Data & Automation
  ai_data_automation: [
    /ذكاء اصطناعي|تعلم آلي|تعلم الآلة|تعلم العميق/i,
    /\b(?:ai|a\.i\.|artificial intelligence|machine learning|deep learning)\b/i,
    /\b(?:chatgpt|gpt-?[345]o?|openai|llms?|nlp|rag|langchain|llamaindex|ai agents?)\b/i,
    /أتمتة|اتمتة|أتمته|بوت تليجرام|بوت واتساب|شات بوت|روبوت محادثة/i,
    /\b(?:automation|chatbots?|telegram bot|discord bot|whatsapp bot|n8n|zapier|make\.com)\b/i,
    /علم بيانات|تحليل بيانات|محلل بيانات/i,
    /\b(?:data science|data scientist|data analyst|data analysis|pandas|numpy|power bi|tableau)\b/i,
    /سحب بيانات|كشط بيانات/i,
    /\b(?:scraping|web scraper|crawler|selenium|playwright|puppeteer)\b/i,
    /\b(?:computer vision|yolo|ocr|speech to text|text to speech|stable diffusion)\b/i,
  ],

  // 3. UI/UX & Graphic Design
  ui_ux_graphic: [
    /تصميم|مصمم|غرافيك|جرافيك|جرافكس/i,
    /\bgraphic design(?:er)?\b/i,
    /واجهة|واجهات|تجربة مستخدم/i,
    /\b(?:ui|ux|ui\/ux|user interface|user experience)\b/i,
    /\b(?:figma|adobe xd|invision|wireframes?)\b/i,
    /شعار|شعارات|لوجو|لوقو|هوية بصرية|هوية تجارية/i,
    /\b(?:logo|logos|branding|brand identity)\b/i,
    /فوتوشوب|إليستريتور|اليستريتور/i,
    /\b(?:photoshop|illustrator|indesign|canva)\b/i,
    /بنر|بوستر|فلاير|بروشور|منيو|كروت شخصية/i,
    /\b(?:banner|poster|flyer|brochure|packaging)\b/i,
    /رسم رقمي|رسام/i,
    /\b(?:digital art|vector|illustration)\b/i,
  ],

  // 4. Video, Motion & Audio
  video_audio_motion: [
    /مونتاج|مونتير|تحرير فيديو|تعديل فيديو|موشن جرافيك|موشن غرافيك|انيميشن|ريلز|شورتس/i,
    /\b(?:video editing|video editor|motion graphics?|motion design|animation|animated|reels|youtube shorts)\b/i,
    /بريمير|افتر افكت|تعليق صوتي|فويس أوفر|صوتيات|هندسة صوتية|بودكاست|مكساج|تعديل صوت/i,
    /\b(?:premiere|after effects|davinci|final cut|voiceover|voice over|audio|podcast|sound design)\b/i,
  ],

  // 5. Digital Marketing & SEO
  digital_marketing_seo: [
    /تسويق|مسوق|حملة إعلانية|حملة اعلانية|إعلانات ممولة|اعلانات ممولة|سيو|تحسين محركات البحث/i,
    /\b(?:digital marketing|marketing|marketer|ads campaign|seo|search engine optimization|backlinks)\b/i,
    /\b(?:google ads|meta ads|facebook ads|tiktok ads|snapchat ads|ppc)\b/i,
    /إدارة صفحات|مدير صفحات|قمع تسويقي|ادسنس|أدسنس|لايكات|متابعين|تفاعلات|سوشيال ميديا/i,
    /\b(?:adsense|followers|likes|engagement|social media)\b/i,
    /\b(?:social media management|social media manager|media buyer|email marketing|mailchimp|klaviyo|sales funnel)\b/i,
    /\b(?:growth hacker|conversion rate|cro|semrush|ahrefs)\b/i,
  ],

  // 6. Writing & Translation
  writing_translation: [
    /كتابة|كاتب|كتابة مقالات|صناعة محتوى|كاتب محتوى|ترجمة|مترجم|تدقيق لغوي|تدقيق إملائي|مصحح لغوي/i,
    /\b(?:content writer|content writing|copywriting|copywriter|article writing|blog posts?)\b/i,
    /\b(?:translation|translator|translate|localization|proofreading|copy editing)\b/i,
    /تفريغ صوتي|تفريغ نصوص|تلخيص|سيناريو|كتابة سكربت|مقالات حصرية/i,
    /\b(?:transcription|scriptwriting|storytelling|ghostwriter|ghostwriting|technical writer|creative writing)\b/i,
  ],

  // 7. Business, Accounting & Legal
  business_accounting_legal: [
    /محاسب|محاسبة/i,
    arWord('مالي'),
    arWord('مالية'),
    /\b(?:accounting|accountant|bookkeeping|bookkeeper|financial statements?|financial model(?:ing)?)\b/i,
    /ضرائب|ضريبة|زاتكا|قيمة مضافة|قوائم مالية|ميزانية عمومية|ميزان مراجعة|دفتر الأستاذ/i,
    /\b(?:zatca|vat|tax return)\b/i,
    /دراسة جدوى|خطة عمل|استشارات أعمال|تطوير أعمال/i,
    /\b(?:business plan|feasibility study|business consultant)\b/i,
    /قانون|قانوني|اتفاقية|محامي|صياغة عقد|صياغة عقود/i,
    /\b(?:legal|lawyer|attorney|quickbooks|xero|zoho books|sap)\b/i,
  ],

  // 8. Sales, Customer Support & Virtual Assistance
  sales_customer_support: [
    /خدمة عملاء|خدمة العملاء|دعم فني|مبيعات|مندوب مبيعات|مساعد افتراضي|مساعدة افتراضية|إدخال بيانات|ادخال بيانات|تنسيق ملف|تنسيق ملفات|ملف ورد|ملف وورد|اكسل|إكسل/i,
    /\b(?:excel|word document|google sheets|spreadsheet)\b/i,
    /\b(?:customer service|customer support|help desk|zendesk|intercom)\b/i,
    /\b(?:sales|cold calling|telemarketing|lead generation|lead qualification|appointment setter)\b/i,
    /\b(?:virtual assistant|va|admin support|data entry|copy paste|crm|hubspot|salesforce)\b/i,
  ],

  // 9. Engineering & Architecture
  engineering_architecture: [
    /هندسة|مهندس|معماري|عمارة|تصميم داخلي|ديكور|ديكورات/i,
    /\b(?:architectural|interior design|building design|landscape design)\b/i,
    /أوتوكاد|اوتوكاد|ريفت|ريفيت|رندر|إنشائي|مخططات|حساب كميات|رسومات تنفيذية/i,
    /\b(?:autocad|revit|3d max|3ds max|v-ray|sketchup|lumion|civil engineer(?:ing)?|structural engineer(?:ing)?|mep)\b/i,
  ],

  // 10. IT, DevOps & Cybersecurity
  it_cybersecurity_devops: [
    /سيرفر|سيرفرات|خوادم|خادم|أمن سيبراني|أمن المعلومات|اختراق أخلاقي|شبكات|راوتر|سويتش/i,
    /\b(?:servers?|vps|linux|ubuntu|centos|cybersecurity|infosec|pen testing|penetration testing|vulnerability)\b/i,
    /\b(?:devops|docker|kubernetes|k8s|ci\/cd|github actions|aws|azure|google cloud|gcp|cloudflare|terraform)\b/i,
    /\b(?:vpn|cisco|system administrator|sysadmin)\b/i,
  ],

  // 11. E-commerce & Stores Management
  ecommerce_stores: [
    /متجر الكتروني|متجر إلكتروني|متاجر|تجارة الكترونية|تجارة إلكترونية|منصة سلة|منصة زد|شوبيفاي|ووكومرس|دروب شيبينج/i,
    arWord('سلة'),
    arWord('زد'),
    /\b(?:e-?commerce|online store|salla|zid|shopify|woocommerce|dropshipping|aliexpress)\b/i,
    /رفع منتجات|إضافة منتجات|إدارة المخزون|بوابة دفع|ربط الدفع|تمارا/i,
    arWord('تابي'),
    /\b(?:inventory|product listings?|payment gateway)\b/i,
  ],

  // 12. Education & Training
  education_training: [
    /تدريس|معلم|مدرس|أستاذ|دورة تدريبية|تدريب|كورس|بحث علمي|رسالة ماجستير|أطروحة دكتوراه/i,
    /\b(?:tutor|tutoring|teacher|teaching|online course|course creation|academic research|thesis|dissertation)\b/i,
    /شرح مادة|حل مسائل|رياضيات|فيزياء|كيمياء|إعداد حقائب تدريبية|حقيبة تدريبية|مناهج/i,
    /\b(?:curriculum|lesson plans?)\b/i,
  ],

  // 13. Game Dev & 3D/VR
  game_ar_vr: [
    /ألعاب|تطوير ألعاب|برمجة ألعاب|نمذجة ثلاثية الأبعاد|واقع معزز|واقع افتراضي|ريجينج/i,
    /\b(?:game dev|game developer|game development|unity|unity3d|unreal engine|godot|roblox)\b/i,
    /\b(?:3d model(?:ing|ling)?|blender|zbrush|rigging|3d assets|virtual reality|augmented reality|ar\/vr|vr)\b/i,
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
    // Word boundaries for short tokens: "Training" contains "ai", "Building" contains "ui"
    if (/\bai\b|artificial|machine-learning|machine learning/.test(hint) || hint.includes('أتمتة') || hint.includes('ذكاء')) return 'ai_data_automation';
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
    if (hint.includes('design') || /\bui\b/.test(hint) || hint.includes('تصميم')) return 'ui_ux_graphic';
    if (hint.includes('mobile') || hint.includes('web') || hint.includes('dev') || hint.includes('software') || hint.includes('programming') || hint.includes('برمج')) return 'web_mobile_dev';
    if (hint.includes('business') || hint.includes('legal') || hint.includes('admin') || hint.includes('data entry') || hint.includes('أعمال')) return 'business_accounting_legal';
    if (hint.includes('support') || hint.includes('دعم')) return 'sales_customer_support';
    if (hint.includes('training') || hint.includes('تدريب')) return 'education_training';
    if (hint.includes('engineer') || hint.includes('science')) return 'engineering_architecture';
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

  // Nothing in the text or the platform's category says what this is: don't guess "programming",
  // or unrelated projects reach programmers' filters
  return 'other';
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
