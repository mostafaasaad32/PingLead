// ==============================================================================
// src/lib/scrapers/kafiil.ts
// Arabic Freelance Platform Scraper (Kafiil - كفيل)
// Scrapes open client projects directly from https://kafiil.com/projects with authentic dates
// Includes fetchKafiilProjectDetails for incremental deep enrichment (real description, budget, buyer)
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory, ProjectInsights } from './types';
import { parseArabicRelativeDate } from './utils';
import { extractCleanBudget } from '../filters/categorizer';
import { classifyProject } from '../taxonomy';
import { calculateClientScore } from '../scoring/client-scorer';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const CATEGORY_MAP: Record<string, string> = {
  web_mobile_dev: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  web_dev: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  ai_data_automation: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  it_cybersecurity_devops: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  game_ar_vr: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  ecommerce_stores: 'https://kafiil.com/projects/programming-web-and-application-development-2?page=1',
  ui_ux_graphic: 'https://kafiil.com/projects/design-video-and-audio-1?page=1',
  ui_ux: 'https://kafiil.com/projects/design-video-and-audio-1?page=1',
  design: 'https://kafiil.com/projects/design-video-and-audio-1?page=1',
  video_audio_motion: 'https://kafiil.com/projects/design-video-and-audio-1?page=1',
  digital_marketing_seo: 'https://kafiil.com/projects/marketing-and-sales-2?page=1',
  marketing: 'https://kafiil.com/projects/marketing-and-sales-2?page=1',
  writing_translation: 'https://kafiil.com/projects/writing-content-creation-translation-and-languag-2?page=1',
  writing: 'https://kafiil.com/projects/writing-content-creation-translation-and-languag-2?page=1',
  business_accounting_legal: 'https://kafiil.com/projects/other-things-2?page=1',
  accounting: 'https://kafiil.com/projects/other-things-2?page=1',
  sales_customer_support: 'https://kafiil.com/projects/training-education-and-remote-assistance-2?page=1',
  engineering_architecture: 'https://kafiil.com/projects/design-video-and-audio-1?page=1',
  education_training: 'https://kafiil.com/projects/training-education-and-remote-assistance-2?page=1',
  other: 'https://kafiil.com/projects?page=1',
};

export interface KafiilProjectDetails extends ProjectInsights {
  description?: string;
  budget_min?: number | null;
  budget_max?: number | null;
  budget_text?: string | null;
  currency?: string;
  author?: string;
  client_profession?: string | null;
  client_country?: string | null;
}

/**
 * Reads the project page on Kafiil to extract the actual full description,
 * verified budget range, duration, and buyer profile.
 */
