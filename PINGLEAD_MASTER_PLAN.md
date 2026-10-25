# PingLead Master Execution Plan: Scrapling Engine & Chrome Copilot
**Project Context:** PingLead is a Next.js (TypeScript) SaaS platform for Arab and global freelancers. We are building a robust backend architecture using a Python Sidecar Microservice (powered by the `Scrapling` library) to bypass Cloudflare/403 blocks for public job feeds. Simultaneously, we are building a Chrome Extension (PingLead Copilot) that evaluates clients, generates AI proposals, and crowdsources jobs directly from the user's authenticated DOM on Upwork and Mostaql.

**Agent Instructions:** You are an autonomous expert software engineer. Execute the following 5 phases sequentially. Do not skip steps. Create, modify, and wire the files exactly as described. Check off each box `[x]` as you complete it.

---

## Phase 1: Python Scrapling Microservice (The Stealth Engine)
**Goal:** Build a FastAPI sidecar that leverages `Scrapling` (`curl_cffi` and `patchright`) to completely bypass anti-bot protections for background job scraping.

- [x] **1.1 Setup Environment:**
  - Create a directory `scrapling_service/` at the root.
  - Create `scrapling_service/requirements.txt` containing: `fastapi`, `uvicorn`, `pydantic`, `patchright`, `curl_cffi`, `scrapling`.
- [x] **1.2 Create FastAPI Server (`scrapling_service/main.py`):**
  - Initialize a FastAPI app with Pydantic models for the request and a unified response (`id`, `platform`, `title`, `description`, `url`, `budget`, `published_at`).
  - **Endpoint `POST /scrape/reddit`:** Use `FetcherSession(impersonate="chrome")` to bypass 403 errors on `https://www.reddit.com/r/{subreddit}/new.json`. Extract posts with `[hiring]` in the title.
  - **Endpoint `POST /scrape/upwork`:** Use `StealthyFetcher` (patchright-based) to navigate to Upwork's public job search. Wait for Cloudflare Turnstile to resolve, then extract the job feed using CSS selectors or by finding `window.__NUXT__`.
  - **Endpoint `POST /scrape/mostaql`:** Use `StealthyFetcher` to extract deep project details and client stats without triggering Cloudflare blocks.

## Phase 2: Next.js to Python Bridge (The Connector)
**Goal:** Route blocked scraping requests seamlessly from Next.js to the Python sidecar.

- [x] **2.1 Create TypeScript Bridge (`src/lib/scrapers/scrapling-bridge.ts`):**
  - Write an async function `fetchFromScrapling(platform: string, payload: any)` that POSTs to `http://127.0.0.1:8000/scrape/${platform}`.
  - Implement a 15-second timeout and graceful fallback (return `[]` on failure so the Next.js app doesn't crash).
- [x] **2.2 Refactor Existing Scrapers (`src/lib/scrapers/index.ts`):**
  - Update the existing scrapers (e.g., `reddit.ts`, `mostaql.ts`, `upwork.ts`) to route their logic through `fetchFromScrapling()` instead of native fetch if the service URL is available.
- [x] **2.3 Dual-Boot Script (`package.json`):**
  - Modify the `dev` script to concurrently run the Next.js server (`next dev`) and the FastAPI server (`cd scrapling_service && uvicorn main:app --port 8000`). Use a tool like `concurrently` if needed.

## Phase 3: PingLead Chrome Extension (The Copilot)
**Goal:** Build a Manifest V3 Chrome Extension that reads client DOM data directly, scores clients, and autofills AI proposals.

- [x] **3.1 Extension Skeleton (`pinglead-extension/manifest.json`):**
  - Create directory `pinglead-extension/`.
  - Setup Manifest V3: Permissions (`storage`, `activeTab`, `scripting`).
  - Add `host_permissions` for `*://*.upwork.com/*`, `*://*.mostaql.com/*`, `*://*.nafezly.com/*`, `http://localhost:3000/*` (and the production Vercel URL).
- [x] **3.2 Content Script (`pinglead-extension/content.js` & `styles.css`):**
  - Inject a floating Emerald Green widget (`#10B981`) on job pages.
  - **Data Extraction:** Write DOM extraction logic for **Upwork** (extract `Total spent`, `Hire rate`, `Payment verified` from "About the client") and **Mostaql** (extract `معدل التوظيف`, `المشاريع المكتملة`).
  - Add a button `⚡ تحليل العميل وتوليد عرض` (Analyze Client & Generate Proposal) that sends the extracted job/client data to the Next.js API.
- [x] **3.3 Autofill Logic (`pinglead-extension/content.js`):**
  - Once the AI proposal string is received, find the textarea for the cover letter on Upwork/Mostaql.
  - Inject the text using simulated keyboard/input events to bypass React/Vue state protections, and add a `📋 Copy` button.
- [x] **3.4 Popup Interface (`pinglead-extension/popup.html` & `popup.js`):**
  - Create a simple settings UI to input the `User ID` (to link to their AI Portfolio) and set the Server URL.

## Phase 4: Next.js API for Extension (Intelligence & Crowdsourcing)
**Goal:** Process extension requests, score the client, generate proposals, and crowdsource jobs.

- [x] **4.1 Create Extension Endpoint (`src/app/api/extension/analyze/route.ts`):**
  - Implement full CORS support (`OPTIONS` and `POST`) for external extension requests.
  - **Client Scoring Algorithm:** Calculate a score (0-10) based on `hireRate`, `paymentVerified`, and `totalSpent`. Generate arrays for `redFlags` and `greenFlags`.
  - **AI Proposal Generation:** Fetch the user's `freelancer_profiles` and `portfolio_items` using the provided User ID. Use Gemini AI to generate a highly targeted proposal (Arabic for Mostaql, English for Upwork).
  - **Crowdsourcing (Save to DB):** Perform an `upsert` of the extracted job into the Supabase `jobs` table so other PingLead users can instantly see it in their radar. Return the proposal and client score.

## Phase 5: Dashboard UI & Database Optimization
**Goal:** Reflect the new data in the UI and maintain database performance.

- [x] **5.1 Client Score in UI (`src/components/JobCard.tsx` or similar):**
  - Add a visual badge for the Client Score in the Dashboard table/cards (e.g., `🟢 9.2/10`, `🟡 6.5/10`, `🔴 3.5/10`).
  - Add a tooltip or drawer to show the specific `redFlags` and `greenFlags` when hovered/clicked.
- [x] **5.2 Auto-Cleanup Logic (Supabase):**
  - Create a Supabase SQL function (or add logic to the background sync API) to delete jobs where `created_at < NOW() - INTERVAL '72 hours'` AND the job ID is not referenced in the user's saved/generated proposals.