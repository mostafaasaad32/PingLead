// scripts/verify_phase3_matching.mjs
// ==============================================================================
// Phase 3 Verification Script: Smart Matching Engine & Ingestion Pipeline
// ==============================================================================

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove Arabic diacritics/tashkeel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[_\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKeyword(content, rawKeyword) {
  const normContent = normalizeText(content);
  const normKw = normalizeText(rawKeyword);
  if (!normContent || !normKw) return false;

  // Short Latin words require word boundaries to avoid false positives (e.g. "ai" matching "email")
  if (normKw.length <= 3 && /^[a-z0-9+#]+$/.test(normKw)) {
    const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRegex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    return boundaryRegex.test(normContent);
  }

  return normContent.includes(normKw);
}

function evaluateProjectAgainstFilter(project, filter) {
  const baseResult = {
    matched: false,
    filterId: filter.id,
    filterName: filter.filter_name,
    userId: filter.user_id,
    reasons: [],
    matchedKeywords: [],
  };

  if (!filter.is_active) {
    baseResult.reasons.push('Filter is inactive');
    return baseResult;
  }

  if (filter.platforms && filter.platforms.length > 0) {
    const platformMatch = filter.platforms.some(
      (p) => p.toLowerCase() === project.platform.toLowerCase()
    );
    if (!platformMatch) {
      baseResult.reasons.push(`Platform ${project.platform} not in filter platforms`);
      return baseResult;
    }
  }

  if (filter.categories && filter.categories.length > 0) {
    const catMatch = filter.categories.some(
      (c) => c.toLowerCase() === project.category.toLowerCase()
    );
    if (!catMatch) {
      baseResult.reasons.push(`Category ${project.category} not in filter categories`);
      return baseResult;
    }
  }

  if (filter.min_budget_usd && filter.min_budget_usd > 0) {
    const est = project.budget_usd_estimate || 0;
    const maxVal = project.budget_max || 0;
    const minVal = project.budget_min || 0;
    const highestRecordedBudget = Math.max(est, maxVal, minVal);

    if (highestRecordedBudget > 0 && highestRecordedBudget < filter.min_budget_usd) {
      baseResult.reasons.push(
        `Budget ($${highestRecordedBudget} USD) is below filter minimum ($${filter.min_budget_usd} USD)`
      );
      return baseResult;
    }
  }

  const searchableText = `${project.title || ''} ${project.description || ''}`;
  const normalizedContent = normalizeText(searchableText);

  if (filter.exclude_keywords && filter.exclude_keywords.length > 0) {
    for (const rawExcludeKw of filter.exclude_keywords) {
      if (matchesKeyword(normalizedContent, rawExcludeKw)) {
        baseResult.reasons.push(`Excluded by negative keyword: "${rawExcludeKw}"`);
        baseResult.excludedByKeyword = rawExcludeKw;
        return baseResult;
      }
    }
  }

  if (filter.include_keywords && filter.include_keywords.length > 0) {
    const matchedKws = [];
    for (const rawIncludeKw of filter.include_keywords) {
      if (matchesKeyword(normalizedContent, rawIncludeKw)) {
        matchedKws.push(rawIncludeKw);
      }
    }

    if (matchedKws.length === 0) {
      baseResult.reasons.push('None of the required include_keywords matched');
      return baseResult;
    }

    baseResult.matchedKeywords = matchedKws;
  }

  baseResult.matched = true;
  baseResult.reasons.push('All filter constraints satisfied');
  return baseResult;
}

function batchMatchProjects(projects, filters) {
  const matchMap = new Map();
  const activeFilters = filters.filter((f) => f.is_active);
  if (activeFilters.length === 0 || projects.length === 0) {
    return matchMap;
  }

  for (const project of projects) {
    const projectMatches = [];
    for (const filter of activeFilters) {
      const evaluation = evaluateProjectAgainstFilter(project, filter);
      if (evaluation.matched) {
        projectMatches.push(evaluation);
      }
    }

    if (projectMatches.length > 0) {
      matchMap.set(`${project.platform}_${project.external_id}`, {
        project,
        matches: projectMatches,
      });
    }
  }

  return matchMap;
}

console.log('🚀 Starting Phase 3: Smart Matching Engine Verification...\n');

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

// ------------------------------------------------------------------------------
// Test Suite 1: Arabic & Multilingual Text Normalization
// ------------------------------------------------------------------------------
console.log('--- Test Suite 1: Arabic Normalization ---');

assert(
  normalizeText('تَطْبِيقْ إلكتروني فائق الدِّقَّة') === 'تطبيق الكتروني فائق الدقه',
  'Strips tashkeel and unifies Alefs and Taa Marbuta'
);

assert(
  normalizeText('مستشفى ومركز طبي') === 'مستشفي ومركز طبي',
  'Unifies Alef Maqsura (ى -> ي)'
);

assert(
  normalizeText('Next.js, React & Node_JS!') === 'next.js, react & node js!',
  'Normalizes case, underscores and hyphens'
);

// ------------------------------------------------------------------------------
// Test Suite 2: Keyword Matching & Short Keyword Boundary Protection
// ------------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Keyword Matching ---');

assert(
  matchesKeyword('مطلوب مبرمج لتطوير تطبيق متجر إلكتروني', 'الكتروني'),
  'Matches normalized Arabic keyword with different Alef form'
);

assert(
  matchesKeyword('Looking for a Senior Next.js Developer', 'Next.js'),
  'Matches Latin keyword case-insensitively'
);

assert(
  matchesKeyword('We need an AI expert for computer vision', 'ai'),
  'Matches short word "ai" when surrounded by spaces'
);

assert(
  !matchesKeyword('Please send your email to our team', 'ai'),
  'Word boundary prevents "ai" from matching inside "email"'
);

assert(
  !matchesKeyword('Good pain relief products', 'ai'),
  'Word boundary prevents "ai" from matching inside "pain"'
);

// ------------------------------------------------------------------------------
// Test Suite 3: Filter Evaluation (Inclusive, Exclusive, Budget, Platform)
// ------------------------------------------------------------------------------
console.log('\n--- Test Suite 3: Filter Evaluation ---');

const sampleProject = {
  external_id: 'proj_991',
  platform: 'mostaql',
  title: 'مطلوب مبرمج Next.js لبناء منصة SaaS متكاملة مع Supabase',
  description: 'نبحث عن مهندس متمرس في بناء تطبيقات الويب باستخدام Next.js و Tailwind و Supabase.',
  url: 'https://mostaql.com/project/proj_991',
  budget: '250 - 500 $',
  budget_min: 250,
  budget_max: 500,
  currency: 'USD',
  budget_usd_estimate: 375,
  category: 'web_dev',
  published_at: new Date().toISOString(),
};

const idealFilter = {
  id: 'filter_01',
  user_id: 'user_123',
  filter_name: 'مشاريع Next.js & React الكبيرة',
  platforms: ['mostaql', 'nafezly'],
  categories: ['web_dev'],
  include_keywords: ['Next.js', 'React'],
  exclude_keywords: ['ووردبريس', 'WordPress'],
  min_budget_usd: 100,
  is_active: true,
  notify_telegram: true,
};

const resultA = evaluateProjectAgainstFilter(sampleProject, idealFilter);
assert(resultA.matched === true, 'Ideal filter matches candidate project');
assert(resultA.matchedKeywords.includes('Next.js'), 'Identifies matched keyword: Next.js');

const rejectedWordpressProject = {
  external_id: 'proj_992',
  platform: 'mostaql',
  title: 'مطلوب مبرمج Next.js لربطه مع موقع ووردبريس قديم',
  description: 'لدينا متجر ووردبريس نحتاج ربطه مع واجهة أمامية.',
  url: 'https://mostaql.com/project/proj_992',
  budget: '500 $',
  budget_min: 500,
  budget_max: 500,
  currency: 'USD',
  budget_usd_estimate: 500,
  category: 'web_dev',
  published_at: new Date().toISOString(),
};

const resultB = evaluateProjectAgainstFilter(rejectedWordpressProject, idealFilter);
assert(resultB.matched === false, 'Disqualifies project containing negative keyword (ووردبريس)');
assert(resultB.excludedByKeyword === 'ووردبريس', 'Captures specific negative keyword: ووردبريس');

const lowBudgetProject = {
  external_id: 'proj_993',
  platform: 'mostaql',
  title: 'مطلوب تعديل سريع على صفحة Next.js',
  description: 'تعديل بسيط لزر في صفحة الهبوط.',
  url: 'https://mostaql.com/project/proj_993',
  budget: '25 $',
  budget_min: 25,
  budget_max: 25,
  currency: 'USD',
  budget_usd_estimate: 25,
  category: 'web_dev',
  published_at: new Date().toISOString(),
};

const resultC = evaluateProjectAgainstFilter(lowBudgetProject, idealFilter);
assert(resultC.matched === false, 'Rejects project with budget below min_budget_usd');

const foreignPlatformProject = {
  external_id: 'proj_994',
  platform: 'freelancer',
  title: 'Next.js Frontend Developer needed',
  description: 'Need a Next.js engineer for web app.',
  url: 'https://www.freelancer.com/projects/proj_994',
  budget: '300 USD',
  budget_min: 300,
  budget_max: 300,
  currency: 'USD',
  budget_usd_estimate: 300,
  category: 'web_dev',
  published_at: new Date().toISOString(),
};

const resultD = evaluateProjectAgainstFilter(foreignPlatformProject, idealFilter);
assert(resultD.matched === false, 'Rejects project when platform is not in filter.platforms');

// ------------------------------------------------------------------------------
// Test Suite 4: In-Memory Batch Matching
// ------------------------------------------------------------------------------
console.log('\n--- Test Suite 4: Batch Matching ---');

const projectsBatch = [sampleProject, rejectedWordpressProject, lowBudgetProject, foreignPlatformProject];
const filtersBatch = [
  idealFilter,
  {
    id: 'filter_02',
    user_id: 'user_456',
    filter_name: 'Freelancer Global Web Dev',
    platforms: ['freelancer'],
    categories: ['web_dev'],
    include_keywords: ['Next.js'],
    exclude_keywords: [],
    min_budget_usd: 50,
    is_active: true,
    notify_telegram: true,
  },
];

const batchResults = batchMatchProjects(projectsBatch, filtersBatch);
assert(batchResults.size === 2, 'Batch matching correctly maps matched projects (2 out of 4 matched)');

const matchP1 = batchResults.get('mostaql_proj_991');
assert(matchP1 && matchP1.matches[0].filterId === 'filter_01', 'Project 991 matched Filter 01');

const matchP4 = batchResults.get('freelancer_proj_994');
assert(matchP4 && matchP4.matches[0].filterId === 'filter_02', 'Project 994 matched Filter 02');

// ------------------------------------------------------------------------------
// Test Suite 5: Cron Route Dry-Run Verification
// ------------------------------------------------------------------------------
console.log('\n--- Test Suite 5: Cron Ingest Pipeline Verification ---');

async function testCronEndpoint() {
  try {
    const res = await fetch('http://localhost:3000/api/cron/ingest?secret=pinglead_cron_secret_secure_9921&scrape=false');
    const json = await res.json();
    assert(res.ok && json.ok === true, 'Cron endpoint responds HTTP 200 OK');
    assert(typeof json.duration_ms === 'number', 'Cron endpoint returns execution duration');
    assert(typeof json.activeFiltersCount === 'number', 'Cron endpoint returns activeFiltersCount metric');
    assert(typeof json.matchesFound === 'number', 'Cron endpoint returns matchesFound metric');
  } catch (err) {
    console.error('Error invoking cron endpoint:', err.message);
    assert(false, 'Cron endpoint invocation succeeded');
  }

  console.log('\n==================================================');
  console.log(`📊 Phase 3 Test Summary: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  if (passedTests === totalTests) {
    console.log('🎉 Phase 3 (Cron Ingestion & Smart Matching) Verified 100% Successfully!');
  } else {
    console.error('❌ Some Phase 3 tests failed. Review logs.');
    process.exit(1);
  }
}

testCronEndpoint().catch(console.error);
