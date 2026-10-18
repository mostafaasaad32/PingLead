// scripts/rescrape_and_update_dates.mjs
import { ingestCategoryPosts } from '../src/lib/scrapers/index.ts';

async function updateAll() {
  console.log('🔄 Running Ingestion with updated authentic date parsing across categories...\n');

  const categories = [
    { slug: 'web_dev', name_ar: 'تطوير البرمجيات والمواقع' },
    { slug: 'design', name_ar: 'التصميم والميديا' },
    { slug: 'marketing', name_ar: 'التسويق والمبيعات' },
    { slug: 'writing', name_ar: 'الكتابة والترجمة' },
  ];

  for (const cat of categories) {
    console.log(`📡 Ingesting category: ${cat.slug}...`);
    try {
      const stats = await ingestCategoryPosts(cat);
      console.log(`   ✅ Fetched: ${stats.totalFetched} | Inserted/Updated: ${stats.insertedIntoDb}`);
    } catch (err) {
      console.error(`   ❌ Error for ${cat.slug}:`, err.message);
    }
  }

  console.log('\n🎉 Finished re-scraping and updating DB with authentic timestamps!');
}

updateAll();
