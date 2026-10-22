// ==============================================================================
// src/app/api/cron/cleanup/route.ts
// Database Auto-Cleanup Endpoint: Removes projects > 72 hours (3 days)
// Preserves:
// - Any project a user saved, applied to, got a reply on or won
// - Projects with generated AI proposals or in the auto-bidding queue
// (see src/lib/cleanup/retention.ts; hours below 24 are raised to 24)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { performProjectRetentionCleanup } from '@/lib/cleanup/retention';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleCleanup(req);
}

export async function POST(req: NextRequest) {
  return handleCleanup(req);
}

async function handleCleanup(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(req.url);

    // Bearer header only (same as /api/cron/ingest): secrets in query strings end up in access logs
    const isAuthorized =
      process.env.NODE_ENV === 'development' ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'غير مصرح - مطلوب مفتاح الأمان CRON_SECRET' },
        { status: 401 }
      );
    }

    const hoursParam = url.searchParams.get('hours');
    const retentionHours = hoursParam ? parseInt(hoursParam, 10) : 72;

    const result = await performProjectRetentionCleanup(retentionHours);

    return NextResponse.json({
      ok: result.ok,
      message: `تم تنظيف المشاريع الأقدم من ${retentionHours} ساعة بنجاح مع الحفاظ على المشاريع المحفوظة والمولّد لها عروض.`,
      result,
    });
  } catch (err: any) {
    console.error('[API Cron Cleanup] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
