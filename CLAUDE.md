# AI Lead Radar (PingLead) - System Architecture & Technical Specifications

> **Source of Truth**: Extracted from `المواصفات الهندسية والتقنية الشاملة لبناء رادار اصطياد العملاء.pdf`

## 1. Project Overview & Vision
A production-ready Micro-SaaS for real-time B2B buying-intent detection across public social platforms (Reddit, X/Twitter, LinkedIn) with instant Telegram alerts and on-demand AI smart reply generation.

### Core Stack
- **Framework**: Next.js 15 (App Router, TypeScript, Tailwind CSS)
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security - RLS)
- **AI Classification**: Google Gemini 2.5 Flash SDK (`@google/genai`) using Structured JSON (`responseSchema`)
- **Ingestion**:
  - Reddit: Public `.json` endpoints with custom `User-Agent`
  - X (Twitter): SocialData API
  - LinkedIn: Serper Google Search API
- **Alerts & Bot**: Telegram Bot API + Scheduled Cron (`/api/cron/ingest`)

---

## 2. Core Architectural Rules (Strict & Non-Negotiable)
1. **Zero Per-User Scraping**: Ingestion runs globally per active `category_slug` via `/api/cron/ingest` every 3 minutes. Posts are deduplicated in `leads_pool` via `UNIQUE(platform, external_post_id)`.
2. **3-Stage Cost Funnel**:
   - **Stage 1 (Pre-Filter)**: `passesPreFilter()` with Arabic & English Negative Regex and >3 hashtag exclusion to eliminate sellers and spam at $0 cost (saves ~85% AI tokens).
   - **Stage 2 (AI Batch Classifier)**: Pending posts are batched in groups of 20 into a single Gemini 2.5 Flash call with strict JSON `responseSchema`.
   - **Stage 3 (On-Demand Smart Reply)**: AI pitch generation runs ONLY when a user clicks the Telegram inline button `gen_reply:<deliveryId>`, using the user's specific `bio_context`.

---

## 3. Project Directory Structure
```
ai-lead-radar/
├── src/
│   ├── app/
│   │   ├── (auth)/login/page.tsx             # Supabase Auth (Google / Magic Link)
│   │   ├── (dashboard)/dashboard/page.tsx    # Caught leads feed & user stats
│   │   ├── (dashboard)/settings/page.tsx     # Categories, keywords & Telegram link
│   │   └── api/
│   │       ├── cron/ingest/route.ts          # Ingestion + Filter + AI batch cron (every 3m)
│   │       ├── webhooks/telegram/route.ts    # Telegram bot webhook (/start, connect, reply generation)
│   │       └── webhooks/billing/route.ts     # LemonSqueezy / Paymob billing webhooks
│   ├── lib/
│   │   ├── scrapers/
│   │   │   ├── reddit.ts                     # Reddit public JSON parser with custom User-Agent
│   │   │   ├── twitter.ts                    # X search via SocialData API
│   │   │   └── linkedin.ts                   # LinkedIn posts via Serper Google Search API
│   │   ├── filters/
│   │   │   └── negative-regex.ts             # Reverse filter dropping sellers and hashtag spam
│   │   ├── ai/
│   │   │   ├── batch-classifier.ts           # Gemini 2.5 Flash batch classifier (20 posts/call)
│   │   │   └── reply-generator.ts            # Personalized proposal writer using user bio_context
│   │   ├── telegram/
│   │   │   └── dispatcher.ts                 # Sends interactive Telegram alert cards with inline buttons
│   │   └── supabase/
│   │       ├── client.ts                     # Browser Supabase client
│   │       └── admin.ts                      # Service Role admin client (bypasses RLS for backend)
└── supabase/
    └── migrations/
        └── 0001_init_schema.sql              # Schema DDL, RLS policies & initial category seeds
```

---

## 4. Database Schema Summary
- `public.profiles`: User account details, `bio_context` for smart replies, `telegram_chat_id`, `telegram_connect_token`, `subscription_tier` ('trial', 'freelancer', 'agency', 'expired'), `subscription_ends_at`, `smart_replies_used`.
- `public.categories`: Predefined industry categories (`web_dev`, `ui_ux`, `marketing`, `accounting`, etc.), subreddits array, Arabic/English boolean query strings.
- `public.user_subscriptions_map`: User's subscribed categories, custom include keywords, and minimum intent score threshold (default: 8).
- `public.leads_pool`: Deduplicated posts across platforms, with `intent_score` (0-10), `is_buyer`, `ai_reason_short`, and status (`pending`, `rejected_regex`, `scored`, `dispatched`).
- `public.user_lead_deliveries`: Delivery audit trail linking users to dispatched leads.

---

## 5. 5-Phase Execution Plan
- **Phase 1**: Next.js 15 + Supabase Auth & Schema Setup (`0001_init_schema.sql` + Seed Data + Client/Admin utilities).
- **Phase 2**: Ingestion & Pre-Filtering Engine (`reddit.ts`, `twitter.ts`, `linkedin.ts`, `negative-regex.ts` + tests).
- **Phase 3**: AI Intent Classification Engine (`batch-classifier.ts` with Gemini 2.5 Flash + `/api/cron/ingest`).
- **Phase 4**: Telegram Bot & Interactive Reply Engine (`dispatcher.ts`, `/api/webhooks/telegram`, `reply-generator.ts`).
- **Phase 5**: Web Application Dashboard, Settings UI & Billing Integration (Next.js modern UI + LemonSqueezy/Paymob).
