// ==============================================================================
// src/lib/cleanup/retention.ts
// Automatic Project Retention Cleaner (default 72 hours)
// Deleting a project cascades to its user_project_actions rows, so a project is only
// removed when it is old (both published_at and created_at past the cutoff) AND nobody
// did anything with it. A project is preserved forever if any user:
//   - saved, applied, got a reply or won it (status saved/applied/replied/won)
//   - generated an AI proposal for it
//   - has it in the auto-bidding queue
// Untouched 'matched' and 'ignored' rows don't protect a project.
// ==============================================================================

import { supabaseAdmin } from '@/lib/supabase/admin';

export interface RetentionCleanupResult {
  ok: boolean;
  retentionHours: number;
  cutoffTime: string;
  preservedProjectCount: number;
  deletedProjects: number;
  deletedLeads: number;
  error?: string;
}

const MIN_RETENTION_HOURS = 24;
const BATCH_SIZE = 500; // old projects examined per run
const CHUNK_SIZE = 100; // ids per .in() filter (URL length)
const PROTECTED_STATUSES = ['saved', 'applied', 'replied', 'won'];

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

/**
 * Removes up to BATCH_SIZE expired, untouched projects (oldest first) and their leads_pool rows.
 */
export async function performProjectRetentionCleanup(
  retentionHours = 72
): Promise<RetentionCleanupResult> {
  const hours = Math.max(MIN_RETENTION_HOURS, Number.isFinite(retentionHours) ? retentionHours : 72);
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const result: RetentionCleanupResult = {
    ok: true,
    retentionHours: hours,
    cutoffTime,
    preservedProjectCount: 0,
    deletedProjects: 0,
    deletedLeads: 0,
  };

  try {
    // 1. Old candidates: scraped AND published before the cutoff, so a project that is still
    //    listed on its platform isn't deleted and re-inserted (which would re-alert users)
    const { data: oldProjects, error: projErr } = await (supabaseAdmin.from('projects') as any)
      .select('id, platform, external_id')
      .lt('created_at', cutoffTime)
      .lt('published_at', cutoffTime)
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (projErr) throw projErr;
    if (!oldProjects?.length) return result;

    // 2. Which of these candidates did someone act on? (checked per batch, so no 1,000-row cap issue)
    const candidateIds: string[] = oldProjects.map((p: any) => p.id);
    const preserved = new Set<string>();
    for (const chunk of chunkArray(candidateIds, CHUNK_SIZE)) {
      const [actionsRes, proposalsRes, queueRes] = await Promise.all([
        (supabaseAdmin.from('user_project_actions') as any)
          .select('project_id')
          .in('project_id', chunk)
          .in('status', PROTECTED_STATUSES),
        (supabaseAdmin.from('user_project_actions') as any)
          .select('project_id')
          .in('project_id', chunk)
          .not('generated_proposal', 'is', null),
        (supabaseAdmin.from('auto_bid_queue') as any).select('project_id').in('project_id', chunk),
      ]);
      // Never delete on a failed safety check
      const failed = actionsRes.error || proposalsRes.error || queueRes.error;
      if (failed) throw failed;
      for (const row of [...(actionsRes.data || []), ...(proposalsRes.data || []), ...(queueRes.data || [])]) {
        if (row.project_id) preserved.add(row.project_id);
      }
    }
    result.preservedProjectCount = preserved.size;

    const toDelete = oldProjects.filter((p: any) => !preserved.has(p.id));

    // 3. leads_pool rows first, then the projects (cascades to their untouched actions)
    for (const chunk of chunkArray(toDelete, CHUNK_SIZE)) {
      const { count: leadsCount, error: leadsErr } = await (supabaseAdmin.from('leads_pool') as any)
        .delete({ count: 'exact' })
        .in('external_post_id', chunk.map((p: any) => `${p.platform}_${p.external_id}`));
      if (leadsErr) console.warn('[Retention Cleanup] leads_pool delete warning:', leadsErr.message);
      else result.deletedLeads += leadsCount || 0;

      const { count: projCount, error: delErr } = await (supabaseAdmin.from('projects') as any)
        .delete({ count: 'exact' })
        .in('id', chunk.map((p: any) => p.id));
      if (delErr) console.error('[Retention Cleanup] projects delete error:', delErr.message);
      else result.deletedProjects += projCount || 0;
    }

    console.log(
      `[Retention Cleanup] Deleted ${result.deletedProjects} projects & ${result.deletedLeads} leads older than ${hours}h; preserved ${preserved.size} acted-on projects in this batch.`
    );
    return result;
  } catch (err: any) {
    console.error('[Retention Cleanup] Failed:', err?.message || err);
    return { ...result, ok: false, error: err?.message || String(err) };
  }
}
