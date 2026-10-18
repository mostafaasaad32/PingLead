// scripts/test_all_dates.mjs
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const ARABIC_MONTHS = {
  'يناير': 0, 'فبراير': 1, 'مارس': 2, 'أبريل': 3, 'ابريل': 3, 'مايو': 4,
  'يونيو': 5, 'يوليو': 6, 'أغسطس': 7, 'اغسطس': 7, 'سبتمبر': 8,
  'أكتوبر': 9, 'اكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11,
  'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
  'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
};

function parseArabicRelativeDate(arabicText) {
  if (!arabicText) return new Date().toISOString();
  const text = arabicText.trim();
  const now = Date.now();

  // Textual Arabic Date: "17 أكتوبر 2026 الساعة 11:22:51 GMT"
  const arabicDateMatch = text.match(/(\d{1,2})\s+([^\s\d]+)\s+(\d{4})(?:\s+(?:الساعة|at)\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/i);
  if (arabicDateMatch) {
    const day = parseInt(arabicDateMatch[1], 10);
    const monthName = arabicDateMatch[2].replace(/[،,]/g, '').trim().toLowerCase();
    const year = parseInt(arabicDateMatch[3], 10);
    const hour = arabicDateMatch[4] ? parseInt(arabicDateMatch[4], 10) : 0;
    const min = arabicDateMatch[5] ? parseInt(arabicDateMatch[5], 10) : 0;
    const sec = arabicDateMatch[6] ? parseInt(arabicDateMatch[6], 10) : 0;

    if (monthName in ARABIC_MONTHS) {
      const month = ARABIC_MONTHS[monthName];
      const parsedUtc = new Date(Date.UTC(year, month, day, hour, min, sec));
      if (!isNaN(parsedUtc.getTime())) return parsedUtc.toISOString();
    }
  }

  // Standard ISO / UTC: "2026-10-17 11:09:00"
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    if (text.includes('T') || text.includes('Z')) {
      const d = new Date(text);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
    const d = new Date(text.replace(' ', 'T') + 'Z');
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Relative Arabic
  let offsetMs = 0;
  let matched = false;
  const minMatch = text.match(/(\d+)\s*(?:دقيقة|دقائق|دقيق)/);
  if (minMatch) { offsetMs += parseInt(minMatch[1], 10) * 60 * 1000; matched = true; }
  else if (text.includes('دقيقتين')) { offsetMs += 2 * 60 * 1000; matched = true; }
  else if (text.includes('دقيقة')) { offsetMs += 1 * 60 * 1000; matched = true; }

  const hourMatch = text.match(/(\d+)\s*(?:ساعة|ساعات|ساع)/);
  if (hourMatch) { offsetMs += parseInt(hourMatch[1], 10) * 3600 * 1000; matched = true; }
  else if (text.includes('ساعتين')) { offsetMs += 2 * 3600 * 1000; matched = true; }
  else if (text.includes('ساعة')) { offsetMs += 1 * 3600 * 1000; matched = true; }

  const dayMatch = text.match(/(\d+)\s*(?:يوم|أيام|ايام)/);
  if (dayMatch) { offsetMs += parseInt(dayMatch[1], 10) * 86400 * 1000; matched = true; }
  else if (text.includes('يومين')) { offsetMs += 2 * 86400 * 1000; matched = true; }
  else if (text.includes('يوم')) { offsetMs += 1 * 86400 * 1000; matched = true; }

  if (matched) return new Date(now - offsetMs).toISOString();

  // English relative
  const enAgoMatch = text.match(/(\d+)\s*(min|minute|hour|day|week|month)s?\s*ago/i);
  if (enAgoMatch) {
    const val = parseInt(enAgoMatch[1], 10);
    const unit = enAgoMatch[2].toLowerCase();
    let mult = 60 * 1000;
    if (unit.startsWith('hour')) mult = 3600 * 1000;
    else if (unit.startsWith('day')) mult = 86400 * 1000;
    else if (unit.startsWith('week')) mult = 7 * 86400 * 1000;
    else if (unit.startsWith('month')) mult = 30 * 86400 * 1000;
    return new Date(now - val * mult).toISOString();
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();

  return new Date().toISOString();
}

async function testPlatforms() {
  console.log('Testing live date parsing across platforms...\n');

  // 1. Mostaql
  try {
    const r = await fetch('https://mostaql.com/projects?sort=latest', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
    console.log('Mostaql raw:', match ? match[1] : 'NOT FOUND');
    console.log('Mostaql parsed:', match ? parseArabicRelativeDate(match[1]) : 'N/A');
  } catch (e) { console.error('Mostaql err:', e.message); }

  // 2. Nafezly
  try {
    const r = await fetch('https://nafezly.com/projects?sort=latest', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<time[^>]*datetime=["']([^"']+)["']/i) || html.match(/منذ\s+[^<]+/i);
    console.log('\nNafezly raw:', match ? (match[1] || match[0]) : 'NOT FOUND');
    console.log('Nafezly parsed:', match ? parseArabicRelativeDate(match[1] || match[0]) : 'N/A');
  } catch (e) { console.error('Nafezly err:', e.message); }

  // 3. Khamsat
  try {
    const r = await fetch('https://khamsat.com/community/requests', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<time[^>]*datetime=["']([^"']+)["']/i) || html.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
    console.log('\nKhamsat raw:', match ? (match[1] || match[0]) : 'NOT FOUND');
    console.log('Khamsat parsed:', match ? parseArabicRelativeDate(match[1] || match[0]) : 'N/A');
  } catch (e) { console.error('Khamsat err:', e.message); }

  // 4. Kafiil
  try {
    const r = await fetch('https://kafiil.com/projects', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<time[^>]*datetime=["']([^"']+)["']/i) || html.match(/منذ\s+[^<]+/i);
    console.log('\nKafiil raw:', match ? (match[1] || match[0]) : 'NOT FOUND');
    console.log('Kafiil parsed:', match ? parseArabicRelativeDate(match[1] || match[0]) : 'N/A');
  } catch (e) { console.error('Kafiil err:', e.message); }

  // 5. Baeed
  try {
    const r = await fetch('https://baaeed.com/remote-jobs', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
    console.log('\nBaeed raw:', match ? match[1] : 'NOT FOUND');
    console.log('Baeed parsed:', match ? parseArabicRelativeDate(match[1]) : 'N/A');
  } catch (e) { console.error('Baeed err:', e.message); }

  // 6. Freelancer RSS
  try {
    const r = await fetch('https://www.freelancer.com/rss.xml', { headers: { 'User-Agent': USER_AGENT } });
    const xml = await r.text();
    const match = xml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    console.log('\nFreelancer raw:', match ? match[1] : 'NOT FOUND');
    console.log('Freelancer parsed:', match ? parseArabicRelativeDate(match[1]) : 'N/A');
  } catch (e) { console.error('Freelancer err:', e.message); }

  // 7. RemoteOK
  try {
    const r = await fetch('https://remoteok.com/api', { headers: { 'User-Agent': USER_AGENT } });
    const json = await r.json();
    const firstJob = json.find(j => j.date);
    console.log('\nRemoteOK raw:', firstJob?.date);
    console.log('RemoteOK parsed:', firstJob?.date ? parseArabicRelativeDate(firstJob.date) : 'N/A');
  } catch (e) { console.error('RemoteOK err:', e.message); }

  // 8. PeoplePerHour
  try {
    const r = await fetch('https://www.peopleperhour.com/freelance-jobs', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<time[^>]*>([\s\S]*?)<\/time>/i) || html.match(/(\d+\s*(?:mins?|hours?|days?)\s*ago)/i);
    console.log('\nPeoplePerHour raw:', match ? (match[1] || match[0]) : 'NOT FOUND');
    console.log('PeoplePerHour parsed:', match ? parseArabicRelativeDate(match[1] || match[0]) : 'N/A');
  } catch (e) { console.error('PPH err:', e.message); }

  // 9. WeWorkRemotely RSS
  try {
    const r = await fetch('https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss', { headers: { 'User-Agent': USER_AGENT } });
    const xml = await r.text();
    const match = xml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    console.log('\nWeWorkRemotely raw:', match ? match[1] : 'NOT FOUND');
    console.log('WeWorkRemotely parsed:', match ? parseArabicRelativeDate(match[1]) : 'N/A');
  } catch (e) { console.error('WWR err:', e.message); }
}

testPlatforms();
