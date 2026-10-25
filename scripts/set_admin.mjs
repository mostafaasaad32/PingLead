// ==============================================================================
// scripts/set_admin.mjs
// Grants or removes access to /admin (team dashboard) by email.
// Usage:
//   node --env-file=.env scripts/set_admin.mjs someone@example.com          (grant)
//   node --env-file=.env scripts/set_admin.mjs someone@example.com --remove (revoke)
// ==============================================================================

import { createClient } from "@supabase/supabase-js";

const email = (process.argv[2] || "").toLowerCase();
const remove = process.argv.includes("--remove");
if (!email.includes("@")) {
  console.error("Usage: node --env-file=.env scripts/set_admin.mjs <email> [--remove]");
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  users.push(...data.users);
  if (data.users.length < 1000) break;
}

const user = users.find((u) => (u.email || "").toLowerCase() === email);
if (!user) {
  console.error(`No user with email ${email}`);
  process.exit(1);
}

const { error } = await sb.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, role: remove ? null : "admin" },
});
if (error) throw error;
console.log(`${remove ? "Removed admin from" : "Granted admin to"} ${email}. Sign out and in again to refresh the session.`);
