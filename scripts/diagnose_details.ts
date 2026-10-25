// scripts/diagnose_details.ts
async function diagnose() {
  console.log('=== 1. Testing Reddit Sidecar Endpoint ===');
  try {
    const res = await fetch('http://127.0.0.1:8000/scrape/reddit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subreddit: 'forhire', limit: 10 }),
    });
    console.log('Reddit sidecar status:', res.status);
    const json = await res.json();
    console.log('Reddit sidecar returned items:', Array.isArray(json) ? json.length : json);
  } catch (e: any) {
    console.error('Reddit sidecar error:', e.message);
  }

  console.log('\n=== 2. Testing Freelancer API for full_description & owners ===');
  try {
    const url = 'https://www.freelancer.com/api/projects/0.1/projects/active/?sort_field=time_submitted&compact=false&job_details=true&user_details=true&limit=2';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await res.json();
    const proj = data.result?.projects?.[0];
    const user = data.result?.users?.[proj?.owner_id];
    console.log('Freelancer with compact=false:');
    console.log('  Description length:', proj?.description?.length || proj?.preview_description?.length);
    console.log('  Description sample:', (proj?.description || proj?.preview_description || '').slice(0, 120));
    console.log('  Owner ID:', proj?.owner_id);
    console.log('  Owner found in result.users?:', Boolean(user));
    if (user) {
      console.log('  Owner fields:', {
        username: user.username,
        reputation: user.reputation,
        status: user.status,
        chosen_role: user.chosen_role,
        payment_verified: user.status?.payment_verified,
        email_verified: user.status?.email_verified,
        identity_verified: user.status?.identity_verified,
      });
    }
  } catch (e: any) {
    console.error('Freelancer test error:', e.message);
  }

  console.log('\n=== 3. Testing Nafezly HTML Selectors ===');
  try {
    const res = await fetch('https://nafezly.com/projects?sort=latest', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ar,en-US;q=0.9',
      },
    });
    const html = await res.text();
    console.log('Nafezly page length:', html.length);
    // Check for bids / client icons
    const hasFaBallot = html.includes('fa-ballot');
    const hasFaUserCheck = html.includes('fa-user-check');
    const hasBids = html.match(/(\d+)\s*عرض/);
    console.log('Nafezly fa-ballot present?:', hasFaBallot);
    console.log('Nafezly fa-user-check present?:', hasFaUserCheck);
    console.log('Nafezly bids match:', hasBids ? hasBids[0] : 'None');
    // Find what icons exist in project cards
    const icons = [...html.matchAll(/class="fal (fa-[a-z0-9-]+)"/gi)].slice(0, 10).map(m => m[1]);
    console.log('Sample Nafezly icons:', [...new Set(icons)]);
  } catch (e: any) {
    console.error('Nafezly test error:', e.message);
  }

  console.log('\n=== 4. Testing Upwork Sidecar Direct Call ===');
  try {
    console.log('Calling Upwork sidecar directly with 35s timeout...');
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 35000);
    const res = await fetch('http://127.0.0.1:8000/scrape/upwork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'react', limit: 5 }),
      signal: controller.signal,
    });
    clearTimeout(t);
    console.log('Upwork sidecar status:', res.status);
    const json = await res.json();
    console.log('Upwork returned:', Array.isArray(json) ? `${json.length} jobs` : json);
  } catch (e: any) {
    console.error('Upwork sidecar direct error:', e.message);
  }
}

diagnose().catch(console.error);
