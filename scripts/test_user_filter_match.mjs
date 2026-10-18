// scripts/test_user_filter_match.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env
const envText = fs.readFileSync('.env', 'utf-8');
const env = {};
for (const line of envText.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function testLiveFilterMatching() {
  console.log('🧪 Testing End-to-End Live Filter Matching with Database...\n');

  // 1. Get an existing user or mock user id from auth.users or profiles
  const { data: users, error: uErr } = await supabase.from('profiles').select('id, telegram_chat_id').limit(1);
  const testUserId = users?.[0]?.id || '00000000-0000-0000-0000-000000000001';

  console.log(`Using test subscriber user ID: ${testUserId}`);

  // 2. Insert a test smart filter
  const testFilter = {
    user_id: testUserId,
    filter_name: 'تجربة: مشاريع تطوير الويب والمواقع الكبيرة',
    platforms: ['mostaql', 'nafezly', 'freelancer'],
    categories: ['web_dev'],
    include_keywords: ['موقع', 'تطبيق', 'web', 'react'],
    exclude_keywords: ['ووردبريس', 'wordpress'],
    min_budget_usd: 20,
    is_active: true,
    notify_telegram: false, // Don't spam telegram during unit test
  };

  const { data: insertedFilter, error: fErr } = await supabase
    .from('user_filters')
    .insert(testFilter)
    .select('id')
    .single();

  if (fErr) {
    console.warn('Note on user_filters insert:', fErr.message);
    return;
  }

  const filterId = insertedFilter.id;
  console.log(`✅ Created test filter with ID: ${filterId}`);

  try {
    // 3. Trigger Cron Ingest (without re-scraping all, just match existing pool)
    console.log('🔄 Triggering Cron Ingestion pipeline...');
    const res = await fetch('http://localhost:3000/api/cron/ingest?secret=pinglead_cron_secret_secure_9921&scrape=false');
    const json = await res.json();

    console.log('Cron Ingestion Response:');
    console.log(`   • Active Filters Evaluated: ${json.activeFiltersCount}`);
    console.log(`   • Matches Found: ${json.matchesFound}`);
    console.log(`   • Actions Created: ${json.actionsCreated}`);

    // 4. Query user_project_actions for this filter
    const { data: actions, error: aErr } = await supabase
      .from('user_project_actions')
      .select('id, project_id, status, matched_filter_id, created_at')
      .eq('matched_filter_id', filterId)
      .limit(5);

    if (actions && actions.length > 0) {
      console.log(`\n🎉 Successfully matched and created ${actions.length} project actions in user_project_actions!`);
      for (const a of actions) {
        console.log(`   • Action ID: ${a.id} | Project ID: ${a.project_id} | Status: ${a.status}`);
      }
    } else {
      console.log('No new actions created (likely already existing or no project in current batch satisfied criteria).');
    }
  } finally {
    // 5. Cleanup test filter and associated actions
    await supabase.from('user_project_actions').delete().eq('matched_filter_id', filterId);
    await supabase.from('user_filters').delete().eq('id', filterId);
    console.log('\n🧹 Cleaned up test filter and temporary actions.');
  }
}

testLiveFilterMatching().catch(console.error);
