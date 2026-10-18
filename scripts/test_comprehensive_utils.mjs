// scripts/test_comprehensive_utils.mjs
const ARABIC_MONTHS = {
  'يناير': 0, 'كانون الثاني': 0, 'january': 0, 'jan': 0,
  'فبراير': 1, 'شباط': 1, 'february': 1, 'feb': 1,
  'مارس': 2, 'آذار': 2, 'اذار': 2, 'march': 2, 'mar': 2,
  'أبريل': 3, 'ابريل': 3, 'نيسان': 3, 'april': 3, 'apr': 3,
  'مايو': 4, 'أيار': 4, 'ايار': 4, 'may': 4,
  'يونيو': 5, 'حزيران': 5, 'june': 5, 'jun': 5,
  'يوليو': 6, 'تموز': 6, 'july': 6, 'jul': 6,
  'أغسطس': 7, 'اغسطس': 7, 'آب': 7, 'اب': 7, 'august': 7, 'aug': 7,
  'سبتمبر': 8, 'أيلول': 8, 'ايلول': 8, 'september': 8, 'sep': 8,
  'أكتوبر': 9, 'اكتوبر': 9, 'تشرين الأول': 9, 'تشرين الاول': 9, 'october': 9, 'oct': 9,
  'نوفمبر': 10, 'تشرين الثاني': 10, 'november': 10, 'nov': 10,
  'ديسمبر': 11, 'كانون الأول': 11, 'كانون الاول': 11, 'december': 11, 'dec': 11,
};

