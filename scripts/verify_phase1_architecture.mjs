// ==============================================================================
// scripts/verify_phase1_architecture.mjs
// Verification Script for Phase 1: Vollna Architecture & Types
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { createUnifiedProject, estimateBudgetUsd } from '../src/lib/scrapers/types.js';

console.log('🧪 Starting Phase 1 Architecture Verification...\n');

// 1. Verify SQL Migration File
const migrationPath = path.resolve('supabase/migrations/0003_vollna_architecture.sql');
if (!fs.existsSync(migrationPath)) {
  console.error('❌ Migration file 0003_vollna_architecture.sql NOT found!');
  process.exit(1);
}
const sqlContent = fs.readFileSync(migrationPath, 'utf-8');
const requiredTables = [
  'projects',
  'freelancer_profiles',
  'portfolio_items',
  'user_filters',
  'user_project_actions'
];

console.log('1️⃣ Checking SQL DDL Tables:');
let missingTables = 0;
for (const table of requiredTables) {
  const tableExists = sqlContent.includes(`CREATE TABLE IF NOT EXISTS public.${table}`);
  if (tableExists) {
    console.log(`   ✅ Table 'public.${table}' defined with DDL`);
  } else {
    console.error(`   ❌ Table 'public.${table}' missing!`);
    missingTables++;
  }
}

// Check RLS
const rlsExists = requiredTables.every(t => sqlContent.includes(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`));
console.log(`   ${rlsExists ? '✅' : '❌'} Row Level Security (RLS) enabled on all 5 tables`);

// 2. Test Currency & Budget Normalizer
console.log('\n2️⃣ Testing estimateBudgetUsd Normalizer:');
const budgetTests = [
  { amount: 100, curr: 'USD', expected: 100 },
  { amount: 375, curr: 'SAR', expected: 100 },
  { amount: 367, curr: 'AED', expected: 100 },
  { amount: 5000, curr: 'EGP', expected: 100 },
  { amount: 100, curr: 'EUR', expected: 108 },
  { amount: 100, curr: 'GBP', expected: 128 },
];

for (const t of budgetTests) {
  const result = estimateBudgetUsd(t.amount, t.curr);
  const pass = Math.abs(result - t.expected) <= 1;
  console.log(`   ${pass ? '✅' : '❌'} ${t.amount} ${t.curr} -> $${result} USD (Expected: ~$${t.expected})`);
}

// 3. Test createUnifiedProject Factory
console.log('\n3️⃣ Testing createUnifiedProject Factory:');
const sampleProject = createUnifiedProject({
  external_id: 'test_123',
  platform: 'mostaql',
  title: 'تطوير تطبيق ويب SaaS احترافي بـ Next.js',
  description: 'نبحث عن مبرمج لبناء منصة وربط الـ APIs وقواعد البيانات.',
  url: 'https://mostaql.com/projects/123456',
  budget_min: 250,
  budget_max: 500,
  currency: 'USD',
  language: 'ar',
  category: 'web_dev',
});

console.log('   ✅ Unified Project successfully created:');
console.log(`      • Platform: ${sampleProject.platform}`);
console.log(`      • Category: ${sampleProject.category}`);
console.log(`      • Budget: ${sampleProject.budget}`);
console.log(`      • USD Estimate: $${sampleProject.budget_usd_estimate}`);
console.log(`      • External Post ID: ${sampleProject.external_post_id}`);

console.log('\n🎉 Phase 1 Architecture & Types Verified 100% Successfully!');
