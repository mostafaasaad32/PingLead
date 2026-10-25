// scripts/audit_scrapers.ts
import { scrapeMostaqlCategory, fetchMostaqlProjectDetails } from '../src/lib/scrapers/mostaql';
import { scrapeNafezlyCategory } from '../src/lib/scrapers/nafezly';
import { scrapeKhamsatCategory } from '../src/lib/scrapers/khamsat';
import { scrapeKafiilCategory } from '../src/lib/scrapers/kafiil';
import { scrapeBaeedCategory } from '../src/lib/scrapers/baeed';
import { scrapeFreelancerCategory } from '../src/lib/scrapers/freelancer';
import { scrapeRemoteOkCategory } from '../src/lib/scrapers/remoteok';
import { scrapePphCategory } from '../src/lib/scrapers/pph';
import { scrapeWwrCategory } from '../src/lib/scrapers/wwr';
import { scrapeUpworkCategory } from '../src/lib/scrapers/upwork';
import { scrapeRedditCategory } from '../src/lib/scrapers/reddit';
import { calculateClientScore } from '../src/lib/scoring/client-scorer';
import { UnifiedProject } from '../src/lib/scrapers/types';

interface ScraperAuditResult {
  platform: string;
  categoryTested: string;
  method: string;
  durationSeconds: number;
  status: 'SUCCESS' | 'FAILED' | 'EMPTY';
  errorMessage?: string;
  itemsReturned: number;
  dataQuality: {
    avgDescriptionLength: number;
    descriptionSnippetRatio: number; // % that are just title or <= 100 chars
    budgetAvailableRatio: number; // % that have real budget
    budgetSamples: string[];
    bidsCountAvailableRatio: number; // % that have bids_count
    publishedAtAvailableRatio: number; // % with valid published_at
    publishedAtSamples: string[];
  };
  clientDataQuality: {
    hireRateAvailableRatio: number;
    paymentVerifiedAvailableRatio: number;
    totalSpentAvailableRatio: number;
    clientRatingAvailableRatio: number;
    clientCountryAvailableRatio: number;
    authorSamples: string[];
    avgClientScore: number;
    sampleScores: number[];
    isDefaultScoring: boolean;
  };
  sampleProject?: {
    id: string;
    title: string;
    description: string;
    budget: string | null;
    published_at: string;
    author: string;
    insights: any;
    clientScore: any;
  };
}

