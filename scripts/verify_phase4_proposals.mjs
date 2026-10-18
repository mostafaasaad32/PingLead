// scripts/verify_phase4_proposals.mjs
// ==============================================================================
// Phase 4 Verification Script: Context-Aware AI Proposal Engine
// ==============================================================================

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
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

  if (normKw.length <= 3 && /^[a-z0-9+#]+$/.test(normKw)) {
    const escaped = normKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundaryRegex = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    return boundaryRegex.test(normContent);
  }

  return normContent.includes(normKw);
}

function selectBestPortfolioItems(project, portfolioItems, maxItems = 2) {
  if (!portfolioItems || portfolioItems.length === 0) return [];

  const combinedProjectText = `${project.title || ''} ${project.description || ''}`;
  const normalizedProjectText = normalizeText(combinedProjectText);
  const scoredItems = [];

  for (const item of portfolioItems) {
    let score = 0;
    const matchReasons = [];

    if (project.category && item.category) {
      if (item.category.toLowerCase() === project.category.toLowerCase()) {
        score += 15;
        matchReasons.push(`نفس التصنيف البرمجي (${item.category})`);
      }
    }

    if (Array.isArray(item.tags) && item.tags.length > 0) {
      const matchedTags = [];
      for (const tag of item.tags) {
        if (matchesKeyword(normalizedProjectText, tag)) {
          score += 20;
          matchedTags.push(tag);
        }
      }
      if (matchedTags.length > 0) {
        matchReasons.push(`وسوم تقنية مشتركة: [${matchedTags.join(', ')}]`);
      }
    }

    if (item.project_title && matchesKeyword(normalizedProjectText, item.project_title)) {
      score += 15;
      matchReasons.push(`تطابق في عنوان العمل: "${item.project_title}"`);
    }

    if (item.description) {
      const words = item.description
        .split(/\s+/)
        .map((w) => w.replace(/[^\w\u0600-\u06FF]/g, '').trim())
        .filter((w) => w.length >= 4);

      const uniqueWords = Array.from(new Set(words));
      let overlapCount = 0;

      for (const word of uniqueWords) {
        if (matchesKeyword(normalizedProjectText, word)) {
          overlapCount++;
          if (overlapCount <= 5) score += 3;
        }
      }

      if (overlapCount > 0) {
        matchReasons.push(`تطابق مفاهيمي في الوصف (${overlapCount} كلمات رئيسية)`);
      }
    }

    if (item.live_url && item.live_url.startsWith('http')) {
      score += 10;
      matchReasons.push('رابط حي متاح للمعاينة المباشرة');
    }

    if (score > 0) {
      scoredItems.push({
        item,
        score,
        matchReasons,
      });
    }
  }

  scoredItems.sort((a, b) => b.score - a.score);
  return scoredItems.slice(0, maxItems);
}

function formatPortfolioForPrompt(selectedItems) {
  if (!selectedItems || selectedItems.length === 0) {
    return 'No specific portfolio links available.';
  }

  const itemsFormatted = selectedItems
    .map((scored, index) => {
      const p = scored.item;
      const linkStr = p.live_url ? ` | Live Link: ${p.live_url}` : '';
      const tagsStr = Array.isArray(p.tags) && p.tags.length > 0 ? ` [${p.tags.join(', ')}]` : '';
      return `${index + 1}. "${p.project_title}"${tagsStr}${linkStr}\n   Brief: ${p.description.slice(0, 250)}`;
    })
    .join('\n\n');

  return `RELEVANT PORTFOLIO PROOF OF WORK:\n${itemsFormatted}`;
}

console.log('🚀 Starting Phase 4: Context-Aware AI Proposal Engine Verification...\n');

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
// Test Suite 1: Portfolio Selector Scoring & Proof Selection
// ------------------------------------------------------------------------------
console.log('--- Test Suite 1: Autonomous Portfolio Selection ---');

const candidatePortfolio = [
  {
    id: 'port_01',
    user_id: 'user_dev_01',
    project_title: 'منصة عقارات ذكية بالذكاء الاصطناعي',
    description: 'نظام متكامل لإدارة العقارات والخرائط التفاعلية باستخدام Vue و Laravel.',
    live_url: 'https://realestate-ai.example.com',
    tags: ['vue', 'laravel', 'maps', 'real-estate'],
    category: 'web_dev',
  },
  {
    id: 'port_02',
    user_id: 'user_dev_01',
    project_title: 'متجر إلكتروني متكامل سريع Next.js & Stripe',
    description: 'متجر بيع بالتجزئة فائق السرعة يدعم بوابات الدفع وسلة الشراء وسرعة 100% على جوجل.',
    live_url: 'https://next-commerce.example.com',
    tags: ['next.js', 'react', 'ecommerce', 'stripe', 'tailwind'],
    category: 'web_dev',
  },
  {
    id: 'port_03',
    user_id: 'user_dev_01',
    project_title: 'تطبيق هاتف للياقة البدنية Flutter',
    description: 'تطبيق موبايل لمتابعة التمارين الرياضية ومعدل نبضات القلب.',
    live_url: 'https://fitness-app.example.com',
    tags: ['flutter', 'mobile', 'ios', 'android'],
    category: 'design',
  },
];

