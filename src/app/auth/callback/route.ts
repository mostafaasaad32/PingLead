// ==============================================================================
// src/app/auth/callback/route.ts
// Supabase Auth OAuth & Email Confirmation Callback Handler
// ==============================================================================

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[Auth Callback] Exchange code error:", error);
  }

  // If error or no code, redirect to login with error param
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
