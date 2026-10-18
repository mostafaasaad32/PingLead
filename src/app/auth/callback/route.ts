// ==============================================================================
// src/app/auth/callback/route.ts
// Supabase Auth OAuth & Email Confirmation Callback Handler with Full Logging
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
  const urlError = searchParams.get("error");
  const urlErrorDesc = searchParams.get("error_description");

  console.log("================================================================================");
  console.log("📥 [AUTH CALLBACK] Incoming Request:");
  console.log(`- Full URL: ${request.url}`);
  console.log(`- Code present: ${code ? "YES (" + code.slice(0, 8) + "...)" : "NO"}`);
  console.log(`- Token Hash: ${token_hash ? "YES (" + token_hash.slice(0, 8) + "...)" : "NO"}`);
  console.log(`- Type: ${type || "N/A"}`);
  console.log(`- Next Destination: ${next}`);
  if (urlError || urlErrorDesc) {
    console.error(`- URL Error: ${urlError} - ${urlErrorDesc}`);
  }
  console.log("================================================================================");

  const supabase = await createServerSupabaseClient();

  // 1. Handle PKCE Code exchange
  if (code) {
    console.log("[Auth Callback] Exchanging code for session via PKCE...");
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.session) {
      console.log(`✅ [Auth Callback] Session established successfully for: ${data.user?.email}`);
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("❌ [Auth Callback] Exchange code error:", error);
  }

  // 2. Handle token_hash verification (OTP / Magiclink / Signup confirmation)
  if (token_hash && type) {
    console.log(`[Auth Callback] Verifying OTP token hash for type: ${type}...`);
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error && data.session) {
      console.log(`✅ [Auth Callback] OTP verified successfully for: ${data.user?.email}`);
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("❌ [Auth Callback] Verify OTP error:", error);
  }

  // If error or neither matched, redirect to login with error param
  console.warn("⚠️ [Auth Callback] Authentication could not be completed, redirecting to login with error.");
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
