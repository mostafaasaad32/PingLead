// ==============================================================================
// src/lib/scrapers/khamsat.ts
// Khamsat (خمسات) Buyer Requests Scraper Engine
// Siphons real-time direct buyer requests ("طلبات الخدمات غير الموجودة") with authentic dates
// Extracts authentic inner request description, buyer name & rank, proposals count,
// and returns client_evaluation with score: null & hideClientBadge: true (no fake ratings).
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory, ProjectInsights } from './types';
import { parseArabicRelativeDate } from './utils';
import { extractCleanBudget, isCategoryMatch } from '../filters/categorizer';
import { classifyProject } from '../taxonomy';
import { ClientEvaluation, buildPlatformMetricsChips } from '../scoring/client-scorer';
import { SCRAPLING_SERVICE_URL } from './scrapling-bridge';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

// Long-lived AWS WAF token for Khamsat, dynamically refreshed if challenged
let cachedWafToken: string =
  '66b2a8c7-e726-4579-bb47-dee8d75a5011:CgoAbepqCi1BLwAA:H8mT/hkgfjkNCPUejcoHIebtjHK/QKDZy4r0/cVZUyshaz41F1BoTMstkoCbCLIU6j/d0gAy1zRqYB/zqiavYmWwobpJBYriKM4zh6sOlyoXs/KzfzWxd8wVDStUoCCOFZU65iHdZxJFnUTKsvMXxDkBaXiAT4rK2XTehmsU4pC66ngzkaiOd4FC7KRQ9lV0/9tcw0zKimkapgtz9mFfDE6ZzgHuLQ5AmPtUOkHVwhwT2dQHdQBPTF5nXc/qlNqMiKfTiLMwQBGkM9WognwOT9vKtjDG';

export interface KhamsatRequestDetails extends ProjectInsights {
  description?: string;
  author?: string;
  author_rank?: string | null;
  bids_count?: number | null;
  payment_verified?: boolean;
  client_evaluation: ClientEvaluation;
  details_fetched_at: string;
}

/**
 * Builds standard Khamsat ClientEvaluation with score: null and hideClientBadge: true.
 * This guarantees zero fake ratings and zero false warning red flags in the UI.
 */
export function createKhamsatClientEvaluation(isVerified: boolean = false): ClientEvaluation {
  return {
    score: null,
    hideClientBadge: true,
    badge: 'none',
    labelAr: 'طلب خدمة في خمسات',
    paymentVerified: isVerified,
    platform: 'khamsat',
    metricsChips: buildPlatformMetricsChips({
      platform: 'khamsat',
      paymentVerified: isVerified,
      score: null,
    }),
    redFlags: [],
    greenFlags: [
      'طلب خدمة في مجتمع خمسات - التعامل والضمان المالي محمي عبر حسوب',
      'المشتري يدفع ويحجز المبلغ عند طلب الخدمة مباشرة',
    ],
    negotiationTipAr:
      'في خمسات: المشتري يبحث عن خدمة واضحة وجاهزة للتنفيذ؛ قدّم رداً مختصراً يوضح جاهزيتك للبدء فوراً مع رابط خدمتك ذات الصلة.',
  };
}

/**
 * Fetches the inner request page for a Khamsat community request.
 * Extracts:
 * 1. The genuine full description written by the buyer in the first post
 * 2. The author name and rank (مشتري / بائع جديد / مسوق رقمي / مهندس...)
 * 3. Total proposals/replies count
 * 4. Client evaluation with score: null & hideClientBadge: true
 */