async function auditPlatform(
  name: string,
  methodDesc: string,
  fn: () => Promise<UnifiedProject[]>
): Promise<ScraperAuditResult> {
  console.log(`\n======================================================`);
  console.log(`🔍 Auditing Platform: [${name.toUpperCase()}] ...`);
  console.log(`📡 Method: ${methodDesc}`);
  const start = Date.now();

  try {
    const projects = await fn();
    const durationMs = Date.now() - start;
    const durationSeconds = Number((durationMs / 1000).toFixed(2));

    if (!projects || projects.length === 0) {
      console.log(`⚠️ Result: 0 projects returned in ${durationSeconds}s`);
      return {
        platform: name,
        categoryTested: 'web_mobile_dev',
        method: methodDesc,
        durationSeconds,
        status: 'EMPTY',
        itemsReturned: 0,
        dataQuality: {
          avgDescriptionLength: 0,
          descriptionSnippetRatio: 0,
          budgetAvailableRatio: 0,
          budgetSamples: [],
          bidsCountAvailableRatio: 0,
          publishedAtAvailableRatio: 0,
          publishedAtSamples: [],
        },
        clientDataQuality: {
          hireRateAvailableRatio: 0,
          paymentVerifiedAvailableRatio: 0,
          totalSpentAvailableRatio: 0,
          clientRatingAvailableRatio: 0,
          clientCountryAvailableRatio: 0,
          authorSamples: [],
          avgClientScore: 0,
          sampleScores: [],
          isDefaultScoring: true,
        },
      };
    }

    console.log(`✅ Success: ${projects.length} projects fetched in ${durationSeconds}s`);

    // Analysis
    let totalDescLen = 0;
    let snippetCount = 0;
    let withBudget = 0;
    const budgetSamples: string[] = [];
    let withBids = 0;
    let withPublished = 0;
    const publishedAtSamples: string[] = [];

    let withHireRate = 0;
    let withPaymentVerified = 0;
    let withTotalSpent = 0;
    let withClientRating = 0;
    let withClientCountry = 0;
    const authorSamples: string[] = [];
    let totalClientScore = 0;
    const sampleScores: number[] = [];

    for (const p of projects) {
      const desc = p.description || '';
      totalDescLen += desc.length;
      if (desc === p.title || desc.length <= 100) {
        snippetCount++;
      }

      if (p.budget) {
        withBudget++;
        if (budgetSamples.length < 3) budgetSamples.push(p.budget);
      }

      if (typeof p.insights?.bids_count === 'number') {
        withBids++;
      }

      if (p.published_at) {
        withPublished++;
        if (publishedAtSamples.length < 3) publishedAtSamples.push(p.published_at);
      }

      // Client metrics
      if (typeof p.insights?.client_hire_rate === 'number') withHireRate++;
      if (p.insights?.payment_verified) withPaymentVerified++;
      if (p.insights?.total_spent) withTotalSpent++;
      if (typeof p.insights?.client_rating === 'number') withClientRating++;
      if (p.insights?.client_country) withClientCountry++;
      if (p.author && authorSamples.length < 3) authorSamples.push(p.author);

      // Score evaluation
      const scoreObj = calculateClientScore({
        platform: p.platform,
        title: p.title,
        description: p.description,
        budget: p.budget,
        budget_min: p.budget_min,
        budget_max: p.budget_max,
        currency: p.currency,
        author: p.author,
        client_hire_rate: p.insights?.client_hire_rate,
        client_open_projects: p.insights?.client_open_projects,
        client_in_progress: p.insights?.client_in_progress,
        client_registered_at: p.insights?.client_registered_at,
        client_country: p.insights?.client_country,
        client_profession: p.insights?.client_profession,
        client_rating: p.insights?.client_rating,
        payment_verified: p.insights?.payment_verified,
        total_spent: p.insights?.total_spent,
        insights: p.insights,
      });

      totalClientScore += scoreObj.score;
      if (sampleScores.length < 5) sampleScores.push(scoreObj.score);
    }

    const n = projects.length;
    const sample = projects[0];
    const sampleScore = calculateClientScore({
      platform: sample.platform,
      title: sample.title,
      description: sample.description,
      budget: sample.budget,
      budget_min: sample.budget_min,
      budget_max: sample.budget_max,
      currency: sample.currency,
      author: sample.author,
      insights: sample.insights,
    });

    const isDefaultScoring = withHireRate === 0 && withTotalSpent === 0 && withClientRating === 0;

    return {
      platform: name,
      categoryTested: 'web_mobile_dev',
      method: methodDesc,
      durationSeconds,
      status: 'SUCCESS',
      itemsReturned: n,
      dataQuality: {
        avgDescriptionLength: Math.round(totalDescLen / n),
        descriptionSnippetRatio: Math.round((snippetCount / n) * 100),
        budgetAvailableRatio: Math.round((withBudget / n) * 100),
        budgetSamples,
        bidsCountAvailableRatio: Math.round((withBids / n) * 100),
        publishedAtAvailableRatio: Math.round((withPublished / n) * 100),
        publishedAtSamples,
      },
      clientDataQuality: {
        hireRateAvailableRatio: Math.round((withHireRate / n) * 100),
        paymentVerifiedAvailableRatio: Math.round((withPaymentVerified / n) * 100),
        totalSpentAvailableRatio: Math.round((withTotalSpent / n) * 100),
        clientRatingAvailableRatio: Math.round((withClientRating / n) * 100),
        clientCountryAvailableRatio: Math.round((withClientCountry / n) * 100),
        authorSamples,
        avgClientScore: Number((totalClientScore / n).toFixed(1)),
        sampleScores,
        isDefaultScoring,
      },
      sampleProject: {
        id: sample.external_id,
        title: sample.title.slice(0, 80),
        description: sample.description.slice(0, 150),
        budget: sample.budget,
        published_at: sample.published_at,
        author: sample.author || 'N/A',
        insights: sample.insights,
        clientScore: {
          score: sampleScore.score,
          badge: sampleScore.badge,
          labelAr: sampleScore.labelAr,
          greenFlags: sampleScore.greenFlags,
          redFlags: sampleScore.redFlags,
        },
      },
    };
  } catch (error: any) {
    const durationSeconds = Number(((Date.now() - start) / 1000).toFixed(2));
    console.error(`❌ Error auditing ${name}:`, error.message);
    return {
      platform: name,
      categoryTested: 'web_mobile_dev',
      method: methodDesc,
      durationSeconds,
      status: 'FAILED',
      errorMessage: error.message,
      itemsReturned: 0,
      dataQuality: {
        avgDescriptionLength: 0,
        descriptionSnippetRatio: 0,
        budgetAvailableRatio: 0,
        budgetSamples: [],
        bidsCountAvailableRatio: 0,
        publishedAtAvailableRatio: 0,
        publishedAtSamples: [],
      },
      clientDataQuality: {
        hireRateAvailableRatio: 0,
        paymentVerifiedAvailableRatio: 0,
        totalSpentAvailableRatio: 0,
        clientRatingAvailableRatio: 0,
        clientCountryAvailableRatio: 0,
        authorSamples: [],
        avgClientScore: 0,
        sampleScores: [],
        isDefaultScoring: true,
      },
    };
  }
}

