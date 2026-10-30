// ==============================================================================
// src/lib/filters/keyword-suggestions.ts
// One-click keyword chips for the filters page, so users don't have to guess what to
// type. Arabic and English, since projects arrive in both. Include suggestions follow
// the chosen specialties; exclude suggestions are things most freelancers skip.
// ==============================================================================

export const INCLUDE_SUGGESTIONS: Record<string, string[]> = {
  web_mobile_dev: ['ووردبريس', 'WordPress', 'Laravel', 'React', 'Next.js', 'Flutter', 'تطبيق جوال', 'API', 'PHP', 'Node.js', 'لوحة تحكم'],
  ai_data_automation: ['ذكاء اصطناعي', 'ChatGPT', 'n8n', 'Python', 'أتمتة', 'شات بوت', 'Power BI', 'Excel', 'تحليل بيانات', 'scraping'],
  ui_ux_graphic: ['شعار', 'logo', 'هوية بصرية', 'Figma', 'UI/UX', 'سوشيال ميديا', 'بوستر', 'Canva', 'Illustrator'],
  video_audio_motion: ['مونتاج', 'موشن جرافيك', 'Reels', 'Premiere', 'After Effects', 'تعليق صوتي', 'video editing', 'أنيميشن'],
  digital_marketing_seo: ['SEO', 'سيو', 'إعلانات ممولة', 'Meta Ads', 'Google Ads', 'إدارة صفحات', 'TikTok', 'تسويق بالمحتوى'],
  writing_translation: ['ترجمة', 'كتابة محتوى', 'مقالات', 'copywriting', 'تدقيق لغوي', 'سيناريو', 'إنجليزي', 'تفريغ'],
  business_accounting_legal: ['محاسبة', 'دراسة جدوى', 'خطة عمل', 'قوائم مالية', 'QuickBooks', 'Excel', 'عقود'],
  sales_customer_support: ['إدخال بيانات', 'data entry', 'مساعد افتراضي', 'خدمة عملاء', 'Excel', 'lead generation', 'مبيعات'],
  engineering_architecture: ['أوتوكاد', 'AutoCAD', 'Revit', 'تصميم داخلي', '3D Max', 'مخططات', 'SketchUp', 'حساب كميات'],
  it_cybersecurity_devops: ['سيرفر', 'VPS', 'Linux', 'Docker', 'AWS', 'استضافة', 'أمن معلومات', 'DevOps'],
  ecommerce_stores: ['سلة', 'زد', 'Shopify', 'WooCommerce', 'متجر', 'رفع منتجات', 'دروب شيبينج'],
  education_training: ['شرح', 'تدريس', 'دورة', 'حقيبة تدريبية', 'رياضيات', 'برمجة للمبتدئين', 'tutor'],
  game_ar_vr: ['Unity', 'Blender', '3D', 'لعبة', 'Unreal', 'نمذجة'],
};

export const EXCLUDE_SUGGESTIONS = [
  'واجب',
  'بحث جامعي',
  'مشروع تخرج',
  'تجربة مجانية',
  'بدون مقابل',
  'لايكات',
  'متابعين',
  'تقييمات',
  'homework',
  'unpaid',
  'free test',
];

/** Up to `max` include chips for the chosen specialties (round-robin, so each one shows up) */
export function includeSuggestionsFor(categories: string[], max = 12): string[] {
  const lists = categories.map((c) => INCLUDE_SUGGESTIONS[c]).filter(Boolean) as string[][];
  const out: string[] = [];
  for (let i = 0; out.length < max && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      if (l[i] && !out.includes(l[i])) out.push(l[i]);
      if (out.length >= max) break;
    }
  }
  return out;
}