export async function fetchKhamsatRequestDetails(
  requestUrl: string
): Promise<KhamsatRequestDetails | null> {
  try {
    let res = await fetch(requestUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Cookie': `aws-waf-token=${cachedWafToken}`,
      },
    });

    let html = '';

    if (res.ok) {
      const text = await res.text();
      // Verify if AWS WAF challenge intercepted the request
      if (text.includes('challenge-container') && text.length < 3000) {
        console.warn(`[Khamsat Details] Token challenged for ${requestUrl}. Calling sidecar fallback...`);
        res = { ok: false } as any;
      } else {
        html = text;
      }
    }

    // Fallback: If 202 or challenged, call Scrapling sidecar to resolve WAF
    if (!res.ok) {
      try {
        const sidecarRes = await fetch(`${SCRAPLING_SERVICE_URL}/scrape/khamsat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: requestUrl }),
        });
        if (sidecarRes.ok) {
          const sData = (await sidecarRes.json()) as { html?: string; waf_token?: string };
          if (sData.html && sData.html.length > 5000) {
            html = sData.html;
            if (sData.waf_token) cachedWafToken = sData.waf_token;
          }
        }
      } catch (sidecarErr: any) {
        console.warn(`[Khamsat Details] Sidecar unreachable:`, sidecarErr.message);
      }
    }

    if (!html) return null;

    // 1. Extract Real Full Description from the first post
    const articleMatch =
      html.match(/<article[^>]*class="[^"]*replace_urls[^"]*"[^>]*>([\s\S]*?)<\/article>/i) ||
      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

    let description: string | undefined = undefined;
    if (articleMatch) {
      description = articleMatch[1]
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/\r/g, '')
        .trim();
    }

    // 2. Extract Author & Rank/Profession
    const authorMatch =
      html.match(/<a[^>]*class="sidebar_user"[^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/ناشر الموضوع[\s\S]{0,400}?<a[^>]*class="user"[^>]*>([\s\S]*?)<\/a>/i);
    const author = authorMatch ? authorMatch[1].replace(/<[^>]*>/g, '').trim() : undefined;

    const rankMatch =
      html.match(/<i class="fa fa-fw fa-briefcase"><\/i>\s*([^<\n\r]+)/i) ||
      html.match(/class="details-list"[\s\S]*?<li>\s*<i[^>]*briefcase[^>]*><\/i>\s*([^<]+)/i);
    const authorRank = rankMatch ? rankMatch[1].replace(/<[^>]*>/g, '').trim() : null;

    // 3. Extract Proposals / Comments Count
    const commentsMatch = html.match(/التعليقات\s*\((\d+)\)/i);
    const bidsCount = commentsMatch ? parseInt(commentsMatch[1], 10) : null;

    // 4. Verification
    const isVerified = html.includes('title="هوية موثقة"');

    return {
      description,
      author,
      author_rank: authorRank,
      bids_count: bidsCount,
      payment_verified: isVerified,
      client_evaluation: createKhamsatClientEvaluation(isVerified),
      details_fetched_at: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn(`[Khamsat Details] Could not fetch details for ${requestUrl}:`, err.message);
    return null;
  }
}

/**
 * Scrapes fresh buyer requests from Khamsat Community Requests section.
 */
export async function scrapeKhamsatCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 25
): Promise<UnifiedProject[]> {
  const url = 'https://khamsat.com/community/requests';

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        'Cookie': `aws-waf-token=${cachedWafToken}`,
      },
    });

    if (!res.ok) {
      console.warn(`[Khamsat Scraper] returned HTTP ${res.status}`);
      return [];
    }

    const html = await res.text();
    const regex = /href=["'](\/community\/requests\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const authorRegex = /<a\s+class="user"[^>]*href="\/user\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

    const items: Array<{ href: string; id: string; title: string; index: number }> = [];
    const seenIds = new Set<string>();

    let match;
    while ((match = regex.exec(html)) !== null) {
      const href = match[1];
      const id = match[2];
      const cleanTitle = match[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      if (cleanTitle && !seenIds.has(id)) {
        seenIds.add(id);
        items.push({ href, id, title: cleanTitle, index: match.index });
      }
    }

    const authors: string[] = [];
    let aMatch;
    while ((aMatch = authorRegex.exec(html)) !== null) {
      const cleanAuthor = aMatch[1].replace(/<[^>]*>/g, '').trim();
      if (cleanAuthor) authors.push(cleanAuthor);
    }

    const projects: UnifiedProject[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Intent-first classification for Khamsat community requests
      const classResult = classifyProject({
        platform: 'khamsat',
        title: item.title,
        description: item.title,
      });

      // If user filtered by a specific category, match it
      if (categorySlug !== 'all' && !isCategoryMatch(classResult.category, categorySlug)) continue;

      const author = authors[i] || 'مشتري خمسات';
      const exactUrl = `https://khamsat.com${item.href}`;

      // Extract exact date from title attribute (e.g. title="17&#x2F;10&#x2F;2026 09:21:10 GMT") or relative "منذ..."
      const cardContext = html.slice(item.index, item.index + 1600);
      const titleTimeMatch = cardContext.match(
        /title=["'](\d{1,2}(?:&#x2F;|\/)\d{1,2}(?:&#x2F;|\/)\d{4}\s+\d{1,2}:\d{1,2}:\d{1,2}[^"']*)["']/i
      );
      const agoMatch = cardContext.match(/(منذ\s+[^<]+)/i);
      const rawDate = titleTimeMatch ? titleTimeMatch[1] : agoMatch ? agoMatch[1].trim() : null;
      const publishedAt = parseArabicRelativeDate(rawDate);

      // Khamsat requests have no budget field; only use one if the buyer wrote it in the title
      const budget = extractCleanBudget(item.title);

      projects.push(
        createUnifiedProject({
          external_id: item.id,
          platform: 'khamsat',
          title: item.title,
          description: item.title,
          url: exactUrl,
          budget: budget.budget_text || null,
          budget_min: budget.budget_min || null,
          budget_max: budget.budget_max || null,
          currency: budget.currency || 'USD',
          language: 'ar',
          category: classResult.category,
          published_at: publishedAt,
          author,
          insights: {
            client_evaluation: createKhamsatClientEvaluation(false),
          },
        })
      );

      if (projects.length >= limit) break;
    }

    // If fetching a focused batch (limit <= 8), enrich the newest projects right away
    if (projects.length > 0 && limit <= 8) {
      const enrichTargets = projects.slice(0, 5);
      await Promise.all(
        enrichTargets.map(async (p) => {
          const details = await fetchKhamsatRequestDetails(p.url);
          if (details) {
            if (details.description && details.description.length > 15) {
              p.description = details.description;
            }
            if (details.author) p.author = details.author;
            if (details.author_rank && !p.author.includes(details.author_rank)) {
              p.author = `${p.author} (${details.author_rank})`;
            }
            if (typeof details.bids_count === 'number') {
              p.bids_count = details.bids_count;
            }
            p.payment_verified = details.payment_verified ?? false;
            p.client_evaluation = details.client_evaluation;
            p.details_fetched_at = details.details_fetched_at;
          }
        })
      );
    }

    console.log(`[Khamsat Scraper] Successfully extracted ${projects.length} live requests for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[Khamsat Scraper] Error scraping for ${categorySlug}:`, err.message);
    return [];
  }
}
