// scripts/debug_dates.mjs
import { scrapeMostaqlCategory } from '../src/lib/scrapers/mostaql.ts';
import { scrapeNafezlyCategory } from '../src/lib/scrapers/nafezly.ts';
import { scrapeKhamsatCategory } from '../src/lib/scrapers/khamsat.ts';
import { scrapeKafiilCategory } from '../src/lib/scrapers/kafiil.ts';
import { scrapeBaeedCategory } from '../src/lib/scrapers/baeed.ts';
import { scrapeFreelancerCategory } from '../src/lib/scrapers/freelancer.ts';
import { scrapeRemoteOKCategory } from '../src/lib/scrapers/remoteok.ts';
import { scrapePPHCategory } from '../src/lib/scrapers/pph.ts';
import { scrapeWWRCategory } from '../src/lib/scrapers/wwr.ts';

async function testDates() {
  console.log('--- TESTING ALL 9 SCRAPERS DATES ---');
  const scrapers = [
    { name: 'Mostaql', fn: scrapeMostaqlCategory },
    { name: 'Nafezly', fn: scrapeNafezlyCategory },
    { name: 'Khamsat', fn: scrapeKhamsatCategory },
    { name: 'Kafiil', fn: scrapeKafiilCategory },
    { name: 'Baeed', fn: scrapeBaeedCategory },
    { name: 'Freelancer', fn: scrapeFreelancerCategory },
    { name: 'RemoteOK', fn: scrapeRemoteOKCategory },
    { name: 'PeoplePerHour', fn: scrapePPHCategory },
    { name: 'WeWorkRemotely', fn: scrapeWWRCategory },
  ];

  for (const s of scrapers) {
    try {
      console.log(`\nTesting ${s.name}...`);
      const projects = await s.fn('web_dev', 3);
      console.log(`Found ${projects.length} projects.`);
      for (const p of projects) {
        console.log(`  [${p.platform}] Title: ${p.title.slice(0, 40)}`);
        console.log(`       Published_at: ${p.published_at}`);
        console.log(`       URL: ${p.url}`);
      }
    } catch (err) {
      console.error(`Error in ${s.name}:`, err.message);
    }
  }
}

testDates();
