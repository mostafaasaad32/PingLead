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

const WINNING_PITCH_SYSTEM_INSTRUCTION = `
You are an elite, top-rated freelance pitch strategist (Upwork Top Rated Plus & Mostaql Verified Veteran).
Your mission is to generate a HIGH-CONVERTING, irresistible proposal for a client freelance project in under 2 seconds.

STRICT WINNING FORMULA:
1. THE HOOK (First 2 lines): Never start with clichés ("Dear client", "I saw your job and I am interested", "السلام عليكم قرأت مشروعك ويسعدني العمل معك"). Jump straight into the client's exact problem and your immediate technical or creative solution.
2. ACTIONABLE ROADMAP: 2-3 clear, punchy bullet points detailing how you will deliver this smoothly and fast.
3. SOCIAL PROOF & LIVE PORTFOLIO CITE: If a relevant portfolio project with a live link is provided in the prompt, cite it naturally as tangible proof (e.g. "قمت ببناء عمل مماثل يمكنك معاينته مباشرة هنا: [رابط]" or "I previously developed a similar project you can test live here: [link]").
4. CLOSING SMART QUESTION: End with a direct, insightful question about their tech stack, timeline, or asset availability to prompt an instant reply.
5. CLIENT'S OWN QUESTIONS: If the project description asks the freelancer anything or requests specific information (e.g. "اذكر خبرتك", "أرسل أعمال سابقة", "كم المدة؟", "what is your rate?"), answer each request briefly and directly inside the proposal before the closing question. Never ignore a direct request from the client.
6. NEVER INVENT FACTS: Only claim experience, numbers or past projects that appear in the freelancer profile or portfolio provided. If there is no matching portfolio item, describe the approach instead of inventing past work.

LANGUAGE & TONE RULES:
- If the project is in Arabic, write in modern, confident, and professional Arabic.
- If the project is in English, write in crisp, direct, and engaging English.
- Generate the COMPLETE proposal text (Hook + Roadmap Bullets + Proof Citation + Closing Question). Aim for 80 to 140 words so the client can comfortably read it in 30 seconds on their phone.
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

  // 2. Format skills
  const skillsString = Array.isArray(input.freelancerSkills)
    ? input.freelancerSkills.join(', ')
    : input.freelancerSkills || 'Full-Stack Development, Modern UI/UX, Performance Optimization';

  const tone = input.toneOfVoice || 'confident';

  // 3. Build optimized Gemini prompt
  const promptText = `
${WINNING_PITCH_SYSTEM_INSTRUCTION}

PROJECT CONTEXT:
- Platform: ${input.platform || 'Freelance Marketplace'}
- Category: #${input.category || 'general'}
- Title: ${input.title}
- Description & Requirements:
${(input.description || '').slice(0, 2000)}

FREELANCER PROFILE:
- Specialization / Bio: ${input.freelancerBio || 'Senior Freelance Solution Architect & Full-Stack Engineer'}
- Core Skills: ${skillsString}
- Tone of Voice: ${tone} (Write with a ${tone} attitude)
${input.customInstructions ? `- Special User Custom Instructions: ${input.customInstructions}` : ''}
${input.standingInstructions?.trim() ? `- The freelancer's standing instructions (ALWAYS follow these): ${input.standingInstructions.trim().slice(0, 1000)}` : ''}

${input.pricingHint ? `PRICING GUIDANCE (REQUIRED):\n${input.pricingHint}\nThe proposal MUST include one explicit sentence with your price and delivery time (e.g. "أقدر أسلّم خلال 7 أيام بتكلفة 150$" / "I can deliver in 7 days for $150"), placed right before the closing question.\n` : ''}
${portfolioPromptContext}

Generate the winning pitch proposal now:
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
            temperature: 0.35,
            maxOutputTokens: 1000,
          },
        }),
      });

      if (!res.ok) {
        console.warn(`[AI Proposal Generator] Model ${model} returned HTTP ${res.status}, trying fallback...`);
        continue;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text && text.trim().length > 30) {
        generatedProposal = text.trim();
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
