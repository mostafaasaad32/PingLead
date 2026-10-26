// ==============================================================================
// src/lib/admin.ts
// Team-only access (/admin). A user is an admin when their Supabase app_metadata has
// role = "admin". app_metadata can only be set with the service role key (users can't
// edit it), e.g. scripts/set_admin.mjs.
// ==============================================================================

import type { User } from '@supabase/supabase-js';

export function isAdmin(user: User | null | undefined): boolean {
  return user?.app_metadata?.role === 'admin';
}
