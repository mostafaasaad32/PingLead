// scripts/trigger_cron.mjs
async function run() {
  console.log('Calling /api/cron/ingest on running dev server...');
  const res = await fetch('http://localhost:3000/api/cron/ingest?secret=pinglead_cron_secret_secure_9921&scrape=true');
  const json = await res.json();
  console.log('Cron Ingest Result:', JSON.stringify(json, null, 2));
}

run();
