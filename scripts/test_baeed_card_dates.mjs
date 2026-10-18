// scratch/test_baeed_card_dates.mjs
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function testBaeed() {
  const res = await fetch('https://baaeed.com/categories/remote-programming-jobs', {
    headers: { 'User-Agent': USER_AGENT }
  });
  const html = await res.text();
  const jobRegex = /href="(https:\/\/baaeed\.com\/remote-jobs\/([^"]+))"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  let count = 0;
  while ((match = jobRegex.exec(html)) !== null && count < 5) {
    count++;
    const subHtml = html.slice(match.index, match.index + 1200);
    const agoMatch = subHtml.match(/data-html="true">\s*(منذ\s+[^<]+)/i) || subHtml.match(/(منذ\s+[^<]+)/i);
    console.log({
      url: match[1],
      ago: agoMatch ? agoMatch[1].replace(/\s+/g, ' ').trim() : null
    });
  }
}

testBaeed();
