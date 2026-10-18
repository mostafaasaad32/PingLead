// scripts/normalize_database_categories.mjs
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const MAPPINGS = [
  { from: 'web_dev', to: 'web_mobile_dev' },
  { from: 'ui_ux', to: 'ui_ux_graphic' },
  { from: 'design', to: 'ui_ux_graphic' },
  { from: 'marketing', to: 'digital_marketing_seo' },
  { from: 'accounting', to: 'business_accounting_legal' },
  { from: 'business', to: 'business_accounting_legal' },
  { from: 'writing', to: 'writing_translation' },
];

async function normalize() {
  console.log('Normalizing categories in projects and leads_pool tables...');

  for (const m of MAPPINGS) {
    const { count: cProj, error: eProj } = await supabase
      .from('projects')
      .update({ category: m.to }, { count: 'exact' })
      .eq('category', m.from);
    console.log(`projects: ${m.from} -> ${m.to} (${cProj} rows, error: ${eProj?.message || 'none'})`);

    const { count: cPool, error: ePool } = await supabase
      .from('leads_pool')
      .update({ category_slug: m.to }, { count: 'exact' })
      .eq('category_slug', m.from);
    console.log(`leads_pool: ${m.from} -> ${m.to} (${cPool} rows, error: ${ePool?.message || 'none'})`);
  }

  console.log('Finished normalization!');
}

normalize();
