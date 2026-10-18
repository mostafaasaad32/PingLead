// scripts/debug_nafezly_times.mjs
async function inspectNafezly() {
  console.log('Inspecting https://nafezly.com/projects?sort=latest ...');
  const res = await fetch('https://nafezly.com/projects?sort=latest', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });
  const html = await res.text();
  
  // Find project cards
  const projectRegex = /href="(https:\/\/nafezly\.com\/project\/(\d+)[^"]*)"/gi;
  let match;
  let count = 0;
  const seen = new Set();
  while ((match = projectRegex.exec(html)) !== null && count < 8) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    count++;
    const url = match[1];
    const id = match[2];
    const idx = match.index;
    const cardHtml = html.slice(idx, idx + 4500);
    
    // Find clock icon
    const clockIdx = cardHtml.indexOf('fa-clock');
    let clockText = 'NOT FOUND';
    if (clockIdx !== -1) {
      const clockSnippet = cardHtml.slice(clockIdx, clockIdx + 200);
      clockText = clockSnippet.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
    console.log(`\nNafezly Project #${count} [ID: ${id}]`);
    console.log(`  URL: ${url}`);
    console.log(`  Clock text: ${clockText}`);
  }
}

inspectNafezly().catch(console.error);
