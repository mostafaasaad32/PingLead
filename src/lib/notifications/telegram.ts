// ==============================================================================
// src/lib/notifications/telegram.ts
// Phase 5: Interactive Telegram Bot & Notification Engine (Vollna Architecture)
// Delivers rich HTML project alert cards with interactive inline action buttons
// and manages two-way real-time callback queries.
// ==============================================================================

import fs from 'fs';
import path from 'path';
import { isJobBoard, type ProjectInsights } from '@/lib/scrapers/types';
import { detectScam } from '@/lib/filters/scam-detector';
import type { ProjectPricing } from '@/lib/insights/pricing';
import { getCompetitionVerdict, getClientVerdict } from '@/lib/insights/competition';

/**
 * "نُشر منذ 3 دقائق" - how fresh the project is when the alert goes out (speed is the product).
 * Returns '' for missing/invalid dates.
 */
export function formatPostedAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const time = new Date(iso).getTime();
  if (isNaN(time)) return '';
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  if (minutes < 1) return 'نُشر الآن';
  if (minutes === 1) return 'نُشر منذ دقيقة';
  if (minutes === 2) return 'نُشر منذ دقيقتين';
  if (minutes <= 10) return `نُشر منذ ${minutes} دقائق`;
  if (minutes < 60) return `نُشر منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'نُشر منذ ساعة';
  if (hours === 2) return 'نُشر منذ ساعتين';
  if (hours <= 10) return `نُشر منذ ${hours} ساعات`;
  if (hours < 24) return `نُشر منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'نُشر منذ يوم' : days === 2 ? 'نُشر منذ يومين' : `نُشر منذ ${days} أيام`;
}

/**
 * Competition, client and delivery-time lines for an alert card (empty when the platform gives nothing).
 */
export function formatInsightLines(p: ProjectInsights): string {
  const lines: string[] = [];

  const competition = getCompetitionVerdict(p);
  if (competition.level !== 'unknown') {
    const avg = p.bids_avg ? ` · متوسط العروض $${p.bids_avg}` : '';
    lines.push(`🏁 <b>المنافسة:</b> ${competition.emoji} ${competition.label} (${competition.advice})${avg}`);
  }

  const client = getClientVerdict(p);
  const clientParts = [client.label, ...client.details].filter(Boolean);
  if (clientParts.length) {
    lines.push(`👤 <b>العميل:</b> ${client.emoji} ${escapeHtml(clientParts.join(' · '))}`);
  }

  if (p.duration_text) lines.push(`⏳ <b>مدة التنفيذ:</b> ${escapeHtml(p.duration_text)}`);

  return lines.length ? `\n${lines.join('\n')}` : '';
}

function getTelegramToken(): string {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const match = content.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m);
      if (match && match[1]) return match[1].trim();
    }
  } catch (err) {
    // Ignore fallback errors
  }
  return '';
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getPlatformBadge(platform: string, url?: string): string {
  const p = (platform || '').toLowerCase();
  const u = (url || '').toLowerCase();

  if (p === 'mostaql' || u.includes('mostaql.com')) return '🟢 مستقل (Mostaql)';
  if (p === 'nafezly' || u.includes('nafezly.com')) return '🔵 نفذلي (Nafezly)';
  if (p === 'khamsat' || u.includes('khamsat.com')) return '🟠 خمسات (Khamsat)';
  if (p === 'kafiil' || u.includes('kafiil.com')) return '🟣 كفيل (Kafiil)';
  if (p === 'baeed' || u.includes('baaeed.com')) return '🔷 بعيد (Baeed)';
  if (p === 'freelancer' || u.includes('freelancer.com')) return '🔹 Freelancer.com';
  if (p === 'wwr' || u.includes('weworkremotely.com')) return '🔴 WeWorkRemotely';
  if (p === 'remoteok' || u.includes('remoteok.com')) return '⚡ RemoteOK';
  if (p === 'pph' || u.includes('peopleperhour.com')) return '🔸 PeoplePerHour';

  return `💼 ${platform.toUpperCase()}`;
}

export interface TelegramProjectAlertData extends ProjectInsights {
  title: string;
  description: string;
  url: string;
  platform: string;
  category: string;
  budget?: string | null;
  budget_usd_estimate?: number | null;
  currency?: string | null;
  source_created_at?: string | null;
  pricing?: ProjectPricing | null;
  /** AI qualifier result (filters with AI criteria) */
  ai_score?: number | null;
  ai_reason?: string | null;
  ai_quota_exhausted?: boolean;
}

/**
 * Sends a Vollna-style Rich Project Match Alert Card to a user's Telegram chat
 */
