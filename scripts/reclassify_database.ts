// scripts/reclassify_database.ts
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { classifyProject } from '../src/lib/taxonomy/classifier';
import { CATEGORIES_METADATA } from '../src/lib/scrapers/types';

const envContent = fs.readFileSync('.env', 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function reclassify() {
  console.log('================================================================');
  console.log('🔄 STARTING DATABASE RECLASSIFICATION WITH SOURCE-AWARE TAXONOMY');
  console.log('================================================================\n');

  // 1. Fetch all projects from `projects` table
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('id, external_id, platform, title, description, url, category')
    .order('published_at', { ascending: false })
    .limit(1000);

  if (projErr) {
    console.error('Error fetching projects:', projErr.message);
    return;
  }

  console.log(`Fetched ${projects.length} rows from public.projects table.`);

  let changedCount = 0;
  const changedItems: { id: string; external_id: string; platform: string; oldCat: string; newCat: string }[] = [];
  const samplesByPlatform: Record<string, any[]> = {};

  for (const p of projects) {
    // Determine rawCategory hint if available from URL or platform
    let rawCategory: string | null = null;
    if (p.platform === 'mostaql' && p.url) {
      const m = p.url.match(/projects\/([a-z-]+)/i);
      if (m && !['latest', 'budget'].includes(m[1])) rawCategory = m[1];
    } else if (p.platform === 'baeed' && p.url) {
      const m = p.url.match(/categories\/([a-z-]+)/i);
      if (m) rawCategory = m[1].replace(/-jobs$/, '');
    } else if (p.platform === 'kafiil' && p.url) {
      const m = p.url.match(/projects\/([a-z0-9-]+)/i);
      if (m && !m[1].startsWith('page')) rawCategory = m[1];
    }

    const classResult = classifyProject({
      platform: p.platform,
      title: p.title || '',
      description: p.description || '',
      rawCategory,
    });

    const newCategory = classResult.category;
    const oldCategory = p.category;

    if (newCategory !== oldCategory) {
      changedCount++;
      changedItems.push({
        id: p.id,
        external_id: p.external_id,
        platform: p.platform,
        oldCat: oldCategory,
        newCat: newCategory,
      });
    }

    // Collect samples for report
    if (!samplesByPlatform[p.platform]) samplesByPlatform[p.platform] = [];
    if (samplesByPlatform[p.platform].length < 3) {
      samplesByPlatform[p.platform].push({
        platform: p.platform,
        title: p.title,
        rawCategory: rawCategory || '(Derived from content / intent)',
        category: newCategory,
        layer: classResult.layer,
      });
    }
  }

  console.log(`Identified ${changedCount} projects needing reclassification out of ${projects.length}.`);
  console.log('Applying batch updates to Supabase (concurrency: 25)...');

  // Batch updates in parallel chunks of 25
  const CONCURRENCY = 25;
  for (let i = 0; i < changedItems.length; i += CONCURRENCY) {
    const chunk = changedItems.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (item) => {
        // Update projects table
        await supabase
          .from('projects')
          .update({ category: item.newCat })
          .eq('id', item.id);

        // Update leads_pool table
        await supabase
          .from('leads_pool')
          .update({ category_slug: item.newCat })
          .eq('external_post_id', `${item.platform}_${item.external_id}`);
      })
    );
    process.stdout.write(`Updated ${Math.min(i + CONCURRENCY, changedItems.length)}/${changedItems.length}...\r`);
  }
  console.log('\nAll updates applied successfully!');

  // 2. Compute Distribution of Real Projects by Category
  const { data: updatedProjects } = await supabase
    .from('projects')
    .select('category');

  const distribution: Record<string, number> = {};
  for (const c of CATEGORIES_METADATA) distribution[c.id] = 0;

  for (const p of updatedProjects || []) {
    const cat = p.category || 'other';
    distribution[cat] = (distribution[cat] || 0) + 1;
  }

  console.log('\n================================================================');
  console.log('📊 REAL PROJECT DISTRIBUTION AFTER RECLASSIFICATION:');
  console.log('================================================================');
  for (const c of CATEGORIES_METADATA) {
    const count = distribution[c.id] || 0;
    const bar = '█'.repeat(Math.min(40, Math.ceil(count / 3)));
    console.log(`${c.icon} ${c.label_ar.padEnd(35)} : ${count.toString().padStart(4)} projects ${bar}`);
  }

  // 3. Output 15 Diverse Real Samples
  console.log('\n================================================================');
  console.log('🔎 15 VERIFICATION SAMPLES ACROSS PLATFORMS:');
  console.log('================================================================');
  const allSamples: any[] = [];
  const platforms = ['mostaql', 'freelancer', 'nafezly', 'kafiil', 'khamsat', 'baeed', 'wwr', 'remoteok', 'pph'];
  for (const plat of platforms) {
    if (samplesByPlatform[plat]) {
      allSamples.push(...samplesByPlatform[plat]);
    }
  }

  const sample15 = allSamples.slice(0, 15);
  sample15.forEach((s, idx) => {
    const catMeta = CATEGORIES_METADATA.find(m => m.id === s.category);
    console.log(`[${idx + 1}] [${s.platform.toUpperCase()}]`);
    console.log(`    Title: "${s.title.slice(0, 70)}"`);
    console.log(`    Source Category: "${s.rawCategory}"`);
    console.log(`    -> PingLead Category: ${catMeta?.icon} ${catMeta?.label_ar} (${s.category}) [Layer: ${s.layer}]`);
  });

  console.log('\n================================================================');
  console.log('✅ DATABASE RECLASSIFICATION FINISHED');
  console.log('================================================================');
}

reclassify();
