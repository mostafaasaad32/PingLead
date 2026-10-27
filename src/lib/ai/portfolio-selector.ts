// ==============================================================================
// src/lib/ai/portfolio-selector.ts
// Context-Aware Portfolio Selection Engine
// Analyzes project requirements and autonomously selects the best 1-2 past work items
// to provide concrete, live-proof references in AI-generated proposals.
// ==============================================================================

import { PortfolioItem, ProjectCategory } from '../scrapers/types';
import { normalizeText, matchesKeyword } from '../matching/filter-matcher';

export interface ScoredPortfolioItem {
  item: PortfolioItem;
  score: number;
  matchReasons: string[];
}

export interface ProjectContext {
  title: string;
  description: string;
  category?: ProjectCategory | string;
}

// Words too common in project text to show that a work item is related
const STOPWORDS = new Set([
  'مشروع', 'المشروع', 'تطوير', 'تصميم', 'عمل', 'العمل', 'مطلوب', 'احتاج', 'نحتاج', 'خدمة', 'موقع', 'تطبيق', 'كامل',
  'project', 'website', 'design', 'develop', 'development', 'need', 'looking', 'work', 'with', 'that', 'this', 'from',
  'have', 'will', 'your', 'about', 'using', 'build', 'create', 'simple', 'professional',
]);

/** Below this an item isn't cited at all: a wrong reference hurts more than none */
const MIN_RELEVANCE = 20;

/**
 * Selects the top 1 or 2 portfolio items that are actually related to the project.
 * Evidence: shared skill tags, the item's title in the project text, or at least two
 * meaningful description words in common. A live link only adds weight to an item that
 * is already related, and the item's stored category isn't used (it was "web_dev" for
 * every item, so it matched every programming project).
 */
export function selectBestPortfolioItems(
  project: ProjectContext,
  portfolioItems: PortfolioItem[],
  maxItems: number = 2
): ScoredPortfolioItem[] {
  if (!portfolioItems || portfolioItems.length === 0) return [];

  const normalizedProjectText = normalizeText(`${project.title || ''} ${project.description || ''}`);
  const scoredItems: ScoredPortfolioItem[] = [];

  for (const item of portfolioItems) {
    let score = 0;
    const matchReasons: string[] = [];

    // 1. Shared tags (+20 each)
    if (Array.isArray(item.tags) && item.tags.length > 0) {
      const matchedTags = item.tags.filter((tag) => tag && tag.length >= 2 && matchesKeyword(normalizedProjectText, tag));
      if (matchedTags.length > 0) {
        score += 20 * matchedTags.length;
        matchReasons.push(`مهارات مشتركة: [${matchedTags.join(', ')}]`);
      }
    }

    // 2. The item's title appears in the project text (+15)
    if (item.project_title && matchesKeyword(normalizedProjectText, item.project_title)) {
      score += 15;
      matchReasons.push(`تطابق في عنوان العمل: "${item.project_title}"`);
    }

    // 3. Meaningful description words in common (+5 each, counted only from 2 words, max 25)
    if (item.description) {
      const words = Array.from(
        new Set(
          item.description
            .split(/\s+/)
            .map((w) => w.replace(/[^\w؀-ۿ]/g, '').trim())
            .filter((w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()))
        )
      );
      const overlap = words.filter((w) => matchesKeyword(normalizedProjectText, w));
      if (overlap.length >= 2) {
        score += Math.min(25, overlap.length * 5);
        matchReasons.push(`كلمات مشتركة في الوصف (${overlap.slice(0, 5).join('، ')})`);
      }
    }

    // 4. A live link helps only an item that is already related (+10)
    if (score > 0 && item.live_url && item.live_url.startsWith('http')) {
      score += 10;
      matchReasons.push('رابط متاح للمعاينة');
    }

    if (score >= MIN_RELEVANCE) scoredItems.push({ item, score, matchReasons });
  }

  scoredItems.sort((a, b) => b.score - a.score);
  return scoredItems.slice(0, maxItems);
}

/**
 * Formats selected portfolio items into a crisp, high-impact prompt injection
 * for the AI proposal generator.
 */
export function formatPortfolioForPrompt(selectedItems: ScoredPortfolioItem[]): string {
  if (!selectedItems || selectedItems.length === 0) {
    return 'WORK ITEMS: none related to this project. Do not mention any past work or links.';
  }

  const itemsFormatted = selectedItems
    .map((scored, index) => {
      const p = scored.item;
      const linkStr = p.live_url ? ` | Live Link: ${p.live_url}` : '';
      const tagsStr = Array.isArray(p.tags) && p.tags.length > 0 ? ` [${p.tags.join(', ')}]` : '';
      return `${index + 1}. "${p.project_title}"${tagsStr}${linkStr}\n   Brief: ${p.description.slice(0, 250)}`;
    })
    .join('\n\n');

  return `
WORK ITEMS related to this project (you may mention the most relevant one, in one plain sentence with its link):
${itemsFormatted}
`.trim();
}
