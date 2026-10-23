// ==============================================================================
// src/lib/filters/scam-detector.ts
// Scam / risk detector for project posts. Pure function, no AI and no I/O, so it
// runs on the server (Telegram alerts) and in the browser (dashboard cards).
//   high    -> classic scam signs: upfront fees, asking for card/ID/OTP, renting
//              accounts, paying in crypto/gift cards/cheques, remote-desktop access
//   caution -> risky but not always a scam: moving the deal off the platform,
//              "easy money" promises, fake reviews / rating manipulation
// Matching is on whole words (Latin) or isolated Arabic words, like the categorizer.
// ==============================================================================

export type ScamLevel = 'none' | 'caution' | 'high';

export interface ScamCheck {
  level: ScamLevel;
  /** Short Arabic reasons, most serious first */
  reasons: string[];
}

interface Rule {
  level: Exclude<ScamLevel, 'none'>;
  reason: string;
  patterns: RegExp[];
}

/** Arabic word not glued to other Arabic letters (\b doesn't work for Arabic) */
const ar = (word: string) => new RegExp(`(?:^|[^\\u0600-\\u06FF])${word}(?:$|[^\\u0600-\\u06FF])`);

const RULES: Rule[] = [
  {
    level: 'high',
    reason: 'بيطلب منك تدفع فلوس (رسوم تسجيل أو اشتراك أو شراء) قبل الشغل',
    patterns: [
      // Directed at the freelancer ("you pay"), not fees that are part of the product being built
      /(?:عليك|لازم|يجب|محتاج) (?:تدفع|دفع) (?:رسوم|مبلغ|اشتراك)/,
      /(?:ادفع|هتدفع|تدفع) (?:رسوم|مبلغ|اشتراك)/,
      /رسوم (?:تسجيل|تفعيل|انضمام) (?:قبل|للبدء|عشان|علشان|للانضمام)/,
      /\b(?:registration|joining|training|activation|starter|onboarding) fee\b/i,
      /\b(?:pay|deposit)\b[^.]{0,30}\b(?:to (?:start|join|get started)|upfront|before (?:starting|you start))\b/i,
      /\bbuy (?:our|the|a) (?:starter )?(?:kit|package|course|software) (?:to|before)\b/i,
    ],
  },
  {
    level: 'high',
    reason: 'بيطلب بيانات حساسة (بطاقة بنكية، أو هوية، أو كود تفعيل)',
    patterns: [
      /(?:صورة|صوره) (?:البطاقة|الهوية|الباسبور|جواز)/,
      /(?:رقم|بيانات) (?:البطاقة|الفيزا|الحساب البنكي)/,
      /(?:كود|رمز) (?:التفعيل|التحقق|الـ ?otp)/i,
      /\b(?:credit card|card) (?:details|number)\b/i,
      /\b(?:bank (?:login|password)|ssn|social security number|otp code|verification code|passport (?:copy|scan))\b/i,
    ],
  },
  {
    level: 'high',
    reason: 'تأجير أو شراء حساب على منصة (ممنوع ويقفل حسابك)',
    patterns: [
      /(?:تأجير|تاجير|استئجار|شراء|بيع) (?:حساب|حسابات)/,
      /\b(?:rent|renting|lease|buy|sell)(?:ing)? (?:your |an? |my )?(?:upwork|freelancer|fiverr|paypal|payoneer|linkedin|verified) ?accounts?\b/i,
      /\baccount (?:rental|rent)\b/i,
    ],
  },
  {
    level: 'high',
    reason: 'الدفع بكريبتو أو كروت هدايا أو شيكات بدل نظام المنصة',
    patterns: [
      /\b(?:paid|payment|pay)\b[^.]{0,25}\b(?:in |with |via )?(?:usdt|bitcoin|btc|crypto|gift ?cards?|cheques?|checks?)\b/i,
      /(?:الدفع|ادفع|هدفع|هيتم الدفع)[^.]{0,20}(?:usdt|بيتكوين|كريبتو|كروت هدايا|شيك)/i,
    ],
  },
  {
    level: 'high',
    reason: 'بيطلب تحكم عن بعد في جهازك (AnyDesk / TeamViewer)',
    patterns: [/\b(?:anydesk|teamviewer|remote desktop access)\b/i, /ريموت (?:على|لجهازك)/],
  },
  {
    level: 'caution',
    reason: 'عايز يكمّل التواصل أو الدفع برا المنصة',
    patterns: [
      // A first-person request ("contact me on WhatsApp"). "التواصل الاجتماعي" (social media),
      // a job duty like "التواصل مع العملاء عبر الواتساب" or a phone number inside an ad script don't count
      /(?:كلمني|كلمنى|راسلني|راسلنى|ابعتلي|ابعتلى|تواصل معي|تواصل معايا|تواصل معى|اتواصل معاك)[^.]{0,25}(?:واتس|تليجرام|تلجرام|برا|خارج)/,
      /(?:الدفع|التعامل|نكمل|نتعامل|نتواصل|التحويل) (?:خارج|برا) (?:المنصة|الموقع)/,
      /\b(?:contact|message|text|reach) me (?:on|via|at) (?:whatsapp|telegram|skype|signal|wechat)\b/i,
      /\b(?:pay(?:ment)?|work|deal|continue|talk)\b[^.]{0,15}\boutside (?:of )?(?:the )?(?:platform|site|upwork|freelancer)\b/i,
    ],
  },
  {
    level: 'caution',
    reason: 'وعود أرباح سهلة وغير واقعية',
    patterns: [
      /(?:اربح|ربح|دخل) (?:يومي|يوميا|يومياً|من البيت)/,
      /بدون (?:خبرة|مجهود)[^.]{0,30}(?:ربح|دخل|دولار)/,
      /\b(?:earn|make) \$?\d+[^.]{0,20}(?:per|a|every) (?:day|hour)\b[^.]{0,40}\b(?:no experience|easy|simple|from home)\b/i,
      /\b(?:get rich|easy money|passive income opportunity)\b/i,
    ],
  },
  {
    level: 'caution',
    reason: 'تقييمات أو مراجعات مزيفة (مخالف لشروط معظم المنصات)',
    patterns: [
      /(?:رفع|زيادة) (?:تقييم|التقييم|تقييمات)/,
      /(?:تقييمات|مراجعات) (?:وهمية|مزيفة)/,
      ar('ريفيوهات'),
      /\b(?:fake|paid) reviews?\b/i,
      /\bwrite (?:\d+ )?(?:positive |5[- ]star )?reviews? for (?:my|our) (?:product|app|business|store)\b/i,
    ],
  },
];

