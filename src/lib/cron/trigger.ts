// ==============================================================================
// src/lib/cron/trigger.ts
// Server-side helper to invoke the ingestion cron with the CRON_SECRET header.
// Never call /api/cron/ingest from the browser - the secret must stay on the server.
// ==============================================================================

const MIN_INTERVAL_MS = 60_000;

let lastTriggeredAt = 0;
let inFlight: Promise<any> | null = null;

function internalBaseUrl(): string {
  return process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
}

/**
 * Triggers one ingestion cycle. Calls within MIN_INTERVAL_MS of the previous
 * trigger reuse the in-flight cycle or are skipped, so users can't hammer the scrapers.
 */
export async function triggerIngest(
  scrape: boolean = true
): Promise<{ ok: boolean; skipped?: boolean; data?: any; error?: string }> {
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
