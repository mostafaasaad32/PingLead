// ==============================================================================
// src/lib/ai/proposal-generator.ts
// Context-Aware AI Proposal Engine (Vollna Architecture)
// Generates winning proposals tailored to project details, freelancer bio,
// and automatically cites the best 1-2 matching portfolio proof items with live links.
// ==============================================================================

import { PortfolioItem } from '@/lib/scrapers/types';
import {
  selectBestPortfolioItems,
  formatPortfolioForPrompt,
  ScoredPortfolioItem,
} from '@/lib/ai/portfolio-selector';

const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
];

// Written to read like a real freelancer, not a template: an end-to-end review found every
// proposal had the same shape ("خارطة الطريق:" + 3 bold bullets + link + question), markdown
// that shows up raw in marketplace text boxes, stock AI phrases, "[حدد المدة]" placeholders,
// Arabic replies to English jobs, and invented experience when the profile was empty.
const WINNING_PITCH_SYSTEM_INSTRUCTION = `
You write a proposal that a skilled freelancer will paste into a marketplace reply box, under their own name.
It must read like that person wrote it quickly and carefully for THIS client, not like a template or an AI.

HOW IT SHOULD READ
- Open with something specific to this project (a detail, a risk, or what the client actually needs), in your own words. Do not greet, do not restate the title, do not say you read the project.
- Then say briefly how you would do it. Use 2-4 short paragraphs. A short list ("- ") is allowed only when the client listed several separate requirements.
- If a relevant past work item is given below, mention it in one plain sentence with its link as plain text. Never mention a work item that is not given below.
- If the client asks anything or requests something (experience, samples, duration, price, questions), answer it directly.
- End with ONE specific question the client can answer quickly (about their files, access, deadline, or a real choice in the scope).
- Length: 60 to 120 words (Khamsat: 40 to 70).

HONESTY (strict)
- Only state experience, years, tools, numbers or past projects that appear in the FREELANCER PROFILE or WORK ITEMS below.
- If the profile is empty or says "not provided", do not claim any experience at all; talk about the approach instead.
- No placeholders of any kind: never write things like [حدد المدة], [اسمك], [X days], (insert link). If a fact is missing, leave it out.

FORMAT (strict)
- Plain text only: no markdown, no ** or __, no # headings, no bold labels, no "[text](url)" links, no emojis.
- No section titles such as "خطة العمل:", "خارطة الطريق:", "Roadmap:", "My approach:".
- Avoid stock phrases: "دقة متناهية", "بكفاءة عالية", "بأعلى معايير الجودة", "لا تتردد", "يسعدني", "حل متكامل", "نقلة نوعية", "I hope this message finds you well", "I am excited", "seamless", "leverage", "cutting-edge", "robust solution", "Don't hesitate".

LANGUAGE
- Write in the language given as REPLY LANGUAGE, whatever the language of the freelancer's profile.
- Arabic: clear, simple Modern Standard Arabic as experienced freelancers write on Mostaql/Khamsat; short sentences, no flowery or rhymed wording.
- English: plain, direct, conversational.
`.trim();

export interface GenerateProposalInput {
  title: string;
  description: string;
  category?: string;
  platform?: string;
  freelancerBio?: string;
  freelancerSkills?: string | string[];
  toneOfVoice?: string;
  customInstructions?: string;
  portfolioItems?: PortfolioItem[];
  /** Market price/timeline baseline (see pricingPromptHint) for the model to adjust to the real scope */
  pricingHint?: string;
  /** The user's standing instructions from their profile, applied to every proposal */
  standingInstructions?: string | null;
}

export interface GenerateProposalOutput {
  proposal: string;
  selectedPortfolio: ScoredPortfolioItem[];
  modelUsed: string;
  executionTimeMs: number;
}

