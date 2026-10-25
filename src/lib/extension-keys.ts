// ==============================================================================
// src/lib/extension-keys.ts
// Personal API keys for the PingLead Copilot browser extension (migration 0020).
// Keys look like "plk_<43 url-safe chars>". Only their SHA-256 hash is stored.
// Server-side only.
// ==============================================================================

import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';

const PREFIX = 'plk_';

export const hashExtensionKey = (key: string) => createHash('sha256').update(key).digest('hex');

/** Creates a new key for the user (revoking any previous one) and returns it in plain text, once. */
export async function issueExtensionKey(userId: string): Promise<string> {
  const key = PREFIX + randomBytes(32).toString('base64url');
  const { error } = await (supabaseAdmin.from('freelancer_profiles') as any)
    .update({ extension_key_hash: hashExtensionKey(key), extension_key_created_at: new Date().toISOString() })
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return key;
}

export async function revokeExtensionKey(userId: string): Promise<void> {
  await (supabaseAdmin.from('freelancer_profiles') as any)
    .update({ extension_key_hash: null, extension_key_created_at: null })
    .eq('user_id', userId);
}

/** The user id for a key from an "Authorization: Bearer plk_..." header, or null. */
export async function userIdFromExtensionKey(authorization: string | null): Promise<string | null> {
  const key = authorization?.match(/^Bearer\s+(plk_[A-Za-z0-9_-]{20,})$/)?.[1];
  if (!key) return null;
  const { data } = await (supabaseAdmin.from('freelancer_profiles') as any)
    .select('user_id')
    .eq('extension_key_hash', hashExtensionKey(key))
    .maybeSingle();
  return data?.user_id || null;
}
