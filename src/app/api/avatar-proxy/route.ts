// ==============================================================================
// src/app/api/avatar-proxy/route.ts
// Server-side image proxy for cross-platform profile avatars
// Solves hotlink protection, referrer blocking, and adblocker issues.
// Locked down so it can't be used as an open proxy: signed-in users only, HTTPS,
// known avatar hosts only, no redirects, images only, size-capped.
// ==============================================================================

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Hosts that extractAvatarFromText() (src/lib/ai/profile-importer.ts) can return
const ALLOWED_HOSTS = [
  "upwork.com",
  "upwork.co",
  "hsoubcdn.com",
  "githubusercontent.com",
  "nafezly.com",
  "gravatar.com",
  "freelancer.com",
  "f-cdn.com",
  "peopleperhour.com",
  "kafiil.com",
];

const MAX_BYTES = 2 * 1024 * 1024;

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw || "");
  } catch {
    return new NextResponse("Invalid url", { status: 400 });
  }
  if (target.protocol !== "https:" || target.username || target.password || !isAllowedHost(target.hostname)) {
    return new NextResponse("Host not allowed", { status: 400 });
  }

  try {
    const response = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      // A redirect could point anywhere: only follow it if it stays on an allowed host
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });

    let finalResponse = response;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      const next = location ? new URL(location, target) : null;
      if (!next || next.protocol !== "https:" || !isAllowedHost(next.hostname)) {
        return new NextResponse("Redirect not allowed", { status: 400 });
      }
      finalResponse = await fetch(next.toString(), { redirect: "error", signal: AbortSignal.timeout(8000) });
    }

    if (!finalResponse.ok) {
      return new NextResponse("Failed to fetch image", { status: 502 });
    }

    const contentType = finalResponse.headers.get("content-type") || "";
    // SVG can carry scripts when opened directly: raster images only
    if (!contentType.startsWith("image/") || contentType.includes("svg")) {
      return new NextResponse("Not an image", { status: 415 });
    }

    const declared = Number(finalResponse.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) {
      return new NextResponse("Image too large", { status: 413 });
    }
    const arrayBuffer = await finalResponse.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return new NextResponse("Image too large", { status: 413 });
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Failed to proxy image", { status: 502 });
  }
}