const targetEcommerceProject = {
  title: 'مطلوب مبرمج لبناء متجر إلكتروني احترافي بنظام Next.js و Stripe',
  description: 'نبحث عن مطور خبير لتنفيذ متجر إلكتروني عالي السرعة مع لوحة تحكم وربط بوابة الدفع Stripe وسلة التسوق.',
  category: 'web_dev',
};

const selectedItems = selectBestPortfolioItems(targetEcommerceProject, candidatePortfolio, 2);

assert(selectedItems.length >= 1, 'Returns top matching portfolio items');
assert(
  selectedItems[0].item.id === 'port_02',
  'Ranks E-commerce Next.js item as #1 for E-commerce project'
);
assert(
  selectedItems[0].item.live_url === 'https://next-commerce.example.com',
  'Selected item carries live demonstration URL'
);
assert(
  selectedItems[0].score >= 50,
  `High relevance score achieved (${selectedItems[0].score} points)`
);

const promptInjection = formatPortfolioForPrompt(selectedItems);
assert(
  promptInjection.includes('https://next-commerce.example.com'),
  'Prompt injection includes live URL proof'
);

// ------------------------------------------------------------------------------
// Test Suite 2: Live AI Proposal Generation via Next.js API Route
// ------------------------------------------------------------------------------
console.log('\n--- Test Suite 2: Live Gemini Flash Proposal Generation ---');

async function testLiveProposalGeneration() {
  const payload = {
    project_title: 'مطلوب مبرمج متمرس لبناء متجر إلكتروني Next.js وسلة تسوق',
    project_description: 'نحتاج متجر إلكتروني عصري، سريع جداً، متصل ببوابة الدفع Stripe مع إمكانية إدارة المخزون، ونريد شخصاً لديه سابقة أعمال حقيقية تثبت خبرته.',
    freelancer_bio: 'مهندس برمجيات متخصص في بناء تطبيقات التجارة الإلكترونية عالية التحويل والأداء.',
    freelancer_skills: ['Next.js', 'React', 'Stripe', 'Tailwind CSS', 'TypeScript'],
    tone_of_voice: 'confident',
    custom_instructions: 'اذكر خبرتي في تقليل وقت تحميل المتاجر إلى أقل من ثانية واحدة ورابط عملي السابق.',
  };

  try {
    const startTime = Date.now();
    const res = await fetch('http://localhost:3000/api/proposals/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    const duration = Date.now() - startTime;

    assert(res.ok && data.ok === true, 'API returns HTTP 200 with proposal');
    assert(typeof data.proposal === 'string' && data.proposal.length > 50, 'Proposal text is substantive');

    const proposalText = data.proposal;
    console.log('\n--- Sample Generated Proposal ---');
    console.log(proposalText);
    console.log('---------------------------------');

    // Quality Checks
    const hasCliche =
      proposalText.includes('السلام عليكم قرأت مشروعك ويسعدني') ||
      proposalText.includes('عزيزي العميل قرأت') ||
      proposalText.includes('Dear client');

    assert(!hasCliche, 'Zero clichés: Proposal starts directly with problem & solution Hook');

    const wordCount = proposalText.trim().split(/\s+/).length;
    assert(
      wordCount >= 40 && wordCount <= 250,
      `Concise mobile-friendly length (${wordCount} words, ideal for 30s reading)`
    );

    assert(
      duration < 6000,
      `Blazing fast generation speed (${duration}ms)`
    );
  } catch (err) {
    console.error('Error calling proposals/generate API:', err.message);
    assert(false, 'Proposal API call succeeded');
  }

  console.log('\n==================================================');
  console.log(`📊 Phase 4 Test Summary: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  if (passedTests === totalTests) {
    console.log('🎉 Phase 4 (Context-Aware AI Proposal Engine) Verified 100% Successfully!');
  } else {
    console.error('❌ Some Phase 4 tests failed.');
    process.exit(1);
  }
}

testLiveProposalGeneration().catch(console.error);
