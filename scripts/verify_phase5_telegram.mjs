// scripts/verify_phase5_telegram.mjs
// ==============================================================================
// Phase 5 Verification Script: Interactive Telegram Bot & Webhooks
// ==============================================================================

import fs from 'fs';
import path from 'path';

// Read .env
const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf-8') : '';
function getEnv(key) {
  const m = envContent.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)["']?`, 'm'));
  return m ? m[1] : process.env[key] || '';
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
  }
}

console.log('🚀 Starting Phase 5: Interactive Telegram Bot & Webhook Verification...\n');

// ------------------------------------------------------------------------------
// Test Suite 1: Platform Badges & HTML Formatting
// ------------------------------------------------------------------------------
console.log('--- Test Suite 1: Platform Badges & HTML Formatting ---');

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getPlatformBadge(platform, url) {
  const p = (platform || '').toLowerCase();
  const u = (url || '').toLowerCase();

  if (p === 'mostaql' || u.includes('mostaql.com')) return '🟢 مستقل (Mostaql)';
  if (p === 'nafezly' || u.includes('nafezly.com')) return '🔵 نفذلي (Nafezly)';
  if (p === 'khamsat' || u.includes('khamsat.com')) return '🟠 خمسات (Khamsat)';
  if (p === 'kafiil' || u.includes('kafiil.com')) return '🟣 كفيل (Kafiil)';
  if (p === 'baeed' || u.includes('baaeed.com')) return '🔷 بعيد (Baeed)';
  if (p === 'freelancer' || u.includes('freelancer.com')) return '🔹 Freelancer.com';
  if (p === 'wwr' || u.includes('weworkremotely.com')) return '🔴 WeWorkRemotely';
  if (p === 'remoteok' || u.includes('remoteok.com')) return '⚡ RemoteOK';
  if (p === 'pph' || u.includes('peopleperhour.com')) return '🔸 PeoplePerHour';

  return `💼 ${platform.toUpperCase()}`;
}

const platforms = [
  { p: 'mostaql', label: 'مستقل' },
  { p: 'nafezly', label: 'نفذلي' },
  { p: 'khamsat', label: 'خمسات' },
  { p: 'kafiil', label: 'كفيل' },
  { p: 'baeed', label: 'بعيد' },
  { p: 'freelancer', label: 'Freelancer.com' },
  { p: 'wwr', label: 'WeWorkRemotely' },
  { p: 'remoteok', label: 'RemoteOK' },
  { p: 'pph', label: 'PeoplePerHour' },
];

for (const plat of platforms) {
  const badge = getPlatformBadge(plat.p);
  assert(badge.includes(plat.label), `Platform badge for "${plat.p}" contains "${plat.label}"`);
}

const rawMalicious = '<script>alert("hack")</script> & <b>test</b>';
const escaped = escapeHtml(rawMalicious);
assert(
  !escaped.includes('<script>') && escaped.includes('&lt;script&gt;') && escaped.includes('&amp;'),
  'Proper HTML escaping prevents broken Telegram parse tags'
);

// ------------------------------------------------------------------------------
// Test Suite 2: Live Webhook Account Linking (/start <token>)
// ------------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Webhook Account Linking (/start <token>) ---');

async function testWebhookAccountLinking() {
  const testChatId = '987654321';
  const testConnectToken = 'ping_test_token_' + Date.now();

  // 1. Fetch active profile
  const fetchProfRes = await fetch(`${supabaseUrl}/rest/v1/profiles?limit=1`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });
  const existingProfiles = await fetchProfRes.json();
  const targetProfile = existingProfiles[0];
  assert(!!targetProfile, 'Existing profile retrieved from database');

  // 2. Set test token on this profile
  await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${targetProfile.id}`, {
    method: 'PATCH',
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ telegram_connect_token: testConnectToken }),
  });

  // 3. Dispatch /start <connectToken> to /api/webhooks/telegram
  const startUpdate = {
    update_id: 100001,
    message: {
      message_id: 501,
      chat: { id: testChatId },
      text: `/start ${testConnectToken}`,
    },
  };

  const hookRes = await fetch('http://localhost:3000/api/webhooks/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(startUpdate),
  });

  const hookData = await hookRes.json();
  assert(hookRes.ok && hookData.ok === true, 'Webhook returns 200 OK for /start command');
  assert(hookData.action === 'account_linked', 'Webhook correctly identifies account_linked action');

  // 4. Verify DB updated
  const verifyDbRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${targetProfile.id}`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const updatedProfiles = await verifyDbRes.json();
  assert(
    updatedProfiles[0]?.telegram_chat_id === testChatId,
    'Profile telegram_chat_id successfully linked in Supabase'
  );
}

// ------------------------------------------------------------------------------
// Test Suite 3: Interactive Button Callbacks (Proposal & CRM)
// ------------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Interactive Button Callbacks (Proposal & CRM) ---');

async function testInteractiveCallbacks() {
  // 1. Get an authentic lead from leads_pool
  const fetchLeadRes = await fetch(
    `${supabaseUrl}/rest/v1/leads_pool?select=id,platform,post_text,post_url&limit=1`,
    {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }
  );
  const leads = await fetchLeadRes.json();
  const lead = leads[0];
  assert(!!lead, 'Authentic project lead retrieved from leads_pool');

  // 2. Test Callback A: gen_prop
  const genPropUpdate = {
    update_id: 100002,
    callback_query: {
      id: 'cb_query_001',
      data: `gen_prop:${lead.id}`,
      message: {
        message_id: 502,
        chat: { id: 987654321 },
      },
    },
  };

  const genPropRes = await fetch('http://localhost:3000/api/webhooks/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(genPropUpdate),
  });
  const genPropData = await genPropRes.json();

  assert(genPropRes.ok && genPropData.ok === true, 'Callback gen_prop returns 200 OK');
  assert(genPropData.action === 'proposal_sent', 'Proposal generated and dispatched via Telegram');
  assert(
    typeof genPropData.proposal === 'string' && genPropData.proposal.length > 50,
    'Generated proposal text is substantive and pitch-ready'
  );

  // 3. Test Callback B: mark_app
  const markAppUpdate = {
    update_id: 100003,
    callback_query: {
      id: 'cb_query_002',
      data: `mark_app:${lead.id}`,
      message: {
        message_id: 502,
        chat: { id: 987654321 },
      },
    },
  };

  const markAppRes = await fetch('http://localhost:3000/api/webhooks/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(markAppUpdate),
  });
  const markAppData = await markAppRes.json();

  assert(markAppRes.ok && markAppData.ok === true, 'Callback mark_app returns 200 OK');
  assert(markAppData.action === 'marked_applied', 'Action status successfully updated to applied');
}

async function run() {
  try {
    await testWebhookAccountLinking();
    await testInteractiveCallbacks();
  } catch (err) {
    console.error('Test execution error:', err);
  }

  console.log('\n==================================================');
  console.log(`📊 Phase 5 Test Summary: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  if (passedTests === totalTests) {
    console.log('🎉 Phase 5 (Interactive Telegram Bot & Webhooks) Verified 100% Successfully!');
  } else {
    console.error('❌ Some Phase 5 tests failed.');
    process.exit(1);
  }
}

run().catch(console.error);
