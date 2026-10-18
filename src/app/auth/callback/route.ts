// ==============================================================================
// src/app/auth/callback/route.ts
// Supabase Auth OAuth, Magic Link, Signup & Password Recovery Callback Handler
// ==============================================================================

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");

  if (error) {
    console.error("[Auth Callback] Authentication error param:", error);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createServerSupabaseClient();

  // 1. Handle PKCE code exchange
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[Auth Callback] Code exchange failed:", exchangeError.message);
  }

  // 2. Handle token_hash verification (OTP / Magiclink / Password Recovery / Signup)
  if (token_hash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!verifyError) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[Auth Callback] Token verification failed:", verifyError.message);
  }

  // Fallback to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
