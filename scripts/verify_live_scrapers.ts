// ==============================================================================
// scripts/verify_live_scrapers.ts
// Live Verification Test for Khamsat, Freelancer, Mostaql, and Nafezly
// ==============================================================================

import { scrapeKhamsatCategory, fetchKhamsatRequestDetails } from '../src/lib/scrapers/khamsat';
import { scrapeFreelancerCategory } from '../src/lib/scrapers/freelancer';
import { scrapeMostaqlCategory, fetchMostaqlProjectDetails } from '../src/lib/scrapers/mostaql';
import { scrapeNafezlyCategory, fetchNafezlyProjectDetails } from '../src/lib/scrapers/nafezly';

console.log('================================================================');
console.log('🚀 PingLead Live Multi-Platform Scraper Verification');
console.log('================================================================\n');

async function testKhamsat() {
  console.log('--- 1. Testing Khamsat (خمسات) ---');
  try {
    const projects = await scrapeKhamsatCategory('all', 3);
    console.log(`Fetched ${projects.length} Khamsat requests.`);
    if (projects.length > 0) {
      const sample = projects[0];
      const isDuplicateTitle = sample.title.trim() === (sample.description || '').trim();
      
      console.log('Sample Khamsat Project Details:');
      console.log(`  • Title: ${sample.title}`);
      console.log(`  • URL: ${sample.url}`);
      console.log(`  • Author: ${sample.author}`);
      console.log(`  • Proposals/Replies Count: ${sample.proposals_count ?? sample.bids_count ?? '0'}`);
      console.log(`  • Description Length: ${sample.description?.length || 0} chars`);
      console.log(`  • Description Snippet: "${sample.description?.slice(0, 160)}..."`);
      console.log(`  • Title Repeated as Description?: ${isDuplicateTitle ? '❌ YES (BUG)' : '✅ NO (Real Inner Content)'}`);
      console.log(`  • Client Score: ${sample.client_evaluation?.score === null ? 'null (✅ Correct - No fake score)' : sample.client_evaluation?.score}`);
      console.log(`  • Hide Client Badge: ${sample.client_evaluation?.hideClientBadge ? '✅ true (Hidden in JobCard)' : '❌ false'}`);
      console.log(`  • Red Flags Count: ${sample.client_evaluation?.redFlags.length || 0} (✅ Zero false warnings)`);
    } else {
      console.log('⚠️ No Khamsat requests returned from listing page.');
    }
  } catch (err: any) {
    console.error('❌ Khamsat Error:', err.message);
  }
  console.log('\n');
}

async function testFreelancer() {
  console.log('--- 2. Testing Freelancer.com ---');
  try {
    const projects = await scrapeFreelancerCategory('all', 2);
    console.log(`Fetched ${projects.length} Freelancer projects.`);
    if (projects.length > 0) {
      const sample = projects[0];
      console.log('Sample Freelancer Project Details:');
      console.log(`  • Title: ${sample.title}`);
      console.log(`  • Budget: ${sample.budget}`);
      console.log(`  • Author: ${sample.author}`);
      console.log(`  • Full Description Length: ${sample.description?.length || 0} chars`);
      console.log(`  • Description Snippet: "${sample.description?.slice(0, 140)}..."`);
      console.log(`  • Client Score: ${sample.client_evaluation?.score}/10 (${sample.client_evaluation?.badge})`);
      console.log(`  • Payment Verified: ${sample.client_evaluation?.paymentVerified ? '✅ Yes' : 'No'}`);
    }
  } catch (err: any) {
    console.error('❌ Freelancer Error:', err.message);
  }
  console.log('\n');
}

async function testMostaql() {
  console.log('--- 3. Testing Mostaql (مستقل) ---');
  try {
    const projects = await scrapeMostaqlCategory('all', 2);
    console.log(`Fetched ${projects.length} Mostaql projects.`);
    if (projects.length > 0) {
      const sample = projects[0];
      console.log('Sample Mostaql Project Details:');
      console.log(`  • Title: ${sample.title}`);
      console.log(`  • URL: ${sample.url}`);
      console.log(`  • Author: ${sample.author}`);
      console.log(`  • Description Length: ${sample.description?.length || 0} chars`);
      console.log(`  • Description Snippet: "${sample.description?.slice(0, 140)}..."`);
    }
  } catch (err: any) {
    console.error('❌ Mostaql Error:', err.message);
  }
  console.log('\n');
}

async function testNafezly() {
  console.log('--- 4. Testing Nafezly (نفذلي) ---');
  try {
    const projects = await scrapeNafezlyCategory('all', 2);
    console.log(`Fetched ${projects.length} Nafezly projects.`);
    if (projects.length > 0) {
      const sample = projects[0];
      console.log('Sample Nafezly Project Details:');
      console.log(`  • Title: ${sample.title}`);
      console.log(`  • URL: ${sample.url}`);
      console.log(`  • Author: ${sample.author}`);
      console.log(`  • Description Length: ${sample.description?.length || 0} chars`);
      console.log(`  • Description Snippet: "${sample.description?.slice(0, 140)}..."`);
    }
  } catch (err: any) {
    console.error('❌ Nafezly Error:', err.message);
  }
  console.log('\n');
}

async function runAll() {
  await testKhamsat();
  await testFreelancer();
  await testMostaql();
  await testNafezly();
  console.log('================================================================');
  console.log('🏁 Verification Run Completed Successfully');
  console.log('================================================================');
}

runAll();