export async function fetchKafiilProjectDetails(
  projectUrl: string
): Promise<KafiilProjectDetails | null> {
  try {
    const res = await fetch(projectUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // 1. Genuine Full Description
    const descMatch =
      html.match(/تفاصيل المشروع\s*<\/p>[\s\S]*?<div class="has-padding">\s*<p[^>]*>([\s\S]*?)<\/p>/i) ||
      html.match(/fas fa-list-alt"><\/i>\s*تفاصيل المشروع[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);

    let description: string | undefined = undefined;
    if (descMatch) {
      description = descMatch[1]
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\r/g, '')
        .trim();
    }

    // 2. Budget
    const budgetMatch = html.match(/الميزانية\s*<\/td>\s*<td>\s*([^<]+)<\/td>/i);
    const budgetRaw = budgetMatch ? budgetMatch[1].trim() : null;
    const cleanBud = budgetRaw ? extractCleanBudget(budgetRaw) : null;

    // 3. Duration
    const durationMatch = html.match(/مدة المشروع\s*<\/td>\s*<td>\s*([^<]+)<\/td>/i);
    const durationText = durationMatch ? durationMatch[1].trim() : null;

    // 4. Buyer Info
    const ownerSection = html.includes('صاحب المشروع')
      ? html.slice(html.indexOf('صاحب المشروع'), html.indexOf('صاحب المشروع') + 2000)
      : '';

    const authorMatch = ownerSection.match(/class="info">[\s\S]*?<a[^>]*class="name"[^>]*>([\s\S]*?)<\/a>/i);
    const author = authorMatch ? authorMatch[1].replace(/<[^>]*>/g, '').trim() : undefined;

    const profMatch = ownerSection.match(/fa-briefcase"><\/i>\s*([^<\n\r]+)/i);
    const clientProfession = profMatch ? profMatch[1].replace(/<[^>]*>/g, '').trim() : null;

    const countryMatch = ownerSection.match(/class="country"[^>]*>([\s\S]*?)<\/span>/i);
    const clientCountry = countryMatch ? countryMatch[1].replace(/<[^>]*>/g, '').trim() : null;

    return {
      description,
      budget_min: cleanBud?.budget_min || null,
      budget_max: cleanBud?.budget_max || null,
      budget_text: cleanBud?.budget_text || budgetRaw,
      currency: cleanBud?.currency || 'USD',
      duration_text: durationText,
      author,
      client_profession: clientProfession,
      client_country: clientCountry,
      details_fetched_at: new Date().toISOString(),
      client_evaluation: calculateClientScore({
        platform: 'kafiil',
        description,
        budget: cleanBud?.budget_text || budgetRaw,
        budget_min: cleanBud?.budget_min || null,
        budget_max: cleanBud?.budget_max || null,
        client_country: clientCountry,
        client_profession: clientProfession,
        duration_text: durationText,
      }),
    };
  } catch (err: any) {
    console.warn(`[Kafiil Details] Failed to fetch ${projectUrl}:`, err.message);
    return null;
  }
}

/**
 * Scrapes open client projects from Kafiil marketplace.
 */
export async function scrapeKafiilCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 25
): Promise<UnifiedProject[]> {
  const url = CATEGORY_MAP[categorySlug] || 'https://kafiil.com/projects';

  try {
    let res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.9',
      },
    });

    if (!res.ok && url !== 'https://kafiil.com/projects') {
      res = await fetch('https://kafiil.com/projects', {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ar,en;q=0.9',
        },
      });
    }

    if (!res.ok) {
      console.warn(`[Kafiil Scraper] HTTP ${res.status} returned from ${url}`);
      return [];
    }

    const html = await res.text();
    const projects: UnifiedProject[] = [];

    const projectRegex =
      /<a\s+href="(https:\/\/kafiil\.com\/project\/(\d+)-[^"]*)"\s+class="name\s+bold-text[^"]*">([\s\S]*?)<\/a>/gi;

    let match;
    while ((match = projectRegex.exec(html)) !== null && projects.length < limit) {
      const projectUrl = match[1];
      const projectId = match[2];
      const rawTitle = match[3];

      const cleanTitle = rawTitle.replace(/<[^>]*>/g, '').replace(/مفتوح/g, '').replace(/\s+/g, ' ').trim();
      if (!cleanTitle) continue;

      // Percent-encoded Arabic URLs make the title link alone several hundred chars long
      const subHtml = html.slice(match.index, match.index + 4000);
      const authorMatch = subHtml.match(/class="text\s+user"[^>]*>([\s\S]*?)<\/a>/i);
      const author = authorMatch
        ? authorMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        : 'عميل كفيل';

      const agoMatch = subHtml.match(/<i class="far fa-clock"><\/i>\s*([\s\S]*?)<\/span>/i);
      const publishedAt = parseArabicRelativeDate(agoMatch ? agoMatch[1].replace(/<[^>]*>/g, '').trim() : null);

      // Bids so far: <i class="fas fa-hand-holding-usd"></i> 15 عروض (stop at the next card)
      const nextCard = subHtml.indexOf('class="name bold-text', match[0].length);
      const cardHtml = nextCard > 0 ? subHtml.slice(0, nextCard) : subHtml;
      const bidsMatch = cardHtml.match(/fa-hand-holding-usd"><\/i>\s*(\d+)/i);

      // Raw category slug and tags
      const rawCatSlug = url.includes('/projects/') ? url.split('/projects/')[1].split('?')[0] : null;
      const kTags = [...cardHtml.matchAll(/href="[^"]*tag[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)]
        .map((m) => m[1].replace(/<[^>]*>/g, '').trim())
        .filter(Boolean);

      // Category classification via 3-Layer Master Taxonomy
      const classResult = classifyProject({
        platform: 'kafiil',
        title: cleanTitle,
        description: cleanTitle,
        rawCategory: rawCatSlug,
        skills: kTags,
      });

      const budget = extractCleanBudget(`${cleanTitle} ${cardHtml}`);

      projects.push(
        createUnifiedProject({
          external_id: projectId,
          platform: 'kafiil',
          title: cleanTitle,
          description: cleanTitle, // Populated with full text below for focused batches or via mergeAndEnrichInsights
          url: projectUrl,
          budget: budget.budget_text,
          budget_min: budget.budget_min,
          budget_max: budget.budget_max,
          currency: budget.currency || 'USD',
          language: 'ar',
          category: classResult.category,
          raw_category: rawCatSlug,
          raw_skills: kTags.length > 0 ? kTags : null,
          published_at: publishedAt,
          author,
          insights: { bids_count: bidsMatch ? parseInt(bidsMatch[1], 10) : null },
        })
      );
    }

    // Enrich top projects if limit is small (e.g. quick test or small batches)
    if (projects.length > 0 && limit <= 8) {
      const topItems = projects.slice(0, 5);
      await Promise.all(
        topItems.map(async (p) => {
          const details = await fetchKafiilProjectDetails(p.url);
          if (details) {
            if (details.description && details.description.length > 15) {
              p.description = details.description;
            }
            if (details.budget_text) p.budget = details.budget_text;
            if (details.budget_min) p.budget_min = details.budget_min;
            if (details.budget_max) p.budget_max = details.budget_max;
            if (details.author) p.author = details.author;
            if (details.duration_text) p.duration_text = details.duration_text;
            if (details.client_profession) p.client_profession = details.client_profession;
            if (details.client_country) p.client_country = details.client_country;
            p.client_evaluation = details.client_evaluation;
            p.details_fetched_at = details.details_fetched_at;
          }
        })
      );
    }

    console.log(`[Kafiil Scraper] Extracted ${projects.length} live projects for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[Kafiil Scraper] Error scraping ${categorySlug}:`, err.message);
    return [];
  }
}