// "بدون دفع اشتراكات", "no registration fee", "don't need to pay": the post rules it out
const NEGATION_BEFORE = /(?:بدون|دون|من غير|مش|لا|ليس|مفيش|without|no|not|never|don'?t|doesn'?t|won'?t)\s+(?:\S+\s+){0,2}$/i;

function matchesWithoutNegation(pattern: RegExp, text: string): boolean {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    // The pattern may start with a separator character (ar()), so look just before the word
    if (!NEGATION_BEFORE.test(text.slice(Math.max(0, at - 25), at + (/^[^؀-ۿa-z]/i.test(m[0]) ? 1 : 0)))) {
      return true;
    }
  }
  return false;
}

/** Checks a project's title + description for scam / risk signs. */
export function detectScam(title: string | null | undefined, description?: string | null): ScamCheck {
  const text = `${title || ''}\n${description || ''}`;
  if (!text.trim()) return { level: 'none', reasons: [] };

  const reasons: string[] = [];
  let level: ScamLevel = 'none';
  for (const rule of RULES) {
    if (rule.patterns.some((p) => matchesWithoutNegation(p, text))) {
      reasons.push(rule.reason);
      if (rule.level === 'high') level = 'high';
      else if (level === 'none') level = 'caution';
    }
  }
  return { level, reasons };
}