function parseArabicRelativeDate(arabicText) {
  if (!arabicText) return new Date().toISOString();

  let text = String(arabicText).trim();
  text = text.replace(/&#x2F;/gi, '/').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"');
  const now = Date.now();

  // 1. Numeric DD/MM/YYYY with time (e.g. Khamsat: "17/10/2026 09:21:10 GMT" or "17/10/2026 09:21:10")
  const dmyMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    const parsedUtc = new Date(Date.UTC(year, month, day, hour, min, sec));
    if (!isNaN(parsedUtc.getTime())) {
      return parsedUtc.toISOString();
    }
  }

  // 2. Textual Date with Month Name (e.g. Baeed: "17 أكتوبر 2026 الساعة 11:22:51 GMT" or "Sat, 17 Oct 2026 11:45:22 GMT")
  const textualDateMatch = text.match(/(\d{1,2})\s+([^\s\d]+)\s+(\d{4})(?:\s+(?:الساعة|at)?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/i);
  if (textualDateMatch) {
    const day = parseInt(textualDateMatch[1], 10);
    const monthName = textualDateMatch[2].replace(/[،,]/g, '').trim().toLowerCase();
    const year = parseInt(textualDateMatch[3], 10);
    const hour = textualDateMatch[4] ? parseInt(textualDateMatch[4], 10) : 0;
    const min = textualDateMatch[5] ? parseInt(textualDateMatch[5], 10) : 0;
    const sec = textualDateMatch[6] ? parseInt(textualDateMatch[6], 10) : 0;

    if (monthName in ARABIC_MONTHS) {
      const month = ARABIC_MONTHS[monthName];
      const parsedUtc = new Date(Date.UTC(year, month, day, hour, min, sec));
      if (!isNaN(parsedUtc.getTime())) {
        return parsedUtc.toISOString();
      }
    }
  }

  // 3. Standard ISO / UTC Datetime (e.g. Mostaql: "2026-10-17 11:09:00" or "2026-10-17T11:09:00Z")
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    if (text.includes('T') || text.includes('Z')) {
      const d = new Date(text);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(text.replace(' ', 'T') + 'Z');
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 4. UNIX timestamp in seconds (Freelancer API)
  if (/^\d{10}$/.test(text)) {
    const d = new Date(parseInt(text, 10) * 1000);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // 5. Accumulate Compound Relative Arabic Offsets (Khamsat, Kafiil, Mostaql)
  let offsetMs = 0;
  let matched = false;

  // Minutes: "10 دقائق", "دقيقة", "دقيقتين"
  const minMatch = text.match(/(\d+)\s*(?:دقيقة|دقائق|دقيق)/);
  if (minMatch) {
    offsetMs += parseInt(minMatch[1], 10) * 60 * 1000;
    matched = true;
  } else if (text.includes('دقيقتين')) {
    offsetMs += 2 * 60 * 1000;
    matched = true;
  } else if (text.includes('دقيقة')) {
    offsetMs += 1 * 60 * 1000;
    matched = true;
  }

  // Hours: "3 ساعات", "ساعة", "ساعتين"
  const hourMatch = text.match(/(\d+)\s*(?:ساعة|ساعات|ساع)/);
  if (hourMatch) {
    offsetMs += parseInt(hourMatch[1], 10) * 3600 * 1000;
    matched = true;
  } else if (text.includes('ساعتين')) {
    offsetMs += 2 * 3600 * 1000;
    matched = true;
  } else if (text.includes('ساعة')) {
    offsetMs += 1 * 3600 * 1000;
    matched = true;
  }

  // Days: "6 أيام", "يوم", "يومين"
  const dayMatch = text.match(/(\d+)\s*(?:يوم|أيام|ايام)/);
  if (dayMatch) {
    offsetMs += parseInt(dayMatch[1], 10) * 86400 * 1000;
    matched = true;
  } else if (text.includes('يومين')) {
    offsetMs += 2 * 86400 * 1000;
    matched = true;
  } else if (text.includes('يوم')) {
    offsetMs += 1 * 86400 * 1000;
    matched = true;
  }

  // Weeks: "أسبوع", "أسبوعين", "3 أسابيع"
  const weekMatch = text.match(/(\d+)\s*(?:أسبوع|اسبوع|أسابيع|اسابيع)/);
  if (weekMatch) {
    offsetMs += parseInt(weekMatch[1], 10) * 7 * 86400 * 1000;
    matched = true;
  } else if (text.includes('أسبوعين') || text.includes('اسبوعين')) {
    offsetMs += 14 * 86400 * 1000;
    matched = true;
  } else if (text.includes('أسبوع') || text.includes('اسبوع')) {
    offsetMs += 7 * 86400 * 1000;
    matched = true;
  }

  // Months: "شهر", "شهرين", "3 أشهر"
  const monthMatch = text.match(/(\d+)\s*(?:شهر|شهور|أشهر|اشهر)/);
  if (monthMatch) {
    offsetMs += parseInt(monthMatch[1], 10) * 30 * 86400 * 1000;
    matched = true;
  } else if (text.includes('شهرين')) {
    offsetMs += 60 * 86400 * 1000;
    matched = true;
  } else if (text.includes('شهر')) {
    offsetMs += 30 * 86400 * 1000;
    matched = true;
  }

  if (matched) {
    return new Date(now - offsetMs).toISOString();
  }

  // 6. English relative formats ("2 hours ago", "10 minutes ago", "yesterday")
  const enAgoMatch = text.match(/(\d+)\s*(min|minute|hour|day|week|month)s?\s*ago/i);
  if (enAgoMatch) {
    const val = parseInt(enAgoMatch[1], 10);
    const unit = enAgoMatch[2].toLowerCase();
    let multiplier = 60 * 1000;
    if (unit.startsWith('hour')) multiplier = 3600 * 1000;
    else if (unit.startsWith('day')) multiplier = 86400 * 1000;
    else if (unit.startsWith('week')) multiplier = 7 * 86400 * 1000;
    else if (unit.startsWith('month')) multiplier = 30 * 86400 * 1000;
    return new Date(now - val * multiplier).toISOString();
  }

  if (/yesterday/i.test(text)) {
    return new Date(now - 86400 * 1000).toISOString();
  }

  // 7. RFC 2822 or standard parseable string
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return new Date().toISOString();
}

const tests = [
  { name: 'Khamsat HTML Entity GMT', input: '17&#x2F;10&#x2F;2026 09:21:10 GMT', expected: '2026-10-17T09:21:10.000Z' },
  { name: 'Khamsat Slash GMT', input: '17/10/2026 09:21:10 GMT', expected: '2026-10-17T09:21:10.000Z' },
  { name: 'Baeed Textual Arabic GMT', input: '17 أكتوبر 2026 الساعة 11:22:51 GMT', expected: '2026-10-17T11:22:51.000Z' },
  { name: 'Mostaql UTC Datetime', input: '2026-10-17 11:51:47', expected: '2026-10-17T11:51:47.000Z' },
  { name: 'Nafezly / WWR RSS RFC 2822', input: 'Sat, 17 Oct 2026 11:45:22 GMT', expected: '2026-10-17T11:45:22.000Z' },
  { name: 'Freelancer Epoch', input: '1760699935', expected: new Date(1760699935000).toISOString() },
  { name: 'Khamsat Compound Arabic', input: 'منذ ساعتين و28 دقيقة', checkDelta: (2 * 3600 + 28 * 60) * 1000 },
  { name: 'Kafiil Relative Hours', input: 'منذ 20 ساعة', checkDelta: 20 * 3600 * 1000 },
  { name: 'PPH English Relative', input: '8 hours ago', checkDelta: 8 * 3600 * 1000 },
];

let allPassed = true;
for (const t of tests) {
  const result = parseArabicRelativeDate(t.input);
  if (t.expected) {
    if (result === t.expected) {
      console.log(`✅ [${t.name}] PASS: ${result}`);
    } else {
      console.error(`❌ [${t.name}] FAIL: Expected ${t.expected}, Got ${result}`);
      allPassed = false;
    }
  } else if (t.checkDelta) {
    const diff = Date.now() - new Date(result).getTime();
    if (Math.abs(diff - t.checkDelta) < 1000) {
      console.log(`✅ [${t.name}] PASS: matched ~${t.checkDelta / 1000}s offset`);
    } else {
      console.error(`❌ [${t.name}] FAIL: Diff was ${diff}, Expected ~${t.checkDelta}`);
      allPassed = false;
    }
  }
}

if (allPassed) console.log('\n🎉 ALL 9 TEST CASES PASSED WITH 100% ACCURACY!');