export async function sendSmartFilterTelegramAlert(
  chatId: string | number,
  project: TelegramProjectAlertData,
  filterName: string,
  actionId: string
): Promise<boolean> {
  const token = getTelegramToken();
  if (!token) {
    console.warn('[Telegram Notifications] TELEGRAM_BOT_TOKEN is not configured.');
    return false;
  }

  const cleanTitle = escapeHtml(project.title);
  // Some feeds (RemoteOK) carry literal "\n" sequences in their text
  const cleanSnippet = escapeHtml(
    (project.description || '').replace(/(?:\\[nrt])+/g, ' ').replace(/\s+/g, ' ').slice(0, 320).trim()
  );
  const isJob = isJobBoard(project.platform);
  // Original budget, then its EGP equivalent (and a USD estimate for other currencies)
  const isUsd = !project.currency || ['USD', '$'].includes(project.currency.toUpperCase());
  const budgetExtras = [
    !isUsd && project.budget_usd_estimate ? `~$${project.budget_usd_estimate}` : null,
    project.pricing?.budgetEgpText || null,
  ].filter(Boolean);
  // LRI/PDI isolate the Latin "$140000 - $250000" so the RTL message doesn't reorder it
  const budgetInfo = project.budget
    ? `⁦${project.budget}⁩${budgetExtras.length ? ` (${budgetExtras.join(' · ')})` : ''}`
    : 'غير محدد';

  const suggestion = project.pricing?.suggestion;
  const suggestionLine = suggestion
    ? `\n💡 <b>السعر المقترح:</b> ${suggestion.priceUsd}$` +
      `${suggestion.priceEgpText ? ` (${suggestion.priceEgpText})` : ''} في ${suggestion.daysText}` +
      `${suggestion.reasons.length ? `\n   ↳ <i>${escapeHtml(suggestion.reasons.join(' · '))}</i>` : ''}`
    : '';
  const platformLabel = getPlatformBadge(project.platform, project.url);

  // Freshness right under the title: how fast the alert arrived is the point of the product
  const freshness = formatPostedAgo(project.source_created_at);

  // Scam / risk signs in the post itself (rule-based, instant)
  const scam = detectScam(project.title, project.description);
  const scamLine =
    scam.level === 'high'
      ? `🚩 <b>احذر:</b> ${escapeHtml(scam.reasons.join(' · '))}\n`
      : scam.level === 'caution'
        ? `⚠️ <b>خلي بالك:</b> ${escapeHtml(scam.reasons.join(' · '))}\n`
        : '';

  const aiLine =
    typeof project.ai_score === 'number'
      ? `🤖 <b>توافق مع شروطك:</b> ${project.ai_score >= 85 ? '🟢' : project.ai_score >= 70 ? '🟡' : '🔴'} ${project.ai_score}%` +
        `${project.ai_reason ? ` · ${escapeHtml(project.ai_reason)}` : ''}\n`
      : project.ai_quota_exhausted
        ? `🤖 <i>رصيد تقييم الـ AI للشهر ده خلص، فالمشروع ده متقيّمش.</i>\n`
        : '';

  const message =
    `🎯 <b>تنبيه فلتر ذكي: ${escapeHtml(filterName)}</b>\n\n` +
    `💼 <b>${cleanTitle}</b>\n` +
    (freshness ? `⏱️ <b>${freshness}</b>\n` : '') +
    scamLine +
    aiLine +
    `📍 <b>المنصة:</b> ${platformLabel}\n` +
    `💰 <b>${isJob ? 'الراتب (وظيفة)' : 'الميزانية'}:</b> ${escapeHtml(budgetInfo)}` +
    `${suggestionLine}` +
    `${formatInsightLines(project)}\n` +
    `🏷️ <b>التصنيف:</b> #${project.category}\n\n` +
    `📝 <b>الوصف:</b>\n` +
    `"${cleanSnippet}..."\n\n` +
    `⚡ اضغط أدناه لتوليد عرض تقديم احترافي بالـ AI فوراً بناءً على سابقة أعمالك:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '🔗 فتح المشروع في المنصة',
          url: project.url,
        },
      ],
      [
        {
          text: '✍️ كتابة عرض بالـ AI (Proposal)',
          callback_data: `gen_prop:${actionId}`,
        },
        {
          text: '✅ تم التقديم (Mark Applied)',
          callback_data: `mark_app:${actionId}`,
        },
      ],
    ],
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error(`[Telegram Notifications] Failed to send filter alert to ${chatId}:`, data.description);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error(`[Telegram Notifications] Error sending filter alert:`, err.message);
    return false;
  }
}

/**
 * Sends a generic text message with optional inline keyboard to Telegram
 */
export async function sendTelegramTextMessage(
  chatId: string | number,
  text: string,
  inlineKeyboard?: any
): Promise<boolean> {
  const token = getTelegramToken();
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard,
        disable_web_page_preview: true,
      }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch (err: any) {
    console.error('[Telegram Notifications] sendTelegramTextMessage failed:', err.message);
    return false;
  }
}

/**
 * Acknowledges callback queries promptly to clear Telegram spinner on the user's phone
 */
export async function answerTelegramCallback(
  callbackQueryId: string,
  text: string,
  showAlert: boolean = false
): Promise<boolean> {
  const token = getTelegramToken();
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch (err: any) {
    console.error('[Telegram Notifications] answerTelegramCallback failed:', err.message);
    return false;
  }
}

/**
 * Updates inline buttons of an existing message (e.g. to show "✅ تم التقديم بنجاح")
 */
export async function updateTelegramMessageKeyboard(
  chatId: string | number,
  messageId: number,
  inlineKeyboard: any
): Promise<boolean> {
  const token = getTelegramToken();
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        reply_markup: inlineKeyboard,
      }),
    });
    const data = await res.json();
    return !!data.ok;
  } catch (err: any) {
    console.error('[Telegram Notifications] updateTelegramMessageKeyboard failed:', err.message);
    return false;
  }
}
