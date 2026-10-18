// scripts/verify_all_source_dates.mjs
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

async function testPlatformAuthenticDates() {
  console.log('=== VERIFYING AUTHENTIC SOURCE DATES ACROSS PLATFORMS ===\n');

  // 1. Mostaql
  try {
    const r = await fetch('https://mostaql.com/projects?sort=latest', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i);
    console.log('[MOSTAQL] Listing:');
    console.log('   Datetime attr:', match ? match[1] : 'NONE');
    console.log('   Text content:', match ? match[2].replace(/\s+/g, ' ').trim() : 'NONE');
  } catch (e) { console.error('Mostaql error:', e.message); }

  // 2. Baeed
  try {
    const r = await fetch('https://baaeed.com/remote-jobs', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/i);
    console.log('\n[BAEED] Listing:');
    console.log('   Datetime attr:', match ? match[1] : 'NONE');
    console.log('   Text content:', match ? match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : 'NONE');
  } catch (e) { console.error('Baeed error:', e.message); }

  // 3. Khamsat
  try {
    const r = await fetch('https://khamsat.com/community/requests', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/title=["'](\d{1,2}(?:&#x2F;|\/)\d{1,2}(?:&#x2F;|\/)\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}[^"']*)["'][^>]*>([\s\S]*?)<\/span>/i);
    console.log('\n[KHAMSAT] Listing:');
    console.log('   Title attr:', match ? match[1] : 'NONE');
    console.log('   Text content:', match ? match[2].replace(/\s+/g, ' ').trim() : 'NONE');
  } catch (e) { console.error('Khamsat error:', e.message); }

  // 4. Kafiil
  try {
    const r = await fetch('https://kafiil.com/projects', { headers: { 'User-Agent': USER_AGENT } });
    const html = await r.text();
    const match = html.match(/<i class="far fa-clock"><\/i>([\s\S]*?)<\/span>/i);
    console.log('\n[KAFIIL] Listing:');
    console.log('   Text content:', match ? match[1].replace(/\s+/g, ' ').trim() : 'NONE');
  } catch (e) { console.error('Kafiil error:', e.message); }

  // 5. Nafezly (Check BOTH feed and listing page!)
  try {
    const feedR = await fetch('https://nafezly.com/feed', { headers: { 'User-Agent': USER_AGENT } });
    const feedXml = await feedR.text();
    const feedItem = feedXml.match(/<item>([\s\S]*?)<\/item>/i);
    const feedPubDate = feedItem ? feedItem[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/i) : null;
    const feedLink = feedItem ? feedItem[1].match(/<link>([\s\S]*?)<\/link>/i) : null;
    console.log('\n[NAFEZLY RSS FEED]:');
    console.log('   Link:', feedLink ? feedLink[1].trim() : 'NONE');
    console.log('   pubDate:', feedPubDate ? feedPubDate[1].trim() : 'NONE');

    const htmlR = await fetch('https://nafezly.com/projects?sort=latest', { headers: { 'User-Agent': USER_AGENT } });
    const html = await htmlR.text();
    const pMatch = html.match(/href="(https:\/\/nafezly\.com\/project\/(\d+)[^"]*)"/i);
    let htmlClock = 'NONE';
    if (pMatch) {
      const card = html.slice(pMatch.index, pMatch.index + 4500);
      const clockIdx = card.indexOf('fa-clock');
      if (clockIdx !== -1) {
        htmlClock = card.slice(clockIdx, clockIdx + 200).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      }
    }
    console.log('[NAFEZLY HTML LISTING]:');
    console.log('   Link:', pMatch ? pMatch[1] : 'NONE');
    console.log('   Clock text:', htmlClock);
  } catch (e) { console.error('Nafezly error:', e.message); }

  // 6. Freelancer API
  try {
    const r = await fetch('https://www.freelancer.com/api/projects/0.1/projects/active?limit=1&compact=true', { headers: { 'User-Agent': USER_AGENT } });
    const json = await r.json();
    const p = json.result?.projects?.[0];
    console.log('\n[FREELANCER API]:');
    console.log('   Title:', p?.title);
    console.log('   submitdate epoch:', p?.submitdate);
    console.log('   submitdate ISO:', p?.submitdate ? new Date(p.submitdate * 1000).toISOString() : 'NONE');
  } catch (e) { console.error('Freelancer error:', e.message); }
}

testPlatformAuthenticDates();
