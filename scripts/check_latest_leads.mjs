import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, key);

async function check() {
  const { data } = await sb
    .from('leads_pool')
    .select('id, platform, post_url, post_text, intent_score, status')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('--- 10 Most Recent Leads in Database ---');
  data.forEach((d, idx) => {
    const domain = d.post_url ? new URL(d.post_url).hostname : 'unknown';
    console.log(`${idx + 1}. [${d.intent_score}/10] [${d.status}] (${domain})`);
    console.log(`   ${d.post_text.slice(0, 90).replace(/\n/g, ' ')}...`);
    console.log(`   URL: ${d.post_url}\n`);
  });
}

check();
