// ==============================================================================
// src/lib/notifications/daily-summary.ts
// Daily Telegram summary (9:00 in the user's timezone), sent from /api/cron/digest:
//   - matches in the last 24 h (and how many passed the AI threshold)
//   - what the user did with them: applied / client replied / won
//   - up to 3 of the best recent matches still waiting for a proposal
//   - AI credits left this month
// Nothing is sent when there were no matches and no activity.
// Server-side only.
// ==============================================================================

import { supabaseAdmin } from '@/lib/supabase/admin';
import { PLATFORMS_METADATA } from '@/lib/scrapers/types';
import { escapeHtml, sendTelegramTextMessage } from '@/lib/notifications/telegram';

const DEFAULT_AI_MIN_SCORE = 70;
const PENDING_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export interface SummaryProfile {
  user_id: string;
  full_name?: string | null;
  telegram_chat_id: string;
  ai_credits?: number | null;
}

const platformLabel = (id: string) => PLATFORMS_METADATA.find((p) => p.id === id)?.label_ar || id;

/** Builds and sends one user's summary. Returns false when there was nothing to report or sending failed. */
export async function sendDailySummary(profile: SummaryProfile, siteUrl: string): Promise<boolean> {
  const now = Date.now();
  const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  const [matchedRes, activityRes, pendingRes] = await Promise.all([
    // New matches in the last 24 h
    (supabaseAdmin.from('user_project_actions') as any)
      .select('ai_score, user_filters ( ai_min_score )')
      .eq('user_id', profile.user_id)
      .gte('created_at', since)
      .neq('status', 'ignored')
      .limit(2000),
    // Funnel moves in the last 24 h
    (supabaseAdmin.from('user_project_actions') as any)
      .select('status')
      .eq('user_id', profile.user_id)
      .gte('updated_at', since)
      .in('status', ['applied', 'replied', 'won']),
    // Best recent matches the user hasn't acted on
    (supabaseAdmin.from('user_project_actions') as any)
      .select('ai_score, created_at, projects ( title, url, platform, budget, published_at )')
      .eq('user_id', profile.user_id)
      .eq('status', 'matched')
      .is('generated_proposal', null)
      .gte('created_at', new Date(now - PENDING_MAX_AGE_MS).toISOString())
      .order('ai_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(3),
  ]);

  const matched = matchedRes.data || [];
  const fit = matched.filter(
    (r: any) => typeof r.ai_score === 'number' && r.ai_score >= (r.user_filters?.ai_min_score ?? DEFAULT_AI_MIN_SCORE)
  ).length;
  const scored = matched.filter((r: any) => typeof r.ai_score === 'number').length;

  const activity = activityRes.data || [];
  const applied = activity.filter((a: any) => a.status === 'applied').length;
  const replied = activity.filter((a: any) => a.status === 'replied').length;
  const won = activity.filter((a: any) => a.status === 'won').length;

  if (!matched.length && !activity.length) return false;

  const lines: string[] = [];
  lines.push(`☀️ <b>صباح الخير${profile.full_name ? ` يا ${escapeHtml(profile.full_name.split(' ')[0])}` : ''}! ملخص آخر 24 ساعة</b>`);
  lines.push('');
  lines.push(`🎯 وصلك <b>${matched.length}</b> مشروع${scored ? ` · منهم <b>${fit}</b> مناسبين لشروطك` : ''}`);
  if (applied || replied || won) {
    const parts = [
      applied ? `📨 قدّمت على ${applied}` : null,
      replied ? `💬 العميل رد في ${replied}` : null,
      won ? `🏆 كسبت ${won}` : null,
    ].filter(Boolean);
    lines.push(parts.join(' · '));
  } else if (matched.length) {
    lines.push('📨 ماسجّلتش تقديم امبارح. لو قدّمت، علّمه من لوحة التحكم عشان أرقامك تبقى مظبوطة.');
  }

  const pending = (pendingRes.data || []).filter((r: any) => r.projects);
  if (pending.length) {
    lines.push('');
    lines.push('⏳ <b>لسه ملحقتش تقدّم عليهم:</b>');
    pending.forEach((r: any, i: number) => {
      const p = r.projects;
      const meta = [platformLabel(p.platform), p.budget || null, typeof r.ai_score === 'number' ? `🤖 ${r.ai_score}%` : null]
        .filter(Boolean)
        .join(' · ');
      lines.push(`${i + 1}. <a href="${escapeHtml(p.url)}">${escapeHtml(p.title.slice(0, 80))}</a>\n   <i>${escapeHtml(meta)}</i>`);
    });
  }

  if (typeof profile.ai_credits === 'number') {
    lines.push('');
    lines.push(`✍️ فاضلك <b>${profile.ai_credits}</b> عرض بالـ AI الشهر ده.`);
  }

  return sendTelegramTextMessage(profile.telegram_chat_id, lines.join('\n'), {
    inline_keyboard: [[{ text: '📊 افتح لوحة التحكم', url: `${siteUrl}/dashboard` }]],
  });
}
