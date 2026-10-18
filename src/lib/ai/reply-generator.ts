// ==============================================================================
// src/lib/ai/reply-generator.ts
// Phase 4: On-Demand Personalized AI Freelance Proposal Generator for Telegram & Bot
// Crafts a winning, hook-first proposal in seconds based on freelancer context and client project
// ==============================================================================

const CANDIDATE_MODELS = [
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
];

const WINNING_PROPOSAL_SYSTEM_INSTRUCTION = `
You are an elite, top-rated freelance pitch strategist (Upwork Top Rated Plus & Mostaql Verified Veteran).
Your mission is to generate a HIGH-CONVERTING, persuasive proposal for a freelance project in under 3 seconds.

STRICT WINNING FORMULA:
1. THE HOOK (First 2 lines): Never start with clichés ("Dear client", "I saw your job and I am interested", "السلام عليكم قرأت مشروعك ويسعدني العمل معك"). Jump straight into the client's exact pain point and your immediate solution.
2. ACTIONABLE ROADMAP: 2-3 clear, crisp bullet points on how you will execute the deliverable smoothly.
3. RELEVANT VALUE PROPOSITION: A brief statement showing you've built/designed something identical before.
4. SMART QUESTION / CALL TO ACTION: End with a direct, insightful question about their technical stack or asset availability to prompt an instant reply.

LANGUAGE RULE:
- If the project is in Arabic, write in modern, confident, and professional Arabic.
- If the project is in English, write in crisp, direct, and engaging English.
- Keep the proposal under 180 words so the client can read it in 30 seconds on their phone.
`;

/**
 * Generates an on-demand, tailored freelance proposal based on the subscriber's bio_context
 * and the specific client request text.
 * 
 * @param bioContext Subscriber's portfolio, skills, experience, and services.
 * @param clientPostText The original post text from the prospective client.
 * @returns A formatted ready-to-send proposal message in Arabic or English.
 */
export async function generateSmartReply(
  bioContext: string | null | undefined,
  clientPostText: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return '⚠️ عذراً، مفتاح Gemini غير متوفر حالياً لتوليد الرد.';
  }

  const effectiveBio =
    bioContext && bioContext.trim().length > 10
      ? bioContext
      : 'خبير ومحترف مستقل متخصص في تسليم مشاريع عالية الجودة وسرعة تنفيذ فائقة.';

  const userPrompt = `
SERVICE PROVIDER BIO & SKILLS:
${effectiveBio}

PROSPECTIVE CLIENT PROJECT DETAILS:
${clientPostText}

Generate the winning proposal now:
`;

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
                { text: WINNING_PROPOSAL_SYSTEM_INSTRUCTION },
                { text: userPrompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 800,
          },
        }),
      });

      if (!res.ok) {
        console.warn(`[Proposal Generator] Model ${model} returned HTTP ${res.status}, trying fallback...`);
        continue;
      }

      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply && reply.trim().length > 20) {
        return reply.trim();
      }
    } catch (err: any) {
      console.warn(`[Proposal Generator] Error with ${model}:`, err.message);
    }
  }

  return 'عذراً، تعذر توليد العرض في الوقت الحالي، يرجى المحاولة مرة أخرى.';
}