export async function generateContextAwareProposal(
  input: GenerateProposalInput
): Promise<GenerateProposalOutput> {
  const startTime = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  // 1. Run context-aware portfolio selector to pick top 1-2 proof items
  const selectedPortfolio = selectBestPortfolioItems(
    {
      title: input.title,
      description: input.description,
      category: input.category || 'web_dev',
    },
    input.portfolioItems || [],
    2
  );

  const portfolioPromptContext = formatPortfolioForPrompt(selectedPortfolio);

  // 2. Profile as given: never a made-up default ("Senior ... Engineer") that the model then
  //    presents as the user's experience
  const skillsString = (Array.isArray(input.freelancerSkills) ? input.freelancerSkills.join(', ') : input.freelancerSkills || '').trim();
  const bio = (input.freelancerBio || '').trim();
  const replyLanguage = detectProjectLanguage(input.title, input.description);

  const tone = input.toneOfVoice || 'confident';
  const isKhamsat = (input.platform || '').toLowerCase().includes('khamsat');

  // 3. Build optimized Gemini prompt
  const promptText = `
${WINNING_PITCH_SYSTEM_INSTRUCTION}

PROJECT CONTEXT:
- Platform: ${input.platform || 'Freelance Marketplace'}
- Category: #${input.category || 'general'}
- Title: ${input.title}
- Description & Requirements:
${(input.description || '').slice(0, 2000)}

REPLY LANGUAGE: ${replyLanguage === 'ar' ? 'Arabic' : 'English'}

FREELANCER PROFILE:
- Bio: ${bio || 'not provided'}
- Skills: ${skillsString || 'not provided'}
- Tone: ${tone}
${input.customInstructions ? `- Special User Custom Instructions: ${input.customInstructions}` : ''}
${input.standingInstructions?.trim() ? `- The freelancer's standing instructions (ALWAYS follow these): ${input.standingInstructions.trim().slice(0, 1000)}` : ''}
${isKhamsat ? `
- SPECIAL KHAMSAT COMMUNITY DIRECTIVE:
  * This request is posted in Khamsat community buyer requests ("طلبات الخدمات غير الموجودة").
  * Format the response as a concise, persuasive reply tailored for Khamsat request comments ("رد مقنع ومختصر مناسب لتعليقات طلبات مجتمع خمسات").
  * Clearly emphasize immediate readiness to deliver the exact service professionally and promptly ("يوضح جاهزيته لتنفيذ الخدمة فوراً بمهنية").
  * Mention that the service can be ordered directly through your Khamsat gig/profile.
  * Keep it punchy, respectful, and focused (around 40-70 words).
` : ''}
${input.pricingHint ? `PRICING GUIDANCE (REQUIRED):\n${input.pricingHint}\nInclude one plain sentence with your price and delivery time (e.g. "أقدر أسلّمه خلال 7 أيام بـ 150$" / "I can deliver it in 7 days for $150"), before the closing question.\n` : 'No price guidance: do not mention a price or a delivery date.\n'}
${portfolioPromptContext}

Write the proposal now (plain text only):
`.trim();

  // 4. Try candidate Gemini models with fallback
  let generatedProposal = '';
  let successfulModel = '';

  for (const model of CANDIDATE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            // Some variety between proposals: identical structure is what gives AI text away
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!res.ok) {
        console.warn(`[AI Proposal Generator] Model ${model} returned HTTP ${res.status}, trying fallback...`);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 30) {
        generatedProposal = cleanProposalText(text);
        successfulModel = model;
        break;
      }
    } catch (err: any) {
      console.warn(`[AI Proposal Generator] Exception with ${model}:`, err.message);
    }
  }

  if (!generatedProposal) {
    throw new Error('Failed to generate proposal across all candidate Gemini models.');
  }

  return {
    proposal: generatedProposal,
    selectedPortfolio,
    modelUsed: successfulModel,
    executionTimeMs: Date.now() - startTime,
  };
}

/** 'ar' when the project itself is mostly Arabic, otherwise 'en' (the reply follows the project). */
export function detectProjectLanguage(title?: string | null, description?: string | null): 'ar' | 'en' {
  const text = `${title || ''} ${(description || '').slice(0, 1500)}`;
  const arabic = (text.match(/[؀-ۿ]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return arabic > 0 && arabic >= latin * 0.5 ? 'ar' : 'en';
}

/**
 * Makes the model's output safe to paste into a plain marketplace text box: strips markdown,
 * turns [text](url) into the url, removes leftover placeholders like "[حدد المدة]".
 */
export function cleanProposalText(raw: string): string {
  let t = raw.replace(/\r/g, '').trim();
  t = t.replace(/^```[a-z]*\n?|```$/gim, '');
  t = t.replace(/\[([^\]\n]*)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label: string, url: string) =>
    !label || label.trim() === url || /^https?:/.test(label.trim()) ? url : `${label.trim()}: ${url}`
  );
  t = t.replace(/\*\*|__/g, '');
  t = t.replace(/^#{1,6}\s*/gm, '');
  // Template section titles on their own line ("خطة العمل:", "Roadmap:")
  t = t.replace(/^\s*(?:خطة العمل|خارطة الطريق|خارطة العمل|طريقة التنفيذ|Roadmap|My approach|Plan|Approach)\s*:?\s*$/gim, '');
  t = t.replace(/^\s*[*•]\s+/gm, '- ');
  // Bracketed placeholders (not links): "[حدد المدة]", "[X days]", "[اسمك]"
  t = t.replace(/\s*\[[^\]\n]{1,40}\]/g, '');
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
