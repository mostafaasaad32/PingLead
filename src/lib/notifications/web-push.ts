// ==============================================================================
// src/lib/notifications/web-push.ts
// Browser notifications (Web Push) for users who don't use Telegram.
// Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT and migration 0018.
// Subscriptions the push service reports as gone (404/410) are deleted.
// Server-side only.
// ==============================================================================

import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** Same tag replaces an earlier notification instead of stacking */
  tag?: string;
}

let configured: boolean | null = null;

export function isWebPushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@pinglead.app', publicKey, privateKey);
    configured = true;
  } catch (err: any) {
    console.warn('[Web Push] Invalid VAPID keys:', err.message);
    configured = false;
  }
  return configured;
}

const subscriptionsTable = () => supabaseAdmin.from('push_subscriptions') as any;

/** user_id -> their subscriptions, for the given users (empty map before migration 0018) */
export async function getPushSubscriptions(userIds: string[]): Promise<Map<string, any[]>> {
  const out = new Map<string, any[]>();
  if (!userIds.length || !isWebPushConfigured()) return out;
  const { data, error } = await subscriptionsTable().select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds);
  if (error) return out;
  for (const row of data || []) out.set(row.user_id, [...(out.get(row.user_id) || []), row]);
  return out;
}

/** Sends one payload to each of the user's devices. Returns how many deliveries succeeded. */
export async function sendPushToSubscriptions(subscriptions: any[], payload: PushPayload): Promise<number> {
  if (!subscriptions.length || !isWebPushConfigured()) return 0;
  const body = JSON.stringify(payload);
  const results = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
          { TTL: 60 * 60, urgency: 'high' }
        );
        return true;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await subscriptionsTable().delete().eq('id', sub.id);
        } else {
          console.warn('[Web Push] Send failed:', err?.statusCode || err?.message);
        }
        return false;
      }
    })
  );
  const ok = results.filter(Boolean).length;
  if (ok) {
    await subscriptionsTable()
      .update({ last_used_at: new Date().toISOString() })
      .in('id', subscriptions.map((s) => s.id))
      .then(() => null, () => null);
  }
  return ok;
}

/** Notification text for a matched project */
export function projectPushPayload(p: {
  title: string;
  url: string;
  platformLabel: string;
  budget?: string | null;
  aiScore?: number | null;
  id: string;
  /** From detectScam(): flagged posts get a warning icon and reason */
  scam?: { level: 'none' | 'caution' | 'high'; reasons: string[] } | null;
}): PushPayload {
  const parts = [
    p.scam && p.scam.level !== 'none' ? `${p.scam.level === 'high' ? '🚩 احذر' : '⚠️ خلي بالك'}: ${p.scam.reasons[0]}` : null,
    p.platformLabel,
    p.budget || null,
    typeof p.aiScore === 'number' ? `🤖 ${p.aiScore}% توافق` : null,
  ].filter(Boolean);
  const icon = p.scam?.level === 'high' ? '🚩' : '🎯';
  return {
    title: `${icon} ${p.title}`.slice(0, 120),
    body: parts.join(' · '),
    url: p.url,
    tag: `project-${p.id}`,
  };
}
