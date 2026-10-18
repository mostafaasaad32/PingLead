// ==============================================================================
// src/app/api/currency/rates/route.ts
// Today's USD -> EGP rate for client components (filters budget slider).
// ==============================================================================

import { NextResponse } from "next/server";
import { getRates } from "@/lib/currency/rates";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getRates();
  return NextResponse.json({
    ok: true,
    usd_egp: snapshot.rates.EGP,
    updated_at: snapshot.updatedAt,
    source: snapshot.source,
  });
}
