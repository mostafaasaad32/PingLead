// scripts/check_live_api.mjs
async function run() {
  const res = await fetch('http://localhost:3000/api/leads?limit=30&sort_by=newest');
  const json = await res.json();
  console.log(`Fetched ${json.leads?.length || 0} leads from API.`);
  for (const l of (json.leads || [])) {
    const pub = l.published_at ? new Date(l.published_at) : null;
    const cre = l.created_at ? new Date(l.created_at) : null;
    const isSame = pub && cre && Math.abs(pub.getTime() - cre.getTime()) < 3000;
    console.log(`[${l.platform.toUpperCase()}] Pub: ${l.published_at} | Created: ${l.created_at} ${isSame ? '⚠️ SCRAMBLED/DEFAULT' : '✅ REAL'}`);
    console.log(`   Title: ${l.post_text?.split('\n')[0]}`);
    console.log(`   URL:   ${l.post_url}`);
  }
}
run();
