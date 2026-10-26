import re
import json
import logging
from typing import List, Optional, Any, Dict
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from scrapling.fetchers import FetcherSession, StealthyFetcher

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("scrapling_service")

app = FastAPI(
    title="PingLead Scrapling Sidecar Engine",
    description="Stealth Python microservice powered by Scrapling, curl_cffi and Patchright to bypass Cloudflare & 403 anti-bot blocks",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Unified Data Models
class UnifiedJob(BaseModel):
    id: str
    platform: str
    title: str
    description: str
    url: str
    budget: Optional[str] = None
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: Optional[str] = None
    published_at: Optional[str] = None
    client_hire_rate: Optional[float] = None
    payment_verified: Optional[bool] = None
    total_spent: Optional[str] = None
    bids_count: Optional[int] = None
    client_country: Optional[str] = None
    client_open_projects: Optional[int] = None
    client_in_progress: Optional[int] = None
    client_registered_at: Optional[str] = None
    duration_text: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None

class RedditRequest(BaseModel):
    subreddit: str = "forhire"
    query: Optional[str] = None
    limit: int = 25

class UpworkRequest(BaseModel):
    query: str = "web development"
    limit: int = 20

class MostaqlRequest(BaseModel):
    url: Optional[str] = None
    category: str = "development"
    limit: int = 20

class KhamsatRequest(BaseModel):
    url: str

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "PingLead Scrapling Stealth Engine",
        "timestamp": datetime.utcnow().isoformat()
    }

# ------------------------------------------------------------------------------
# 1. Reddit Endpoint (/scrape/reddit)
# Uses FetcherSession(impersonate="chrome") to evade Reddit's aggressive 403 blocks
# ------------------------------------------------------------------------------
@app.post("/scrape/reddit", response_model=List[UnifiedJob])
def scrape_reddit(req: RedditRequest):
    logger.info(f"Scraping Reddit r/{req.subreddit} with curl_cffi Chrome impersonation...")
    url = f"https://www.reddit.com/r/{req.subreddit}/new.json?limit={min(req.limit, 100)}"
    
    try:
        headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.reddit.com/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        }
        with FetcherSession(impersonate="chrome") as session:
            res = session.get(url, headers=headers, timeout=15)
        
        if res.status != 200:
            logger.warning(f"Reddit returned status {res.status}")
            return []
            
        data = res.json()
        children = data.get("data", {}).get("children", [])
        jobs: List[UnifiedJob] = []

        for item in children:
            post = item.get("data", {})
            title = post.get("title", "")
            selftext = post.get("selftext", "")
            post_id = post.get("id", "")
            permalink = post.get("permalink", "")
            created_utc = post.get("created_utc")
            published_at = (
                datetime.utcfromtimestamp(created_utc).isoformat()
                if created_utc else datetime.utcnow().isoformat()
            )

            # Filter for hiring posts if on forhire or job-related subreddits
            is_hiring = bool(re.search(r"\[hiring\]", title, re.IGNORECASE))
            if req.subreddit.lower() == "forhire" and not is_hiring:
                continue

            if req.query and req.query.lower() not in (title + " " + selftext).lower():
                continue

            # Extract budget heuristics if present
            budget_match = re.search(r"\$(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:-\s*\$?(\d+(?:,\d+)*(?:\.\d+)?))?", title + " " + selftext)
            budget_str = budget_match.group(0) if budget_match else None

            jobs.append(UnifiedJob(
                id=post_id,
                platform="reddit",
                title=title,
                description=selftext[:2000] if selftext else title,
                url=f"https://www.reddit.com{permalink}" if permalink.startswith("/") else f"https://www.reddit.com/{permalink}",
                budget=budget_str,
                published_at=published_at,
                raw_data={"subreddit": req.subreddit, "author": post.get("author")}
            ))

        logger.info(f"Successfully scraped {len(jobs)} jobs from r/{req.subreddit}")
        return jobs
    except Exception as e:
        logger.error(f"Error scraping Reddit r/{req.subreddit}: {str(e)}")
        return []

