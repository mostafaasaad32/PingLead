// ==============================================================================
// src/lib/scrapers/nafezly.ts
// Arabic Freelance Platform Scraper Engine (Nafezly - نفذلي)
// Extracts authentic live projects with genuine source publication timestamps
// Uses direct HTML parsing from https://nafezly.com/projects?sort=latest
// Includes fetchNafezlyProjectDetails for incremental deep enrichment
// ==============================================================================

import { UnifiedProject, createUnifiedProject, ProjectCategory, ProjectInsights } from './types';
import { parseArabicRelativeDate } from './utils';
import { extractCleanBudget } from '../filters/categorizer';
import { classifyProject } from '../taxonomy';
import { calculateClientScore } from '../scoring/client-scorer';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';

const CATEGORY_MAP: Record<string, string> = {
  web_mobile_dev: 'development',
  web_dev: 'development',
  ai_data_automation: 'development',
  it_cybersecurity_devops: 'development',
  game_ar_vr: 'development',
  ecommerce_stores: 'development',
  ui_ux_graphic: 'design',
  ui_ux: 'design',
  design: 'design',
  video_audio_motion: 'design',
  digital_marketing_seo: 'marketing',
  marketing: 'marketing',
  sales_customer_support: 'business',
  support: 'business',
  writing_translation: 'writing-translation',
  writing: 'writing-translation',
  business_accounting_legal: 'business',
  accounting: 'business',
  business: 'business',
  engineering_architecture: 'engineering-architecture',
  education_training: 'training',
  other: 'consulting',
};

export interface NafezlyProjectDetails extends ProjectInsights {
  description?: string;
  author?: string;
  client_profession?: string | null;
  client_country?: string | null;
  client_hire_rate?: number | null;
  payment_verified?: boolean;
}

/**
 * Fetches the inner Nafezly project page to extract the full description,
 * verified client attributes, and exact specifications.
 */