async function runAudit() {
  console.log('🚀 Initiating Complete Live Scraper & Data Quality Audit...');
  console.log(`🕒 Timestamp: ${new Date().toISOString()}`);

  const results: ScraperAuditResult[] = [];

  // 1. Mostaql (Listing)
  results.push(
    await auditPlatform(
      'mostaql',
      'Direct HTML Regex (Listing Page)',
      () => scrapeMostaqlCategory('web_mobile_dev', 15)
    )
  );

  // 1.b Mostaql Deep Detail Fetch Test on live project URL
  console.log('\n--- Testing Mostaql Deep Detail Page Enrichment ---');
  try {
    const sampleListing = await scrapeMostaqlCategory('web_mobile_dev', 1);
    if (sampleListing && sampleListing[0]) {
      const detailStart = Date.now();
      const details = await fetchMostaqlProjectDetails(sampleListing[0].url);
      const detailDuration = ((Date.now() - detailStart) / 1000).toFixed(2);
      console.log(`Mostaql Deep Enrichment fetched in ${detailDuration}s:`, {
        url: sampleListing[0].url,
        descriptionLength: details?.description?.length || 0,
        budget_min: details?.budget_min,
        budget_max: details?.budget_max,
        client_hire_rate: details?.client_hire_rate,
        client_open_projects: details?.client_open_projects,
        client_in_progress: details?.client_in_progress,
        payment_verified: details?.payment_verified,
        client_registered_at: details?.client_registered_at,
        client_evaluation: details?.client_evaluation?.score,
      });
    }
  } catch (err: any) {
    console.warn('Mostaql Deep Detail test failed:', err.message);
  }

  // 2. Nafezly
  results.push(
    await auditPlatform(
      'nafezly',
      'Direct HTML Regex (Listing Page)',
      () => scrapeNafezlyCategory('web_mobile_dev', 15)
    )
  );

  // 3. Kafiil
  results.push(
    await auditPlatform(
      'kafiil',
      'Direct HTML Regex (Listing Page)',
      () => scrapeKafiilCategory('web_mobile_dev', 15)
    )
  );

  // 4. Khamsat
  results.push(
    await auditPlatform(
      'khamsat',
      'Direct HTML Regex (Community Requests)',
      () => scrapeKhamsatCategory('web_mobile_dev', 15)
    )
  );

  // 5. Baeed
  results.push(
    await auditPlatform(
      'baeed',
      'Direct HTML Regex (Category Page)',
      () => scrapeBaeedCategory('web_mobile_dev', 15)
    )
  );

  // 6. Freelancer.com
  results.push(
    await auditPlatform(
      'freelancer',
      'Official Public JSON API (api/projects/0.1)',
      () => scrapeFreelancerCategory('web_mobile_dev', 15)
    )
  );

  // 7. PeoplePerHour
  results.push(
    await auditPlatform(
      'pph',
      'Embedded Initial State JSON (window.PPHReact.initialState)',
      () => scrapePphCategory('web_mobile_dev', 15)
    )
  );

  // 8. RemoteOK
  results.push(
    await auditPlatform(
      'remoteok',
      'Public JSON API (/api)',
      () => scrapeRemoteOkCategory('web_mobile_dev', 15)
    )
  );

  // 9. WeWorkRemotely
  results.push(
    await auditPlatform(
      'wwr',
      'Category RSS XML Feed',
      () => scrapeWwrCategory('web_mobile_dev', 15)
    )
  );

  // 10. Upwork (via Scrapling Sidecar)
  results.push(
    await auditPlatform(
      'upwork',
      'Scrapling Sidecar / StealthyFetcher (Cloudflare bypass)',
      () => scrapeUpworkCategory('web_mobile_dev', 10)
    )
  );

  // 11. Reddit (via Scrapling Sidecar)
  results.push(
    await auditPlatform(
      'reddit',
      'Scrapling Sidecar / FetcherSession (Chrome impersonate)',
      () => scrapeRedditCategory('web_mobile_dev', 10)
    )
  );

  // Print Complete JSON summary for analysis
  console.log('\n======================================================');
  console.log('📊 FINAL AUDIT SUMMARY (JSON):');
  console.log(JSON.stringify(results, null, 2));
}

runAudit().catch(console.error);
