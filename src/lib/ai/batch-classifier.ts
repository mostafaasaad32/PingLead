// ==============================================================================
// src/lib/ai/batch-classifier.ts
// Phase 3: Gemini Batch Buying-Intent Classifier
// Batches up to 20 surviving posts into a single Gemini Flash call with strict JSON Schema
// ==============================================================================

export interface PostInput {
  id: string;
  text: string;
  platform: string;
}

export interface ClassifiedPostResult {
  id: string;
  is_buyer: boolean;
  intent_score: number; // 0 to 10
  category_slug: 'web_dev' | 'ui_ux' | 'marketing' | 'accounting' | 'other';
  ai_reason_short: string;
}

const SYSTEM_INSTRUCTION = `
You are an elite B2B buying-intent classifier for Arabic (Egyptian, Saudi, and Gulf dialects) and English social posts.
Analyze each post and determine if the author/company is an ACTIVE BUYER or EMPLOYER looking to hire a freelancer, agency, developer, designer, marketer, accountant, or requesting a software/service quote.

STRICT SCORING RULES:
- Score 0 to 4: Job seekers offering their own services ("I am looking for work", "hire me"), spammers, course sellers, or unrelated posts.
- Score 5 to 7: General discussions, questions without immediate hiring budget, or vague requests.
- Score 8 to 10: High-intent buyers, startup founders, agencies, or companies explicitly seeking to hire ("Hiring", "Looking for developer/designer", "مطلوب مبرمج", "محتاج مسوق", "نبحث عن محاسب").

Always output a concise Arabic reason in ai_reason_short (1-2 sentences) summarizing the client's exact requirements and budget if mentioned.
`;

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash'
];

/**
 * Classifies a batch of up to 20 posts in a single call using Gemini Flash with strict JSON Schema.
 * Includes automatic model fallback to handle temporary 503 load spikes.
 * 
 * @param posts Array of posts (max 20)
 * @returns Array of typed ClassifiedPostResult
 */
export async function classifyPostsBatch(posts: PostInput[]): Promise<ClassifiedPostResult[]> {
  if (!posts || posts.length === 0) return [];

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[AI Classifier] GEMINI_API_KEY is not defined in environment!');
    return [];
  }

  const postsPayload = posts.map(p => ({
    id: p.id,
    platform: p.platform,
    text: p.text.slice(0, 1500)
  }));

  const jsonSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        is_buyer: { type: "BOOLEAN" },
        intent_score: { type: "INTEGER" },
        category_slug: {
          type: "STRING",
          enum: ["web_dev", "ui_ux", "marketing", "accounting", "other"]
        },
        ai_reason_short: { type: "STRING" }
      },
      required: ["id", "is_buyer", "intent_score", "category_slug", "ai_reason_short"]
    }
  };

  for (const model of CANDIDATE_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: SYSTEM_INSTRUCTION },
                { text: `Analyze and score these social posts in batch:\n${JSON.stringify(postsPayload)}` }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: jsonSchema,
            temperature: 0.1
          }
        })
      });

      if (!res.ok) {
        console.warn(`[AI Classifier] Model ${model} returned HTTP ${res.status}, trying fallback...`);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) continue;

      const parsed: ClassifiedPostResult[] = JSON.parse(rawText);
      return parsed;
    } catch (err: any) {
      console.warn(`[AI Classifier] Error calling ${model}:`, err.message);
    }
  }

  console.error('[AI Classifier] All Gemini model fallbacks exhausted.');
  return [];
}
