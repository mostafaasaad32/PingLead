// scripts/clean_and_refresh_leads.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Parse .env
const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    env[k] = v;
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanAndRefresh() {
  console.log('🧹 Cleaning out legacy/corrupted leads from leads_pool...');

  // 1. Delete old Nafezly leads that were poisoned with fake RSS feed timestamps
  const { data: nafezlyRows, error: nErr } = await supabase
    .from('leads_pool')
    .delete()
    .eq('platform', 'nafezly')
    .select('id');

  console.log(`✅ Removed ${nafezlyRows?.length || 0} old Nafezly rows from leads_pool.`);

  // 2. Also remove legacy social platforms (reddit, twitter, linkedin) if any remain
  const { data: socialRows } = await supabase
    .from('leads_pool')
    .delete()
    .in('platform', ['reddit', 'twitter', 'linkedin'])
    .select('id');

  if (socialRows?.length) {
    console.log(`✅ Removed ${socialRows.length} legacy social rows.`);
  }

  // 3. Now trigger fresh ingestion via API endpoint
  console.log('\n🚀 Triggering fresh ingestion cycle from all 9 platforms with authentic timestamps...');
  const res = await fetch('http://localhost:3000/api/cron/ingest?secret=pinglead_cron_secret_secure_9921&scrape=true');
  const json = await res.json();
  console.log('Ingestion completed! Status:', json.ok);

  // 4. Verify the top 20 leads now in DB
  const { data: latestLeads, error: lErr } = await supabase
    .from('leads_pool')
    .select('platform, post_url, published_at, post_text')
    .order('published_at', { ascending: false })
    .limit(20);

  if (lErr) console.error('Error fetching latest leads:', lErr);

  console.log('\n📋 TOP 20 LEADS IN DATABASE WITH AUTHENTIC TIMESTAMPS:');
  const now = Date.now();
  for (const l of (latestLeads || [])) {
    const pub = new Date(l.published_at);
    const diffMins = Math.floor((now - pub.getTime()) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    let ago = `${diffMins}m ago`;
    if (diffHours >= 1) ago = `${diffHours}h ${diffMins % 60}m ago`;
    console.log(`[${l.platform.toUpperCase().padEnd(10)}] (${ago.padEnd(12)}) Pub: ${l.published_at} | ${l.post_text.split('\n')[0].slice(0, 50)}`);
  }
}

cleanAndRefresh().catch(console.error);
