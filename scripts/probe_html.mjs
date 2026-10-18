async function probe() {
  const res = await fetch('https://mostaql.com/projects?sort=latest', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const h2Idx = html.indexOf('<h2 class="mrg--bt-reset"');
  console.log('--- 400 chars BEFORE H2 ---');
  console.log(html.slice(Math.max(0, h2Idx - 400), h2Idx));
  console.log('--- 1200 chars AFTER H2 ---');
  console.log(html.slice(h2Idx, h2Idx + 1200));
}
probe().catch(console.error);
