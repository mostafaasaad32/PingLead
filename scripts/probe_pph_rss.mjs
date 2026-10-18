// scratch/probe_pph_rss.mjs
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function probe() {
  const res = await fetch('https://www.peopleperhour.com/freelance-jobs?feed=rss', {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
    }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Length:', text.length);
  console.log('Preview:', text.slice(0, 300));
  // Match items
  const items = text.match(/<item>[\s\S]*?<\/item>/gi) || [];
  console.log('Items found:', items.length);
  if (items.length > 0) {
    console.log('First item:', items[0]);
  }
}
probe();
