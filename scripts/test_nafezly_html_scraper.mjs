// scripts/test_nafezly_html_scraper.mjs
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

async function testNafezlyHtmlScraping() {
  console.log('Fetching https://nafezly.com/projects?sort=latest ...');
  const res = await fetch('https://nafezly.com/projects?sort=latest', {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ar,en;q=0.9',
    }
  });

  const html = await res.text();
  
  const projectRegex = /<a[^>]*href="(https:\/\/nafezly\.com\/project\/(\d+)-([^\"]+))"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  const projects = [];
  const seenIds = new Set();

  while ((match = projectRegex.exec(html)) !== null && projects.length < 20) {
    const url = match[1];
    const id = match[2];
    const title = match[4].replace(/<[^>]*>/g, '').trim();

    if (!title || seenIds.has(id)) continue;
    seenIds.add(id);

    const cardContext = html.slice(match.index, match.index + 7000);

    // Extract description (inside <h3 class="naskh ...">)
    const descMatch = cardContext.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const desc = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : title;

    // Extract clock relative time: <span class="fal fa-clock"...></span> منذ ...
    const clockMatch = cardContext.match(/fa-clock[^>]*><\/span>\s*([^<\n\r]+)/i) || cardContext.match(/fa-clock[\s\S]{0,100}?(منذ\s+[^<\n\r]+)/i);
    let clockText = clockMatch ? clockMatch[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : null;

    // Extract budget
    const budgetMatch = cardContext.match(/(\d+\s*-\s*\d+\s*\$|\d+\s*\$)/i);
    const budget = budgetMatch ? budgetMatch[1].trim() : null;

    projects.push({
      id,
      title,
      url,
      budget,
      clockText,
    });
  }

  console.log(`Extracted ${projects.length} projects directly from Nafezly HTML:`);
  for (const p of projects) {
    console.log(`[${p.id}] ${p.title.slice(0, 50)} | Clock: ${p.clockText}`);
  }
}

testNafezlyHtmlScraping().catch(console.error);