export async function fetchNafezlyProjectDetails(
  projectUrl: string
): Promise<NafezlyProjectDetails | null> {
  try {
    const res = await fetch(projectUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) return null;
    const html = await res.text();

    // 1. Description: from تفاصيل المشروع block or meta tag
    const descMatch =
      html.match(/تفاصيل المشروع<\/div>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
      html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    const description = descMatch
      ? descMatch[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\r/g, '').trim()
      : undefined;

    // 2. Author Name
    const ownerMatches = [...html.matchAll(/data-profile-role="owner"[^>]*>([\s\S]*?)<\/a>/gi)];
    const author =
      ownerMatches
        .map((m) => m[1].replace(/<[^>]*>/g, '').trim())
        .filter(Boolean)[0] || undefined;

    // 3. Country
    const countryMatch = html.match(/fa-map-marker-alt[^>]*><\/span>\s*([^<\n\r]+)/i);
    const clientCountry = countryMatch ? countryMatch[1].trim() : null;

    // 4. Verification
    const isVerified =
      html.includes('fa-badge-check') ||
      html.includes('fa-check') ||
      html.includes('هوية موثقة') ||
      html.includes('موثق');

    // 5. Client Hire Rate & Completed Projects
    const hireRateMatch = html.match(/معدل\s*التوظيف[\s\S]{0,100}?(\d+(?:\.\d+)?)\s*%/i);
    const clientHireRate = hireRateMatch ? parseFloat(hireRateMatch[1]) : null;

    const completedMatch = html.match(/(?:المشاريع المكتملة|مشاريع مكتملة)[\s\S]{0,100}?(\d+)/i);
    const completedProjects = completedMatch ? parseInt(completedMatch[1], 10) : null;

    // 6. Duration
    const durationMatch = html.match(/fa-business-time[^>]*><\/span>\s*([^<\n\r]+)/i);
    const durationText = durationMatch ? durationMatch[1].trim() : null;

    // 7. Bids count
    const bidsMatch = html.match(/fa-ballot[^>]*><\/span>\s*(\d+)/i);
    const bidsCount = bidsMatch ? parseInt(bidsMatch[1], 10) : null;

    // 8. Profession
    const professionMatch = html.match(/fa-suitcase[^"]*"[^>]*><\/span>\s*([^<\n\r]+)/i);
    const clientProfession = professionMatch ? professionMatch[1].replace(/<[^>]*>/g, '').trim() : null;

    return {
      description,
      author,
      client_profession: clientProfession,
      client_country: clientCountry,
      client_hire_rate: clientHireRate,
      client_in_progress: completedProjects,
      payment_verified: isVerified,
      duration_text: durationText,
      bids_count: bidsCount,
      details_fetched_at: new Date().toISOString(),
      client_evaluation: calculateClientScore({
        platform: 'nafezly',
        description,
        author,
        client_country: clientCountry,
        client_profession: clientProfession,
        client_hire_rate: clientHireRate,
        payment_verified: isVerified,
        duration_text: durationText,
        bids_count: bidsCount,
      }),
    };
  } catch (err: any) {
    console.warn(`[Nafezly Details] Failed to fetch ${projectUrl}:`, err.message);
    return null;
  }
}

/**
 * Scrapes fresh, real-world Arabic freelance client projects directly from Nafezly
 * extracting authentic publication dates.
 */
export async function scrapeNafezlyCategory(
  categorySlug: string = 'web_mobile_dev',
  limit: number = 25
): Promise<UnifiedProject[]> {
  const nafezlyCat = CATEGORY_MAP[categorySlug] || 'development';
  let targetUrl =
    categorySlug === 'all'
      ? 'https://nafezly.com/projects?sort=latest'
      : `https://nafezly.com/projects?category=${nafezlyCat}&sort=latest`;

  try {
    let res = await fetch(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      targetUrl = 'https://nafezly.com/projects?sort=latest';
      res = await fetch(targetUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
        },
      });
    }

    if (!res.ok) {
      console.warn(`[Nafezly Scraper] HTTP ${res.status} returned from ${targetUrl}`);
      return [];
    }

    const html = await res.text();
    const projects: UnifiedProject[] = [];

    // Match each project card link and title
    const projectRegex = /<a[^>]*href="(https:\/\/nafezly\.com\/project\/(\d+)-([^\"]+))"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const seenIds = new Set<string>();

    while ((match = projectRegex.exec(html)) !== null && projects.length < limit) {
      const projectUrl = match[1];
      const projectId = match[2];
      const rawTitle = match[4];
      const cleanTitle = rawTitle.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      if (!cleanTitle || seenIds.has(projectId)) continue;
      seenIds.add(projectId);

      // Card context runs until the next (different) project's link
      const rawContext = html.slice(match.index, match.index + 7000);
      const nextProjectRegex = /href="https:\/\/nafezly\.com\/project\/(\d+)-/g;
      let cardEnd = rawContext.length;
      let np;
      while ((np = nextProjectRegex.exec(rawContext)) !== null) {
        if (np[1] !== projectId) {
          cardEnd = np.index;
          break;
        }
      }
      const cardContext = rawContext.slice(0, cardEnd);

      // Competition & client signals: <span class="fal fa-ballot ..."></span> 37 عروض
      const iconText = (icon: string) =>
        cardContext
          .match(new RegExp(`${icon}[^"]*"[^>]*><\\/span>\\s*([^<]+)`, 'i'))?.[1]
          .replace(/\s+/g, ' ')
          .trim() || null;
      const bidsText = iconText('fa-ballot');
      const bidsDigits = bidsText?.match(/\d+/);
      const isVerified =
        cardContext.includes('fa-user-check') ||
        cardContext.includes('fa-badge-check') ||
        cardContext.includes('fa-check-circle') ||
        cardContext.includes('موثق');

      const insights = {
        bids_count: bidsDigits ? parseInt(bidsDigits[0], 10) : null,
        duration_text: iconText('fa-business-time'),
        client_country: iconText('fa-map-marker-alt'),
        payment_verified: isVerified,
      };

      // Extract description
      const descMatch = cardContext.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const desc = descMatch ? descMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : cleanTitle;

      // Extract authentic clock relative time: <span class="fal fa-clock"...></span> منذ ...
      const clockMatch =
        cardContext.match(/fa-clock[^>]*><\/span>\s*([^<\n\r]+)/i) ||
        cardContext.match(/fa-clock[\s\S]{0,120}?(منذ\s+[^<\n\r]+)/i);

      let clockText = clockMatch ? clockMatch[1].replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() : null;
      const publishedAt = parseArabicRelativeDate(clockText);

      // Extract budget
      const budgetMatch = cardContext.match(/(\d+\s*-\s*\d+\s*\$|\d+\s*\$)/i);
      const budget = budgetMatch ? extractCleanBudget(budgetMatch[1]) : extractCleanBudget(`${cleanTitle} ${desc}`);

      // Extract skills / tags if present on card
      const cardSkills = [...cardContext.matchAll(/class="[^"]*(?:badge|tag)[^"]*"[^>]*>([\s\S]*?)<\/(?:span|a)>/gi)]
        .map((m) => m[1].replace(/<[^>]*>/g, '').trim())
        .filter((s) => s && s.length < 40);

      // Category classification via 3-Layer Master Taxonomy
      const classResult = classifyProject({
        platform: 'nafezly',
        title: cleanTitle,
        description: desc,
        rawCategory: categorySlug !== 'all' ? nafezlyCat : undefined,
        skills: cardSkills,
      });

      // Client profession/role on Nafezly
      const professionMatch = cardContext.match(/fa-suitcase[^"]*"[^>]*><\/span>\s*([^<\n\r]+)/i);
      const clientProfession = professionMatch
        ? professionMatch[1].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
        : null;

      // Author extraction
      const ownerMatches = [...cardContext.matchAll(/data-profile-role="owner"[^>]*>([\s\S]*?)<\/a>/gi)];
      let author =
        ownerMatches
          .map((m) => m[1].replace(/<[^>]*>/g, '').trim())
          .filter(Boolean)[0] || 'عميل نفذلي';

      if (author && clientProfession && !author.includes(clientProfession)) {
        author = `${author} (${clientProfession})`;
      }

      projects.push(
        createUnifiedProject({
          external_id: projectId,
          platform: 'nafezly',
          title: cleanTitle,
          description: desc,
          url: projectUrl,
          budget: budget.budget_text,
          budget_min: budget.budget_min,
          budget_max: budget.budget_max,
          currency: budget.currency || 'USD',
          language: 'ar',
          category: classResult.category,
          raw_category: categorySlug !== 'all' ? nafezlyCat : null,
          raw_skills: cardSkills.length > 0 ? cardSkills : null,
          published_at: publishedAt,
          author,
          insights,
        })
      );
    }

    // Enrich top projects if limit is small (e.g. quick test or small batches)
    if (projects.length > 0 && limit <= 8) {
      const topItems = projects.slice(0, 5);
      await Promise.all(
        topItems.map(async (p) => {
          const details = await fetchNafezlyProjectDetails(p.url);
          if (details) {
            if (details.description && details.description.length > 15) {
              p.description = details.description;
            }
            if (details.author) p.author = details.author;
            if (details.client_country) p.client_country = details.client_country;
            if (details.client_hire_rate) p.client_hire_rate = details.client_hire_rate;
            if (details.client_profession) p.client_profession = details.client_profession;
            if (details.payment_verified !== undefined) p.payment_verified = details.payment_verified;
            if (details.client_evaluation) p.client_evaluation = details.client_evaluation;
            p.details_fetched_at = details.details_fetched_at;
          }
        })
      );
    }

    console.log(`[Nafezly Scraper] Extracted ${projects.length} live opportunities with authentic dates for #${categorySlug}`);
    return projects;
  } catch (err: any) {
    console.error(`[Nafezly Scraper] Error scraping ${categorySlug}:`, err.message);
    return [];
  }
}