# ------------------------------------------------------------------------------
# 2. Upwork Endpoint (/scrape/upwork)
# Uses StealthyFetcher (Patchright/Chromium) to resolve Cloudflare Turnstile
# ------------------------------------------------------------------------------
@app.post("/scrape/upwork", response_model=List[UnifiedJob])
def scrape_upwork(req: UpworkRequest):
    logger.info(f"Scraping Upwork for query='{req.query}' using StealthyFetcher...")
    search_url = f"https://www.upwork.com/nx/search/jobs/?q={req.query}&sort=recency"
    
    try:
        response = StealthyFetcher.fetch(
            url=search_url,
            headless=True,
            solve_cloudflare=True,
            network_idle=True,
            timeout=30000
        )
        
        jobs: List[UnifiedJob] = []
        html = response.text

        # 1. Try finding __NUXT__ or embedded state
        nuxt_match = re.search(r"window\.__NUXT__\s*=\s*(\{.+?\});?</script>", html, re.DOTALL)
        if nuxt_match:
            try:
                nuxt_data = json.loads(nuxt_match.group(1))
                # Search state tree for job list
                logger.info("Found __NUXT__ state in Upwork response.")
            except Exception:
                pass

        # 2. CSS Selectors via Scrapling
        tiles = response.css('article[data-test="JobTile"], section[data-test="job-tile-list"] article, .job-tile')
        logger.info(f"Found {len(tiles)} Upwork job tiles via CSS selectors.")

        for idx, tile in enumerate(tiles[:req.limit]):
            try:
                title_el = tile.css('h2.job-tile-title a, a[data-test="UpLink"], h3 a')
                title = title_el[0].text.strip() if title_el else f"Upwork Project #{idx+1}"
                rel_url = title_el[0].attrib.get("href", "") if title_el else ""
                full_url = f"https://www.upwork.com{rel_url}" if rel_url.startswith("/") else rel_url

                desc_el = tile.css('[data-test="job-description-text"], .job-description, p')
                description = desc_el[0].text.strip() if desc_el else ""

                # Budget / Hourly rate
                budget_el = tile.css('[data-test="is-fixed-price"], [data-test="job-type-label"], [data-test="budget"]')
                budget_str = budget_el[0].text.strip() if budget_el else None

                # Client metrics
                tile_text = tile.text
                payment_verified = "payment verified" in tile_text.lower()
                
                spent_match = re.search(r"\$([0-9kK\+]+)\s*spent", tile_text, re.IGNORECASE)
                total_spent = f"${spent_match.group(1)} spent" if spent_match else None

                country_match = re.search(r"location\s*:\s*([a-zA-Z\s]+)", tile_text, re.IGNORECASE)
                client_country = country_match.group(1).strip() if country_match else None

                job_id = re.search(r"~([0-9a-fA-F]+)", full_url)
                ext_id = job_id.group(1) if job_id else f"upwork_{idx}_{int(datetime.utcnow().timestamp())}"

                jobs.append(UnifiedJob(
                    id=ext_id,
                    platform="upwork",
                    title=title,
                    description=description or title,
                    url=full_url or search_url,
                    budget=budget_str,
                    published_at=datetime.utcnow().isoformat(),
                    payment_verified=payment_verified,
                    total_spent=total_spent,
                    client_country=client_country,
                    raw_data={"source": "stealth_search"}
                ))
            except Exception as tile_err:
                logger.warning(f"Error parsing Upwork tile {idx}: {tile_err}")
                continue

        logger.info(f"Successfully extracted {len(jobs)} Upwork jobs.")
        return jobs

    except Exception as e:
        logger.error(f"Error scraping Upwork: {str(e)}")
        return []

