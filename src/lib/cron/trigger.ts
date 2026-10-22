// ==============================================================================
// src/lib/cron/trigger.ts
// Server-side helper to invoke the ingestion cron with the CRON_SECRET header.
// Never call /api/cron/ingest from the browser - the secret must stay on the server.
// ==============================================================================

const MIN_INTERVAL_MS = 60_000;

let lastTriggeredAt = 0;
let inFlight: Promise<any> | null = null;

function internalBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Local machines share the production database: a local ingestion cycle inserts the new
 * matches first and alerts them through the local (test) bot, so production skips them as
 * duplicates and the real bot never sends them. Locally, ingestion only runs when asked
 * for with `npm run dev:ingest` (LOCAL_INGEST=1).
 */
export const ingestTriggersAllowed = !!process.env.VERCEL || process.env.LOCAL_INGEST === '1';

/**
 * On Vercel the ingestion is driven by an external every-minute cron (cron-job.org),
 * and serverless instances don't share memory, so page-load triggers would multiply.
 */
export const pageLoadTriggersEnabled = !process.env.VERCEL && process.env.LOCAL_INGEST === '1';

export const LOCAL_INGEST_DISABLED_MESSAGE =
  'السحب متوقف على الجهاز عشان ميسرقش تنبيهات البوت الحقيقي. شغّل npm run dev:ingest لو محتاجه.';

/**
 * Triggers one ingestion cycle. Calls within MIN_INTERVAL_MS of the previous
 * trigger reuse the in-flight cycle or are skipped, so users can't hammer the scrapers.
 */
export async function triggerIngest(
  scrape: boolean = true
): Promise<{ ok: boolean; skipped?: boolean; disabled?: boolean; data?: any; error?: string }> {
  if (!ingestTriggersAllowed) {
    return { ok: false, disabled: true, error: LOCAL_INGEST_DISABLED_MESSAGE };
  }

  if (inFlight) {
    const data = await inFlight.catch(() => null);
    return { ok: !!data?.ok, skipped: true, data };
  }

  if (Date.now() - lastTriggeredAt < MIN_INTERVAL_MS) {
    return { ok: true, skipped: true };
  }

  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV !== 'development') {
    return { ok: false, error: 'CRON_SECRET is not configured' };
  }

  lastTriggeredAt = Date.now();
  inFlight = fetch(`${internalBaseUrl()}/api/cron/ingest?scrape=${scrape}`, {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  }).then((res) => res.json());

  try {
    const data = await inFlight;
    return { ok: !!data?.ok, data, error: data?.error };
  } catch (err: any) {
    return { ok: false, error: err.message };
  } finally {
    inFlight = null;
  }
}
