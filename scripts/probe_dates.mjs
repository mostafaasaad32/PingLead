import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync('.env', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();
const sb = createClient(url, key);

async function inspect() {
  const { data } = await sb
    .from('leads_pool')
    .select('id, platform, post_url, published_at, created_at, post_text')
    .order('published_at', { ascending: false })
    .limit(10);

  console.log('Top 10 leads by published_at:');
  data.forEach((d, idx) => {
    console.log((idx + 1) + '. [Published: ' + d.published_at + '] [Created: ' + d.created_at + '] (' + d.platform + ')');
    console.log('   URL: ' + d.post_url);
    console.log('   Title: ' + d.post_text.slice(0, 90).replace(/\n/g, ' ') + '\n');
  });
}
inspect().catch(console.error);
