// ==============================================================================
// src/app/api/extension/key/route.ts
// The signed-in user's key for the browser extension:
//   GET    -> { hasKey, createdAt }
//   POST   -> issue a new key (revokes the old one), returned once in plain text
//   DELETE -> revoke
// ==============================================================================

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { issueExtensionKey, revokeExtensionKey } from "@/lib/extension-keys";

export const dynamic = "force-dynamic";

async function currentUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const unauthorized = () => NextResponse.json({ error: "غير مصرح - يرجى تسجيل الدخول" }, { status: 401 });

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const { data, error } = await (supabaseAdmin.from("freelancer_profiles") as any)
    .select("extension_key_hash, extension_key_created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    hasKey: Boolean(data?.extension_key_hash),
    createdAt: data?.extension_key_created_at || null,
    migrationMissing: Boolean(error),
  });
}

export async function POST() {
  const user = await currentUser();
  if (!user) return unauthorized();
  try {
    const key = await issueExtensionKey(user.id);
    return NextResponse.json({ ok: true, key });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return unauthorized();
  await revokeExtensionKey(user.id);
  return NextResponse.json({ ok: true });
}
