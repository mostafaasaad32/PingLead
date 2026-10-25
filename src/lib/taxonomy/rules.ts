// ==============================================================================
// src/lib/taxonomy/rules.ts
// Precision Pattern Dictionaries, Intent Weights & Negative Keywords
// ==============================================================================

import { CategoryType } from '../scrapers/types';

/** Helper to match whole Arabic token or phrase */
export const arWord = (word: string) =>
  new RegExp(`(?:^|[^\\u0600-\\u06FF])${word}(?:$|[^\\u0600-\\u06FF])`, 'i');

export interface CategoryRule {
  id: CategoryType;
  /** Heavyweight intent & role triggers in Title & first 100 characters (Weight: 10x - 20x) */
  intentRoles: RegExp[];
  /** Primary domain keywords (Weight: 5x in Title, 10x in Skills, 1x in Description) */
  keywords: RegExp[];
  /** Strong negative keywords that veto or heavily penalize this category */
  negativeKeywords?: RegExp[];
}

export const CATEGORY_RULES: Record<CategoryType, CategoryRule> = {
  // 1. Web & Mobile Development
  web_mobile_dev: {
    id: 'web_mobile_dev',
    intentRoles: [
      /مطلوب مبرمج|مطلوب مطور|برمجة موقع|برمجة تطبيق|إنشاء تطبيق|انشاء تطبيق|تطوير منصة|برمجة سكربت|إصلاح أخطاء برمجية|ربط api|فحص واختبار|اختبار موقع|تطوير موقع|انشاء موقع|إنشاء موقع/i,
      /\b(?:software developer|web developer|mobile developer|full stack developer|backend developer|frontend developer|qa tester|software engineer)\b/i,
    ],
    keywords: [
      /\b(?:ios|android|react|react native|flutter|vue|angular|next\.?js|nuxt|svelte)\b/i,
      /\b(?:node\.?js|express\.?js|nest\.?js|django|fastapi|flask|laravel|php|asp\.net|\.net core)\b/i,
      /\b(?:python|javascript|typescript|golang|ruby on rails|rails)\b/i,
      /\b(?:apis?|rest api|graphql|webhooks?|backend|back-end|frontend|front-end|fullstack|full-stack)\b/i,
      /\b(?:sql|postgresql|mysql|mongodb|redis|supabase|firebase|prisma)\b/i,
      /\b(?:software engineer|web development|mobile app|web application|native app|website|web site|web pages?|landing pages?)\b/i,
      /\b(?:manual testing|automated testing|test cases?|bug fixes?|debugging|qa)\b/i,
      /تطبيق جوال|تطبيقات|تطبيق اندرويد|تطبيق أندرويد|ايفون|آيفون|برمجة|مبرمج|تطوير مواقع|تطوير ويب|موقع الكتروني|موقع إلكتروني|موقع ويب|صفحة هبوط|سكربت|فحص واختبار|اختبار يدوي/i,
    ],
    negativeKeywords: [
      /تصميم فقط|بدون برمجة|تصميم شعار|هوية بصرية|كتابة مقال|ترجمة|تسويق|إدارة صفحات|فويس أوفر|مونتاج فيديو/i,
      /\b(?:logo design|graphic design|video editing|translation|content writing)\b/i,
    ],
  },

  // 2. E-commerce & Stores
  ecommerce_stores: {
    id: 'ecommerce_stores',
    intentRoles: [
      /مطلوب متجر|إنشاء متجر|انشاء متجر|تعديل متجر|متجر سلة|متجر زد|متجر شوبيفاي|متجر ووكومرس|رفع منتجات|ربط بوابة دفع/i,
      /\b(?:shopify store|woocommerce store|dropshipping store|ecommerce setup|e-commerce website)\b/i,
    ],
    keywords: [
      arWord('سلة'),
      arWord('زد'),
      arWord('تابي'),
      arWord('تمارا'),
      /\b(?:salla|zid|shopify|woocommerce|dropshipping|aliexpress|amazon fba|e-?commerce|ecommerce|online store|webshop|digital downloads?)\b/i,
      /متجر الكتروني|متجر إلكتروني|متاجر الكترونية|متاجر إلكترونية|تجارة الكترونية|تجارة إلكترونية|دروب شيبينج|دروبشيبينغ/i,
      /متجر|متاجر|رفع منتجات|إضافة منتجات|بوابة دفع|ربط الدفع/i,
      /\b(?:payment gateway|product listing|product upload|online store)\b/i,
    ],
  },

  // 3. AI, Data & Automation
  ai_data_automation: {
    id: 'ai_data_automation',
    intentRoles: [
      /بناء شات بوت|بوت تليجرام|بوت واتساب|روبوت محادثة|أتمتة عمليات|اتمتة|سحب بيانات|كشط بيانات|تحليل بيانات|علم بيانات/i,
      /\b(?:ai chatbot|telegram bot|whatsapp bot|web scraper|data scraping|automation workflow|data analyst|machine learning model)\b/i,
    ],
    keywords: [
      // Whole-word bounded AI tokens only!
      /\b(?:a\.i\.|artificial intelligence|machine learning|deep learning)\b/i,
      /\b(?:chatgpt|gpt-?[345]o?|openai|llms?|nlp|rag|langchain|llamaindex|ai agents?)\b/i,
      /\b(?:n8n|zapier|make\.com|automation|chatbots?)\b/i,
      /\b(?:data science|data scientist|data analytics?|power bi|tableau|pandas|numpy)\b/i,
      /\b(?:scraping|web scraper|crawler|selenium|playwright|puppeteer)\b/i,
      /\b(?:computer vision|yolo|ocr|speech to text|text to speech|stable diffusion)\b/i,
      /ذكاء اصطناعي|تعلم آلي|تعلم الآلة|تعلم العميق|أتمتة|شات بوت|تحليل بيانات/i,
    ],
    negativeKeywords: [
      // Prevent "ai" substring collisions from matching
      /\b(?:email|domain|retail|tail|chair|available|daily|contain)\b/i,
    ],
  },

  // 4. UI/UX & Graphic Design
  ui_ux_graphic: {
    id: 'ui_ux_graphic',
    intentRoles: [
      /مطلوب مصمم|تصميم شعار|تصميم لوجو|تصميم لوقو|تصميم هوية|تصميم واجهات|تصميم بوستر|تصميم بنر|تصميم فلاير|رسم رقمي/i,
      /\b(?:graphic designer|ui designer|ux designer|logo designer|brand identity|visual designer|ui\/ux designer)\b/i,
    ],
    keywords: [
      /\b(?:ui|ux|ui\/ux|figma|adobe xd|wireframes?|user interface|user experience)\b/i,
      /\b(?:logo|logos|branding|brand identity|vector|illustration|packaging)\b/i,
      /\b(?:photoshop|illustrator|indesign|canva|digital art)\b/i,
      /\b(?:banner|poster|flyer|brochure|business card|menu design)\b/i,
      /\b(?:website design|web design|site design|landing page design|app design)\b/i,
      /تصميم|مصمم|غرافيك|جرافيك|جرافكس|واجهة مستخدم|تجربة مستخدم/i,
      /شعار|شعارات|لوجو|لوقو|هوية بصرية|هوية تجارية|فوتوشوب|إليستريتور|اليستريتور/i,
      /بنر|بوستر|فلاير|بروشور|منيو|كروت شخصية|رسم رقمي/i,
    ],
    negativeKeywords: [
      /برمجة موقع كامل|تطوير كود|backend|laravel|flutter/i,
    ],
  },

  // 5. Video, Motion & Audio
  video_audio_motion: {
    id: 'video_audio_motion',
    intentRoles: [
      /مطلوب مونتير|مونتاج فيديو|تحرير فيديو|تعديل فيديو|موشن جرافيك|معلق صوتي|معلقة صوتية|فويس أوفر|هندسة صوتية|مكساج صوت|تسجيل صوتي|دبلجة/i,
      /(?:مطلوب|طلوب|ابحث عن|نبحث عن)?\s*(?:معلق|معلقة|فويس أوفر|تسجيل صوتي|دبلجة|فيديوهات قصيرة|صناع محتوى.*فيديو|صانع محتوى.*فيديو)/i,
      /\b(?:video editor|video editing|motion designer|motion graphics|voiceover|voice over artist|audio engineer|voice actor|voice talent)\b/i,
    ],
    keywords: [
      /\b(?:video editing|video editor|motion graphics?|motion design|animation|reels|youtube shorts|short videos?|tiktok)\b/i,
      /\b(?:premiere|after effects|davinci|final cut|voiceover|voice over|audio|podcast|sound design|voice acting)\b/i,
      /مونتاج|مونتير|تحرير فيديو|تعديل فيديو|موشن جرافيك|موشن غرافيك|انيميشن|ريلز|شورتس|فيديوهات قصيرة/i,
      /بريمير|افتر افكت|تعليق صوتي|معلق صوتي|معلقة صوتية|فويس أوفر|فويس اوفر|صوتيات|تسجيل صوتي|هندسة صوتية|بودكاست|مكساج|تعديل صوت|دبلجة/i,
    ],
  },

  // 6. Digital Marketing & SEO
  digital_marketing_seo: {
    id: 'digital_marketing_seo',
    intentRoles: [
      /مطلوب مسوق|إدارة حملة|ادارة حملة|إعلانات ممولة|اعلانات ممولة|تحسين سيو|مسك صفحات|خطة تسويقية|مدير تسويق/i,
      /\b(?:digital marketer|media buyer|seo specialist|ads manager|growth hacker)\b/i,
    ],
    keywords: [
      /\b(?:digital marketing|marketer|ads campaign|seo|search engine optimization|backlinks)\b/i,
      /\b(?:google ads|meta ads|facebook ads|tiktok ads|snapchat ads|ppc)\b/i,
      /\b(?:social media management|social media manager|media buyer|email marketing|mailchimp|klaviyo|sales funnel)\b/i,
      /\b(?:conversion rate|cro|semrush|ahrefs)\b/i,
      /تسويق|مسوق|حملة إعلانية|حملة اعلانية|إعلانات ممولة|اعلانات ممولة|سيو|تحسين محركات البحث/i,
      /إدارة صفحات|مدير صفحات|قمع تسويقي|لايكات|متابعين|سوشيال ميديا/i,
    ],
    negativeKeywords: [
      /برمجة موقع كامل|تطبيق جوال من الصفر/i,
    ],
  },

  // 7. Writing & Translation
  writing_translation: {
    id: 'writing_translation',
    intentRoles: [
      /مطلوب كاتب|مطلوب مترجم|كتابة مقالات|صناعة محتوى|كاتب محتوى|تدقيق لغوي|تدقيق إملائي|ترجمة معتمدة|تفريغ صوتي/i,
      /\b(?:content writer|copywriter|article writer|translator|proofreader|transcriptionist)\b/i,
    ],
    keywords: [
      /\b(?:content writer|content writing|copywriting|copywriter|article writing|blog posts?)\b/i,
      /\b(?:translation|translator|translate|localization|proofreading|copy editing)\b/i,
      /\b(?:transcription|scriptwriting|storytelling|ghostwriter|ghostwriting|technical writer)\b/i,
      /كتابة|كاتب|كتابة مقالات|صناعة محتوى|كاتب محتوى|ترجمة|مترجم|تدقيق لغوي|تدقيق إملائي|مصحح لغوي/i,
      /تفريغ صوتي|تفريغ نصوص|تلخيص|سيناريو|كتابة سكربت|مقالات حصرية/i,
    ],
  },

  // 8. Business, Accounting & Legal
  business_accounting_legal: {
    id: 'business_accounting_legal',
    intentRoles: [
      /مطلوب محاسب|مطلوب محامي|إعداد قوائم مالية|دراسة جدوى|خطة عمل|إقرار ضريبي|صياغة عقد|استشارة قانونية/i,
      /\b(?:accountant|bookkeeper|financial analyst|business plan|feasibility study|legal advisor)\b/i,
    ],
    keywords: [
      arWord('محاسب'),
      arWord('محاسبة'),
      arWord('مالي'),
      arWord('مالية'),
      /\b(?:accounting|accountant|bookkeeping|bookkeeper|financial statements?|financial model(?:ing)?)\b/i,
      /\b(?:zatca|vat|tax return|quickbooks|xero|zoho books|sap)\b/i,
      /\b(?:business plan|feasibility study|business consultant|legal|lawyer|attorney)\b/i,
      /ضرائب|ضريبة|زاتكا|قيمة مضافة|قوائم مالية|ميزانية عمومية|ميزان مراجعة|دفتر الأستاذ/i,
      /دراسة جدوى|خطة عمل|استشارات أعمال|تطوير أعمال|صياغة عقد|صياغة عقود|محامي/i,
    ],
  },

  // 9. Sales, Support & Virtual Assistance
  sales_customer_support: {
    id: 'sales_customer_support',
    intentRoles: [
      /مطلوب خدمة عملاء|مطلوب كول سنتر|مطلوب تيلي سيلز|مدخل بيانات|مساعد افتراضي|مساعدة افتراضية|تنسيق ملفات|مطلوب موظف|مطلوب موظفين|مطلوب موضف|مطلوب موضفين/i,
      /\b(?:customer support agent|virtual assistant|data entry specialist|cold caller|appointment setter|sales outreach|booking outreach)\b/i,
    ],
    keywords: [
      /\b(?:outreach|lead gen|lead generation|booking outreach|sales outreach|cold email|appointment setter)\b/i,
      /\b(?:excel|word document|google sheets|spreadsheet)\b/i,
      /\b(?:customer service|customer support|help desk|zendesk|intercom)\b/i,
      /\b(?:sales|cold calling|telemarketing)\b/i,
      /\b(?:virtual assistant|va|admin support|data entry|copy paste|crm|hubspot|salesforce)\b/i,
      /خدمة عملاء|خدمة العملاء|دعم فني|مبيعات|مندوب مبيعات|مساعد افتراضي|مساعدة افتراضية/i,
      /إدخال بيانات|ادخال بيانات|تنسيق ملف|تنسيق ملفات|ملف وورد|ملف اكسل|موظفين|موضفين|فريق عمل/i,
    ],
  },

  // 10. Engineering & Architecture
  engineering_architecture: {
    id: 'engineering_architecture',
    intentRoles: [
      /مطلوب مهندس|مطلوب معماري|تصميم معماري|تصميم إنشائي|تصميم ديكور|مخطط هندسي|حساب كميات/i,
      /\b(?:architect|civil engineer|structural engineer|interior designer|cad drafter)\b/i,
    ],
    keywords: [
      /\b(?:autocad|revit|3d max|3ds max|v-ray|sketchup|lumion|civil engineer(?:ing)?|structural engineer(?:ing)?|mep)\b/i,
      /\b(?:architectural|interior design|building design|landscape design)\b/i,
      /هندسة|مهندس|معماري|عمارة|تصميم داخلي|ديكور|ديكورات/i,
      /أوتوكاد|اوتوكاد|ريفت|ريفيت|رندر|إنشائي|مخططات|حساب كميات|رسومات تنفيذية/i,
    ],
  },

  // 11. IT, DevOps & Cybersecurity
  it_cybersecurity_devops: {
    id: 'it_cybersecurity_devops',
    intentRoles: [
      /إعداد سيرفر|تهيئة سيرفر|ربط vps|أمن سيبراني|اختراق أخلاقي|فحص أمني|إعداد شبكة/i,
      /\b(?:devops engineer|sysadmin|system administrator|penetration tester|cloud architect)\b/i,
    ],
    keywords: [
      /\b(?:servers?|vps|linux|ubuntu|centos|cybersecurity|infosec|security|pen testing|penetration testing|vulnerability)\b/i,
      /\b(?:devops|docker|kubernetes|k8s|ci\/cd|github actions|aws|azure|google cloud|gcp|cloudflare|terraform)\b/i,
      /\b(?:vpn|cisco|system administrator|sysadmin)\b/i,
      /سيرفر|سيرفرات|خوادم|خادم|أمن سيبراني|أمن المعلومات|اختراق أخلاقي|شبكات|راوتر/i,
    ],
  },

  // 12. Education & Training
  education_training: {
    id: 'education_training',
    intentRoles: [
      /مطلوب معلم|مطلوب مدرس|مطلوب أستاذ|تدريس خصوصي|شرح منهج|حل مسائل|إعداد حقيبة تدريبية/i,
      /\b(?:online tutor|private teacher|curriculum developer|course instructor)\b/i,
    ],
    keywords: [
      /\b(?:tutor|tutoring|teacher|teaching|online course|course creation|academic research|thesis|dissertation)\b/i,
      /\b(?:curriculum|lesson plans?)\b/i,
      /تدريس|معلم|مدرس|أستاذ|دورة تدريبية|تدريب|كورس|بحث علمي|رسالة ماجستير|أطروحة دكتوراه/i,
      /شرح مادة|حل مسائل|رياضيات|فيزياء|كيمياء|إعداد حقائب تدريبية|حقيبة تدريبية|مناهج/i,
    ],
  },

  // 13. Game Dev & 3D/VR
  game_ar_vr: {
    id: 'game_ar_vr',
    intentRoles: [
      /برمجة لعبة|تطوير لعبة|تصميم لعبة|نمذجة 3d|مجسم ثلاثي الأبعاد|ريجينج 3d/i,
      /\b(?:game developer|unity developer|unreal engine developer|3d modeler|3d artist)\b/i,
    ],
    keywords: [
      /\b(?:game dev|game developer|game development|unity|unity3d|unreal engine|godot|roblox)\b/i,
      /\b(?:3d model(?:ing|ling)?|blender|zbrush|rigging|3d assets|virtual reality|augmented reality|ar\/vr|vr)\b/i,
      /ألعاب|تطوير ألعاب|برمجة ألعاب|نمذجة ثلاثية الأبعاد|واقع معزز|واقع افتراضي|بلندر/i,
    ],
  },

  // 14. Other
  other: {
    id: 'other',
    intentRoles: [],
    keywords: [],
  },
};
