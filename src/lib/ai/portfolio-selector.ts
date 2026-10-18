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

/**
 * Selects the top 1 or 2 most relevant portfolio items for a given freelance project.
 * Scores based on category alignment, shared tech tags, conceptual relevance, and live link presence.
 */
export function selectBestPortfolioItems(
  project: ProjectContext,
  portfolioItems: PortfolioItem[],
  maxItems: number = 2
): ScoredPortfolioItem[] {
  if (!portfolioItems || portfolioItems.length === 0) {
    return [];
  }

  const combinedProjectText = `${project.title || ''} ${project.description || ''}`;
  const normalizedProjectText = normalizeText(combinedProjectText);
  const scoredItems: ScoredPortfolioItem[] = [];

  for (const item of portfolioItems) {
    let score = 0;
    const matchReasons: string[] = [];

    // 1. Category Alignment (+15 points)
    if (project.category && item.category) {
      if (item.category.toLowerCase() === project.category.toLowerCase()) {
        score += 15;
        matchReasons.push(`نفس التصنيف البرمجي (${item.category})`);
      }
    }

    // 2. Shared Tech Tags (+20 points per matched tag)
    if (Array.isArray(item.tags) && item.tags.length > 0) {
      const matchedTags: string[] = [];
      for (const tag of item.tags) {
        if (matchesKeyword(normalizedProjectText, tag)) {
          score += 20;
          matchedTags.push(tag);
        }
      }
      if (matchedTags.length > 0) {
        matchReasons.push(`وسوم تقنية مشتركة: [${matchedTags.join(', ')}]`);
      }
    }

    // 3. Project Title Keyword Relevance (+15 points)
    if (item.project_title && matchesKeyword(normalizedProjectText, item.project_title)) {
      score += 15;
      matchReasons.push(`تطابق في عنوان العمل: "${item.project_title}"`);
    }

    // 4. Conceptual Description Keyword Overlap (+3 points per keyword, max 15)
    if (item.description) {
      const words = item.description
        .split(/\s+/)
        .map((w) => w.replace(/[^\w\u0600-\u06FF]/g, '').trim())
        .filter((w) => w.length >= 4);

      const uniqueWords = Array.from(new Set(words));
      let overlapCount = 0;

      for (const word of uniqueWords) {
        if (matchesKeyword(normalizedProjectText, word)) {
          overlapCount++;
          if (overlapCount <= 5) score += 3;
        }
      }

      if (overlapCount > 0) {
        matchReasons.push(`تطابق مفاهيمي في الوصف (${overlapCount} كلمات رئيسية)`);
      }
    }

    // 5. Live URL Bonus (+10 points for verifiable proof)
    if (item.live_url && item.live_url.startsWith('http')) {
      score += 10;
      matchReasons.push('رابط حي متاح للمعاينة المباشرة');
    }

    // If item has any positive relevance, add to pool
    if (score > 0) {
      scoredItems.push({
        item,
        score,
        matchReasons,
      });
    }
  }

  // Sort by score descending
  scoredItems.sort((a, b) => b.score - a.score);

  return scoredItems.slice(0, maxItems);
}

/**
 * Formats selected portfolio items into a crisp, high-impact prompt injection
 * for the AI proposal generator.
 */
export function formatPortfolioForPrompt(selectedItems: ScoredPortfolioItem[]): string {
  if (!selectedItems || selectedItems.length === 0) {
    return 'No specific portfolio links available. Rely on freelancer bio and skills.';
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
RELEVANT PORTFOLIO PROOF OF WORK (Select and cite the most relevant one naturally in the proposal with its link as tangible proof):
${itemsFormatted}
`.trim();
}
