// ==============================================================================
// src/middleware.ts
// Next.js Middleware: Supabase Session Validation & Route Protection
// ==============================================================================

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid using getSession() as it can be spoofed; use getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected paths (Vollna core SaaS pillars)
  const isProtectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/auto-bidding") ||
    pathname.startsWith("/filters") ||
    pathname.startsWith("/templates") ||
    pathname.startsWith("/portfolio") ||
    pathname.startsWith("/insights") ||
    pathname.startsWith("/tracker") ||
    pathname.startsWith("/settings");

  // Authentication paths
  const isAuthPath = pathname === "/login" || pathname === "/signup";

  // 1. If user is unauthenticated and attempting to access protected routes -> redirect to /login
  if (!user && isProtectedPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. If user is already authenticated and visits /login or /signup -> redirect to /dashboard
  if (user && isAuthPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (OAuth callback handler)
     * - api/cron, api/webhooks (background jobs & webhooks)
     * - public asset extensions: svg, png, jpg, jpeg, gif, webp
     */
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|api/cron|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
