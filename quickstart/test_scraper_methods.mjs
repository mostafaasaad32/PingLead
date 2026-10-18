import fs from "fs";

async function testShreddit() {
  console.log("--- Testing Reddit Shreddit HTML ---");
  try {
    const res = await fetch("https://www.reddit.com/r/forhire/new/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    console.log("Shreddit status:", res.status);
    if (res.ok) {
      const html = await res.text();
      // Match shreddit-post elements
      const posts = [...html.matchAll(/<shreddit-post\s+[^>]*?post-title="([^"]+)"[^>]*?permalink="([^"]+)"/g)];
      console.log(`Found ${posts.length} shreddit-post elements!`);
      posts.slice(0, 3).forEach((p, idx) => {
        console.log(`[${idx + 1}] Title: ${p[1]}`);
        console.log(`    URL: https://reddit.com${p[2]}`);
      });
      return posts.length > 0;
    }
  } catch (e) {
    console.error("Shreddit err:", e.message);
  }
  return false;
}

async function testDuckDuckGo() {
  console.log("\n--- Testing DuckDuckGo Public HTML Search ---");
  try {
    const query = encodeURIComponent("site:reddit.com/r/forhire [Hiring]");
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    console.log("DDG status:", res.status);
    if (res.ok) {
      const html = await res.text();
      const results = [...html.matchAll(/<a class="result__snippet[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
      console.log(`Found ${results.length} results via DuckDuckGo!`);
      return results.length > 0;
    }
  } catch (e) {
    console.error("DDG err:", e.message);
  }
  return false;
}

async function run() {
  await testShreddit();
  await testDuckDuckGo();
}
run();
