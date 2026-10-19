// ==============================================================================
// src/lib/credits.ts
// AI credits: one credit per AI proposal the user asks for.
//   - Deduction is a compare-and-swap on ai_credits, so two simultaneous requests
//     can't both spend the same credit.
//   - Credits top back up to the monthly allowance the first time they're used in a
//     new month (needs migration 0011; skipped quietly if the column is missing).
//   - Failed generations get their credit back.
// Server-side only.
// ==============================================================================

import { supabaseAdmin } from '@/lib/supabase/admin';

export const MONTHLY_AI_CREDITS = Number(process.env.MONTHLY_AI_CREDITS) || 25;
const MAX_ATTEMPTS = 4;

const profiles = () => supabaseAdmin.from('freelancer_profiles') as any;

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
}

/** Tops credits up to the monthly allowance once per calendar month (never lowers them). */
async function renewIfDue(userId: string): Promise<void> {
  const { data, error } = await profiles()
    .select('ai_credits, credits_renewed_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return; // column missing before migration 0011, or no profile

  const now = new Date();
  const renewedAt = data.credits_renewed_at ? new Date(data.credits_renewed_at) : null;
  if (renewedAt && monthKey(renewedAt) === monthKey(now)) return;

  let query = profiles()
    .update({
      ai_credits: Math.max(data.ai_credits ?? 0, MONTHLY_AI_CREDITS),
      credits_renewed_at: now.toISOString(),
    })
    .eq('user_id', userId);
  // Only one concurrent request performs the renewal
  query = data.credits_renewed_at ? query.eq('credits_renewed_at', data.credits_renewed_at) : query.is('credits_renewed_at', null);
  await query;
}

async function changeCredits(userId: string, delta: 1 | -1): Promise<{ ok: boolean; remaining: number | null }> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data: profile } = await profiles().select('ai_credits').eq('user_id', userId).maybeSingle();
    if (!profile) return { ok: false, remaining: null };

    const current: number = profile.ai_credits ?? 0;
    if (delta < 0 && current <= 0) return { ok: false, remaining: 0 };

    const { data: updated } = await profiles()
      .update({ ai_credits: current + delta, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('ai_credits', current)
      .select('ai_credits');

    if (updated && updated.length > 0) return { ok: true, remaining: updated[0].ai_credits };
    // Someone else changed the balance between read and write: retry with the fresh value
  }
  return { ok: false, remaining: null };
}

/** Spends one credit. ok=false with remaining=0 means the user is out of credits. */
export async function consumeAiCredit(userId: string): Promise<{ ok: boolean; remaining: number | null }> {
  await renewIfDue(userId).catch(() => {});
  return changeCredits(userId, -1);
}

/** Gives a credit back after a failed generation. */
export async function refundAiCredit(userId: string): Promise<void> {
  await changeCredits(userId, 1).catch(() => {});
}

export const OUT_OF_CREDITS_MESSAGE = `رصيد عروض الـ AI خلص. الرصيد بيتجدد أول كل شهر (${MONTHLY_AI_CREDITS} عرض).`;
