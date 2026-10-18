// scratch/inspect_dates.mjs
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function testMostaqlDates() {
  console.log('--- Mostaql Dates ---');
  const res = await fetch('https://mostaql.com/projects?category=development&sort=latest', {
    headers: { 'User-Agent': USER_AGENT }
  });
  const html = await res.text();
  // Look for time tags or "منذ"
  const timeMatches = [...html.matchAll(/<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/gi)];
  console.log('Mostaql <time datetime>: ', timeMatches.length);
  for (const m of timeMatches.slice(0, 5)) {
    console.log('Datetime:', m[1], 'Text:', m[2].trim());
  }

  // Also check other date/time classes
  const agoMatches = [...html.matchAll(/(منذ\s+[^<]+)/gi)];
  console.log('Mostaql "منذ":', agoMatches.length);
  for (const m of agoMatches.slice(0, 5)) {
    console.log('Ago text:', m[1].trim());
  }
}

async function testKhamsatDates() {
  console.log('\n--- Khamsat Dates ---');
  const res = await fetch('https://khamsat.com/community/requests', {
    headers: { 'User-Agent': USER_AGENT }
  });
  const html = await res.text();
  const timeMatches = [...html.matchAll(/<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/gi)];
  console.log('Khamsat <time datetime>: ', timeMatches.length);
  for (const m of timeMatches.slice(0, 5)) {
    console.log('Datetime:', m[1], 'Text:', m[2].trim());
  }
  const agoMatches = [...html.matchAll(/(منذ\s+[^<]+)/gi)];
  console.log('Khamsat "منذ":', agoMatches.length);
  for (const m of agoMatches.slice(0, 5)) {
    console.log('Ago text:', m[1].trim());
  }
}

async function testKafiilDates() {
  console.log('\n--- Kafiil Dates ---');
  const res = await fetch('https://kafiil.com/projects', {
    headers: { 'User-Agent': USER_AGENT }
  });
  const html = await res.text();
  const agoMatches = [...html.matchAll(/(منذ\s+[^<]+)/gi)];
  console.log('Kafiil "منذ":', agoMatches.length);
  for (const m of agoMatches.slice(0, 5)) {
    console.log('Kafiil text:', m[1].replace(/\s+/g, ' ').trim());
  }
}

async function testBaeedDates() {
  console.log('\n--- Baeed Dates ---');
  const res = await fetch('https://baaeed.com/categories/remote-programming-jobs', {
    headers: { 'User-Agent': USER_AGENT }
  });
  const html = await res.text();
  const timeMatches = [...html.matchAll(/<time[^>]*datetime=["']([^"']+)["'][^>]*>([\s\S]*?)<\/time>/gi)];
  console.log('Baeed <time datetime>: ', timeMatches.length);
  for (const m of timeMatches.slice(0, 5)) {
    console.log('Baeed datetime:', m[1], 'Text:', m[2].trim());
  }
  const agoMatches = [...html.matchAll(/(منذ\s+[^<]+)/gi)];
  console.log('Baeed "منذ":', agoMatches.length);
  for (const m of agoMatches.slice(0, 5)) {
    console.log('Baeed ago:', m[1].replace(/\s+/g, ' ').trim());
  }
}

async function run() {
  await testMostaqlDates();
  await testKhamsatDates();
  await testKafiilDates();
  await testBaeedDates();
}
run();
