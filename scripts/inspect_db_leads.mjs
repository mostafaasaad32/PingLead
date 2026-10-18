// scripts/inspect_db_leads.mjs
import { supabaseAdmin } from '../src/lib/supabase/admin.ts';

async function inspect() {
  const { data, error } = await supabaseAdmin
    .from('leads_pool')
    .select('id, platform, post_url, published_at, created_at, post_text')
    .in('platform', ['mostaql', 'nafezly', 'khamsat', 'kafiil', 'baeed', 'freelancer', 'remoteok', 'pph', 'wwr'])
    .order('published_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('DB Error:', error);
    return;
  }

  console.log(`Retrieved ${data.length} freelance leads from DB:`);
  for (const l of data) {
    const pub = l.published_at ? new Date(l.published_at) : null;
    const cre = l.created_at ? new Date(l.created_at) : null;
    const isSame = pub && cre && Math.abs(pub.getTime() - cre.getTime()) < 1000;
    console.log(`[${l.platform.toUpperCase()}]`);
    console.log(`   Published At: ${l.published_at} ${isSame ? '⚠️ (SAME AS CREATED_AT)' : '✅'}`);
    console.log(`   Created At:   ${l.created_at}`);
    console.log(`   Title:        ${l.post_text.split('\n')[0]}`);
    console.log(`   URL:          ${l.post_url}`);
  }
}

inspect();
