// scripts/test_scraper_time.mjs
async function testKafiilProjectPage() {
  const res = await fetch('https://kafiil.com/projects', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await res.text();
  const match = html.match(/href="(https:\/\/kafiil\.com\/project\/(\d+)[^"]*)"/i);
  if (match) {
    console.log('Fetching Kafiil single project:', match[1]);
    const pRes = await fetch(match[1], { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const pHtml = await pRes.text();
    const clockMatches = [...pHtml.matchAll(/fa-clock[\s\S]{0,100}/gi)];
    console.log('Clock in project page:', clockMatches.map(m => m[0]));
    const timeMatches = [...pHtml.matchAll(/<time[^>]*>([\s\S]*?)<\/time>/gi)];
    console.log('Time tags in project page:', timeMatches.map(m => m[0]));
  }
}

testKafiilProjectPage().catch(console.error);