# ------------------------------------------------------------------------------
# 3. Mostaql Endpoint (/scrape/mostaql)
# Deep extraction of project details and client stats without Cloudflare blocks
# ------------------------------------------------------------------------------
@app.post("/scrape/mostaql", response_model=List[UnifiedJob])
def scrape_mostaql(req: MostaqlRequest):
    target_url = req.url or f"https://mostaql.com/projects?category={req.category}&sort=latest"
    logger.info(f"Scraping Mostaql URL: {target_url}...")

    try:
        # Use StealthyFetcher to bypass Cloudflare
        res = StealthyFetcher.fetch(
            url=target_url,
            headless=True,
            solve_cloudflare=True,
            timeout=30000
        )
        html = res.text
        jobs: List[UnifiedJob] = []

        # Case A: A single project detail page requested
        if "/project/" in target_url:
            title_el = res.css("h1, .project-title, header h1")
            title = title_el[0].text.strip() if title_el else "مشروع مستقل"

            desc_el = res.css(".project-post__text, .project__brief, .project-details")
            desc = desc_el[0].text.strip() if desc_el else ""

            # Extract client details & metadata from table
            hire_match = re.search(r"معدل التوظيف</span>\s*</td>\s*<td>\s*<label[^>]*>([\s\S]*?)</label>", html, re.IGNORECASE)
            hire_percent = re.search(r"([\d.]+)\s*%", hire_match.group(1)) if hire_match else None
            client_hire_rate = float(hire_percent.group(1)) if hire_percent else None

            open_match = re.search(r"المشاريع المفتوحة</span></td>\s*<td>\s*(\d+)", html, re.IGNORECASE)
            open_count = int(open_match.group(1)) if open_match else None

            progress_match = re.search(r"مشاريع قيد التنفيذ</span></td>\s*<td>\s*(\d+)", html, re.IGNORECASE)
            progress_count = int(progress_match.group(1)) if progress_match else None

            registered_match = re.search(r"تاريخ التسجيل</td>\s*<td>\s*<time>([^<]+)</time>", html, re.IGNORECASE)
            registered_date = registered_match.group(1).strip() if registered_match else None

            # Budget
            budget_match = re.search(r"project-budget_range[^>]*>\s*<span[^>]*>([^<]+)</span>", html, re.IGNORECASE)
            budget_str = budget_match.group(1).strip() if budget_match else None

            # Bids count
            bids_match = re.search(r"عدد العروض</span>\s*</td>\s*<td>\s*(\d+)", html, re.IGNORECASE)
            bids_count = int(bids_match.group(1)) if bids_match else None

            # Payment verified check
            payment_verified = bool(
                "هوية موثقة" in html or
                "بريد مؤكد" in html or
                "جوال مؤكد" in html or
                (client_hire_rate and client_hire_rate > 0)
            )

            id_match = re.search(r"/project/(\d+)", target_url)
            proj_id = id_match.group(1) if id_match else f"mostaql_{int(datetime.utcnow().timestamp())}"

            jobs.append(UnifiedJob(
                id=proj_id,
                platform="mostaql",
                title=title,
                description=desc,
                url=target_url,
                budget=budget_str,
                published_at=datetime.utcnow().isoformat(),
                client_hire_rate=client_hire_rate,
                payment_verified=payment_verified,
                bids_count=bids_count,
                client_open_projects=open_count,
                client_in_progress=progress_count,
                client_registered_at=registered_date,
                raw_data={"single_project": True}
            ))
            return jobs

        # Case B: Category / Listing page
        cards = res.css("tr.project-row, .card--project, .project-card, tbody tr")
        logger.info(f"Found {len(cards)} project rows on Mostaql listing page.")

        for idx, card in enumerate(cards[:req.limit]):
            try:
                title_link = card.css("h2 a, h3 a, a.project-title, td.details a")
                if not title_link:
                    continue
                title = title_link[0].text.strip()
                rel_url = title_link[0].attrib.get("href", "")
                full_url = f"https://mostaql.com{rel_url}" if rel_url.startswith("/") else rel_url

                card_id_match = re.search(r"/project/(\d+)", full_url)
                card_id = card_id_match.group(1) if card_id_match else f"mostaql_{idx}"

                desc_el = card.css("p.project__brief, .project-desc, .text-muted")
                description = desc_el[0].text.strip() if desc_el else title

                jobs.append(UnifiedJob(
                    id=card_id,
                    platform="mostaql",
                    title=title,
                    description=description,
                    url=full_url,
                    published_at=datetime.utcnow().isoformat(),
                    raw_data={"category": req.category}
                ))
            except Exception as card_err:
                logger.warning(f"Error parsing Mostaql card {idx}: {card_err}")
                continue

        logger.info(f"Successfully scraped {len(jobs)} projects from Mostaql.")
        return jobs
    except Exception as e:
        logger.error(f"Error scraping Mostaql: {str(e)}")
        return []

# ------------------------------------------------------------------------------
# 4. Khamsat Endpoint (/scrape/khamsat)
# Resolves AWS WAF challenge via Patchright and extracts token & content
# ------------------------------------------------------------------------------
@app.post("/scrape/khamsat")
async def scrape_khamsat(req: KhamsatRequest):
    logger.info(f"Resolving Khamsat with Patchright: {req.url}...")
    try:
        from patchright.async_api import async_playwright
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
                locale="ar-EG"
            )
            page = await context.new_page()
            await page.goto("https://khamsat.com/community/requests", wait_until="domcontentloaded")
            await page.goto(req.url, wait_until="networkidle")
            content = await page.content()
            cookies = await context.cookies()
            waf_token = next((c['value'] for c in cookies if 'aws-waf-token' in c['name'].lower()), None)
            await browser.close()
            return {"html": content, "waf_token": waf_token}
    except Exception as e:
        logger.error(f"Error scraping Khamsat via Patchright: {str(e)}")
        return {"html": "", "waf_token": None, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
