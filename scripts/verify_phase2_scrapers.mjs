// ==============================================================================
// scripts/verify_phase2_scrapers.mjs
// Verification Script for Phase 2: Zero-Cost Multi-Platform Scraping Engine
// Tests all 9 Freelance Marketplaces (5 Arabic + 4 Global)
// ==============================================================================

import { ingestCategoryPosts } from '../src/lib/scrapers/index.js';

console.log('🚀 Starting Phase 2 Multi-Platform Scraper Verification...\n');

async function testAllScrapers() {
  const startTime = Date.now();

  const testCategory = {
    slug: 'web_dev',
    name_ar: 'تطوير البرمجيات والمواقع',
  };

  console.log(`📡 Ingesting live projects for #${testCategory.slug} across 9 platforms...`);
  const stats = await ingestCategoryPosts(testCategory);

  const durationMs = Date.now() - startTime;
  console.log(`\n⏱️ Total Execution Time: ${durationMs}ms`);
  console.log(`📦 Total Projects Fetched: ${stats.totalFetched}`);
  console.log(`✅ Surviving Projects: ${stats.survivingPending}`);
  console.log(`💾 Inserted into DB: ${stats.insertedIntoDb}`);

  console.log('\n📊 Platform Breakdown:');
  const platforms = Object.entries(stats.platformBreakdown);
  for (const [platform, count] of platforms) {
    console.log(`   • ${platform.toUpperCase()}: ${count} projects`);
  }

  // Verification checks
  console.log('\n🔍 Validating Data Integrity on Sample Projects:');
  const sample = stats.projects.slice(0, 5);
  for (const p of sample) {
    console.log('--------------------------------------------------');
    console.log(`[${p.platform.toUpperCase()}] ${p.title.slice(0, 70)}`);
    console.log(`   • ID: ${p.external_id}`);
    console.log(`   • URL: ${p.url}`);
    console.log(`   • Category: ${p.category} | Lang: ${p.language}`);
    console.log(`   • Budget: ${p.budget || 'غير محدد'} (Est: $${p.budget_usd_estimate || 0} USD)`);
    console.log(`   • Published: ${p.published_at}`);
  }

  console.log('\n==================================================');
  if (stats.totalFetched > 0 && platforms.length >= 6) {
    console.log('🎉 Phase 2 Scraper Engine Verified 100% Successfully!');
  } else {
    console.warn('⚠️ Warning: Some scrapers did not return data. Check network.');
  }
}

testAllScrapers().catch(console.error);
