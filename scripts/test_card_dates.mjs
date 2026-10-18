// scratch/test_card_dates.mjs
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function testMostaqlCardDates() {
  console.log('=== Mostaql Card Dates ===');
  const res = await fetch('https://mostaql.com/projects?category=development&sort=latest', {
    headers: { 'User-Agent': USER_AGENT }
  });
  const html = await res.text();
  // Mostaql project rows are <tr class="project-row" ...>
  // Or match from <h2 class="mrg--bt-reset"><a href="(...)">(...)</a>
  // to the next <time datetime="(...)">
  const projectRegex = /<h2 class="mrg--bt-reset">\s*<a\s+href="(https:\/\/mostaql\.com\/project\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  let count = 0;
  while ((match = projectRegex.exec(html)) !== null && count < 4) {
    count++;
    const subHtml = html.slice(match.index, match.index + 1500);
    const timeMatch = subHtml.match(/<time[^>]*datetime=["']([^"']+)["']/i);
    const agoMatch = subHtml.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
    console.log({
      id: match[2],
      title: match[3].replace(/<[^>]*>/g, '').trim(),
      datetime: timeMatch ? timeMatch[1] : null,
      ago: agoMatch ? agoMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : null
    });
  }
}

async function testKhamsatCardDates() {
  console.log('\n=== Khamsat Card Dates ===');
  const res = await fetch('https://khamsat.com/community/requests', {
    headers: { 'User-Agent': USER_AGENT }
  });
  const html = await res.text();
  const regex = /href=["'](\/community\/requests\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  let count = 0;
  while ((match = regex.exec(html)) !== null && count < 4) {
    count++;
    const subHtml = html.slice(match.index, match.index + 1200);
    const agoMatch = subHtml.match(/(منذ\s+[^<]+)/i);
    console.log({
      id: match[2],
      title: match[3].replace(/<[^>]*>/g, '').trim(),
      ago: agoMatch ? agoMatch[1].replace(/\s+/g, ' ').trim() : null
    });
  }
}

async function testKafiilCardDates() {
  console.log('\n=== Kafiil Card Dates ===');
  const res = await fetch('https://kafiil.com/projects', {
    headers: { 'User-Agent': USER_AGENT }
  });
  const html = await res.text();
  const projectRegex = /<a\s+href="(https:\/\/kafiil\.com\/project\/(\d+)-[^"]*)"\s+class="name\s+bold-text[^"]*">([\s\S]*?)<\/a>/gi;
  let match;
  let count = 0;
  while ((match = projectRegex.exec(html)) !== null && count < 4) {
    count++;
    const subHtml = html.slice(match.index, match.index + 1200);
    const agoMatch = subHtml.match(/<i class="far fa-clock"><\/i>\s*([\s\S]*?)<\/span>/i);
    console.log({
      id: match[2],
      ago: agoMatch ? agoMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : null
    });
  }
}

async function run() {
  await testMostaqlCardDates();
  await testKhamsatCardDates();
  await testKafiilCardDates();
}
run();
