// scripts/verify_phase6_ui_endpoints.mjs
// ==============================================================================
// Phase 6 Verification Script: Vollna-Style Web UI Dashboard Subpages & APIs
// ==============================================================================

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

console.log('🚀 Starting Phase 6: Vollna UI Subpages & CRM APIs Verification...\n');

async function testFrontendPages() {
  console.log('--- Test Suite 1: Web Dashboard Page Routes ---');
  const routes = ['/dashboard', '/filters', '/portfolio', '/tracker', '/settings'];

  for (const route of routes) {
    try {
      const res = await fetch(`http://localhost:3000${route}`);
      assert(res.ok && res.status === 200, `Page route ${route} responds with HTTP 200 OK`);
    } catch (err) {
      assert(false, `Page route ${route} failed: ${err.message}`);
    }
  }
}

async function testFiltersApi() {
  console.log('\n--- Test Suite 2: Smart Filters API (/api/filters) ---');
  // 1. GET
  const getRes = await fetch('http://localhost:3000/api/filters');
  const getData = await getRes.json();
  assert(getRes.ok && getData.ok === true, 'GET /api/filters returns 200 OK');
  assert(Array.isArray(getData.filters) && getData.filters.length > 0, 'Returns active filters array');

  // 2. POST (Create)
  const createRes = await fetch('http://localhost:3000/api/filters', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filter_name: 'تجربة فلتر Flutter',
      platforms: ['mostaql', 'nafezly'],
      categories: ['web_dev'],
      include_keywords: ['Flutter', 'Dart'],
      exclude_keywords: ['تصميم فقط'],
      min_budget_usd: 150,
      is_active: true,
      notify_telegram: true,
    }),
  });
  const createData = await createRes.json();
  assert(createRes.ok && createData.ok === true, 'POST /api/filters creates new filter');
  assert(createData.filter?.filter_name === 'تجربة فلتر Flutter', 'Filter created with accurate payload');
}

async function testPortfolioApi() {
  console.log('\n--- Test Suite 3: AI Portfolio Vault API (/api/portfolio) ---');
  // 1. GET
  const getRes = await fetch('http://localhost:3000/api/portfolio');
  const getData = await getRes.json();
  assert(getRes.ok && getData.ok === true, 'GET /api/portfolio returns 200 OK');
  assert(!!getData.profile && typeof getData.profile.bio === 'string', 'Returns freelancer persona bio');
  assert(Array.isArray(getData.portfolio_items) && getData.portfolio_items.length > 0, 'Returns portfolio vault items');

  // 2. POST Persona update
  const savePersonaRes = await fetch('http://localhost:3000/api/portfolio', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'save_persona',
      full_name: 'أحمد محمود',
      bio: 'مهندس حلول برمجية ومطور تطبيقات سحابية.',
      skills: ['Next.js', 'React', 'Supabase'],
      tone_of_voice: 'confident',
      custom_pitch_rules: 'ركز على سرعة التسليم',
    }),
  });
  const savePersonaData = await savePersonaRes.json();
  assert(savePersonaRes.ok && savePersonaData.ok === true, 'POST /api/portfolio updates freelancer persona');
}

async function testTrackerApi() {
  console.log('\n--- Test Suite 4: Proposal CRM Tracker API (/api/tracker) ---');
  // 1. GET
  const getRes = await fetch('http://localhost:3000/api/tracker?status=all');
  const getData = await getRes.json();
  assert(getRes.ok && getData.ok === true, 'GET /api/tracker returns 200 OK');
  assert(!!getData.metrics && typeof getData.metrics.total === 'number', 'Returns CRM aggregated metrics');
  assert(Array.isArray(getData.items) && getData.items.length > 0, 'Returns tracked project items');

  // 2. PATCH status update
  const firstItem = getData.items[0];
  if (firstItem) {
    const patchRes = await fetch('http://localhost:3000/api/tracker', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: firstItem.id,
        status: 'applied',
      }),
    });
    const patchData = await patchRes.json();
    assert(patchRes.ok && patchData.ok === true, 'PATCH /api/tracker updates status to applied');
  }
}

async function run() {
  try {
    await testFrontendPages();
    await testFiltersApi();
    await testPortfolioApi();
    await testTrackerApi();
  } catch (err) {
    console.error('Test execution error:', err);
  }

  console.log('\n==================================================');
  console.log(`📊 Phase 6 Test Summary: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  if (passedTests === totalTests) {
    console.log('🎉 Phase 6 (Vollna UI Subpages & CRM) Verified 100% Successfully!');
  } else {
    console.error('❌ Some Phase 6 tests failed.');
    process.exit(1);
  }
}

run().catch(console.error);
