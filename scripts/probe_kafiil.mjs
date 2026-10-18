async function probe() {
  const res = await fetch('https://kafiil.com/projects', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const matches = [...html.matchAll(/<i class="far fa-clock"><\/i>([\s\S]*?)<\/span>/gi)];
  console.log('Kafiil clock matches count:', matches.length);
  matches.slice(0, 5).forEach((m, i) => console.log(i + 1, m[1].replace(/<[^>]*>/g, '').trim()));

  const agoMatches = [...html.matchAll(/(منذ\s+[^<]+)/gi)].slice(0, 5);
  console.log('Kafiil ago matches:');
  agoMatches.forEach((m, i) => console.log(i + 1, m[0]));
}
probe().catch(console.error);
