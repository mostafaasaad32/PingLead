// ==============================================================================
// src/lib/telegram/dispatcher.ts
// Phase 4: Interactive Telegram Dispatcher Engine
// Sends rich Markdown lead alert cards with inline interactive buttons
// ==============================================================================

import fs from "fs";
import path from "path";
import { supabaseAdmin } from '../supabase/admin';

function getTelegramToken(): string {
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const match = content.match(/^TELEGRAM_BOT_TOKEN=(.*)$/m);
      if (match) return match[1].trim();
    }
  } catch {}
  return "";
}

export interface LeadPayload {
  id: string;
  platform: string;
  author_handle?: string;
  post_text: string;
  post_url: string;
  category_slug: string;
  intent_score: number;
  ai_reason_short?: string;
}

/**
 * Sends a rich interactive Telegram alert to a specific subscriber chat ID.
 * Includes inline button to open the post and on-demand AI reply generator.
 */
export async function sendTelegramLeadAlert(
  chatId: string,
  lead: LeadPayload,
  deliveryId: string
): Promise<boolean> {
  const token = getTelegramToken();
  if (!token) {
    console.warn('[Telegram Dispatcher] TELEGRAM_BOT_TOKEN is not configured.');
    return false;
  }

  const escapeHtml = (str: string) =>
    (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const cleanSnippet = escapeHtml(lead.post_text.slice(0, 320).trim());
  const aiReason = escapeHtml(lead.ai_reason_short || 'مشروع جديد معتمد من المنصة');

  let platformLabel = lead.platform.toUpperCase();
  if (lead.post_url?.includes('mostaql.com')) platformLabel = 'مستقل (Mostaql)';
  else if (lead.post_url?.includes('nafezly.com')) platformLabel = 'نفذلي (Nafezly)';
  else if (lead.post_url?.includes('kafiil.com')) platformLabel = 'كفيل (Kafiil)';
  else if (lead.post_url?.includes('baaeed.com')) platformLabel = 'بعيد (Baeed)';
  else if (lead.post_url?.includes('khamsat.com')) platformLabel = 'خمسات (Khamsat)';
  else if (lead.post_url?.includes('freelancer.com')) platformLabel = 'Freelancer.com';
  else if (lead.post_url?.includes('weworkremotely.com')) platformLabel = 'WeWorkRemotely';
  else if (lead.post_url?.includes('remoteok.com')) platformLabel = 'RemoteOK';
  else if (lead.post_url?.includes('peopleperhour.com')) platformLabel = 'PeoplePerHour';

  const message =
    `💼 <b>مشروع عمل حر جديد (${lead.intent_score}/10)</b>\n` +
    `📍 <b>المنصة:</b> ${platformLabel} | <b>التصنيف:</b> #${lead.category_slug}\n` +
    `💡 <b>المواصفات:</b> ${aiReason}\n\n` +
    `📝 <b>تفاصيل المشروع:</b>\n` +
    `"${cleanSnippet}..."\n\n` +
    `⚡ اضغط أدناه لفتح المشروع أو لتوليد عرض تقديم احترافي (Proposal) بالـ AI فوراً:`;

  const inlineKeyboard = {
    inline_keyboard: [
      [
        {
          text: '🔗 فتح المشروع في المنصة',
          url: lead.post_url,
        },
      ],
      [
        {
          text: '✍️ توليد عرض تقديم ذكي (AI Proposal)',
          callback_data: `gen_reply:${deliveryId}`,
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
      console.error(`[Telegram Dispatcher] Failed to send message to ${chatId}:`, data.description);
      return false;
    }

    console.log(`[Telegram Dispatcher] Alert successfully dispatched to chat ${chatId} for lead ${lead.id}`);
    return true;
  } catch (err: any) {
    console.error(`[Telegram Dispatcher] Error sending alert:`, err.message);
    return false;
  }
}

/**
 * Dispatches a high-intent scored lead to all matching subscribed users.
 * Skips users who have already received this specific lead.
 */
export async function dispatchLeadToSubscribers(lead: LeadPayload): Promise<number> {
  try {
    // 1. Find users who subscribed to this category with min_intent_score <= lead.intent_score
    const { data: matchedSubscriptions, error: subError } = await supabaseAdmin
      .from('user_subscriptions_map')
      .select(`
        user_id,
        min_intent_score,
        profiles!inner(id, telegram_chat_id, subscription_tier)
      `)
      .eq('category_slug', lead.category_slug)
      .lte('min_intent_score', lead.intent_score);

    if (subError || !matchedSubscriptions || matchedSubscriptions.length === 0) {
      // If no explicit subscription map exists yet, fallback to users with active telegram_chat_id
      const { data: defaultUsers } = await supabaseAdmin
        .from('profiles')
        .select('id, telegram_chat_id, subscription_tier')
        .not('telegram_chat_id', 'is', null);

      if (!defaultUsers || defaultUsers.length === 0) return 0;

      let dispatched = 0;
      for (const user of defaultUsers) {
        if (!user.telegram_chat_id) continue;

        // Check if already dispatched to avoid duplicate messages
        const { data: existing } = await supabaseAdmin
          .from('user_lead_deliveries')
          .select('id')
          .eq('user_id', user.id)
          .eq('lead_id', lead.id)
          .maybeSingle();

        if (existing) continue;

        // Upsert delivery record
        const { data: delivery, error: delError } = await supabaseAdmin
          .from('user_lead_deliveries')
          .upsert(
            { user_id: user.id, lead_id: lead.id },
            { onConflict: 'user_id,lead_id' }
          )
          .select('id')
          .single();

        if (delError || !delivery) continue;

        const sent = await sendTelegramLeadAlert(user.telegram_chat_id, lead, delivery.id);
        if (sent) dispatched++;
      }
      return dispatched;
    }

    let dispatchedCount = 0;
    for (const item of (matchedSubscriptions as any[])) {
      const profile = item?.profiles;
      if (!profile || !profile.telegram_chat_id) continue;

      const subscriberUserId = item.user_id;

      // Check if already dispatched
      const { data: existing } = await supabaseAdmin
        .from('user_lead_deliveries')
        .select('id')
        .eq('user_id', subscriberUserId)
        .eq('lead_id', lead.id)
        .maybeSingle();

      if (existing) continue;

      // Upsert delivery record
      const { data: delivery, error: delError } = await supabaseAdmin
        .from('user_lead_deliveries')
        .upsert(
          { user_id: subscriberUserId, lead_id: lead.id },
          { onConflict: 'user_id,lead_id' }
        )
        .select('id')
        .single();

      if (delError || !delivery) continue;

      const sent = await sendTelegramLeadAlert(profile.telegram_chat_id, lead, delivery.id);
      if (sent) dispatchedCount++;
    }

    return dispatchedCount;
  } catch (err: any) {
    console.error('[Telegram Dispatcher] Dispatch failed:', err.message);
    return 0;
  }
}

export { sendSmartFilterTelegramAlert } from '../notifications/telegram';


