// ==============================================================================
// src/lib/cleanup/retention.ts
// Automatic 72-Hour Project Retention Cleaner
// Safely removes stale projects (> 72 hours by published_at or created_at) while permanently preserving:
// 1. Projects saved/bookmarked by users (status = 'saved' & notes = 'user_saved')
// 2. Projects with generated AI proposals (generated_proposal IS NOT NULL)
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

/**
 * Splits an array into chunks of a given size to avoid URL length limitations
 */
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Performs retention cleanup of projects older than retentionHours (default: 72 hours / 3 days).
 * Strictly guarantees that any saved project or project with an AI proposal is NEVER deleted.
 */
export async function performProjectRetentionCleanup(
  retentionHours = 72
): Promise<RetentionCleanupResult> {
  const cutoffTime = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();

  try {
    // 1. Query all preserved project IDs from user_project_actions
    // Preserved criteria:
    // - status = 'saved' AND notes = 'user_saved' (user explicitly clicked save)
    // - generated_proposal IS NOT NULL (user generated an AI proposal)
    const { data: preservedActions, error: actionErr } = await (supabaseAdmin
      .from('user_project_actions') as any)
      .select('project_id')
      .or('notes.eq.user_saved,generated_proposal.not.is.null');

    if (actionErr) {
      console.error('[Retention Cleanup] Failed to fetch preserved project IDs:', actionErr.message);
      return {
        ok: false,
        retentionHours,
        cutoffTime,
        preservedProjectCount: 0,
        deletedProjects: 0,
        deletedLeads: 0,
        error: actionErr.message,
      };
    }

    const preservedIdsSet = new Set<string>(
      (preservedActions || [])
        .map((a: any) => a.project_id)
        .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
    );

    // 2. Query projects older than cutoffTime in batches (checking published_at or created_at)
    let totalDeletedProjects = 0;
    let totalDeletedLeads = 0;
    const fetchLimit = 200;

    const { data: oldProjects, error: projErr } = await (supabaseAdmin
      .from('projects') as any)
      .select('id, platform, external_id')
      .or(`published_at.lt.${cutoffTime},created_at.lt.${cutoffTime}`)
      .limit(fetchLimit);

    if (projErr) {
      console.error('[Retention Cleanup] Error fetching candidate projects:', projErr.message);
      return {
        ok: false,
        retentionHours,
        cutoffTime,
        preservedProjectCount: preservedIdsSet.size,
        deletedProjects: 0,
        deletedLeads: 0,
        error: projErr.message,
      };
    }

    if (oldProjects && oldProjects.length > 0) {
      // Exclude preserved projects
      const toDelete = oldProjects.filter((p: any) => !preservedIdsSet.has(p.id));
      const toDeleteIds = toDelete.map((p: any) => p.id);
      const toDeleteExternalPostIds = toDelete.map(
        (p: any) => `${p.platform}_${p.external_id}`
      );

      // 3. Delete matching leads from leads_pool in safe chunks
      const leadChunks = chunkArray(toDeleteExternalPostIds, 40);
      for (const chunk of leadChunks) {
        const { error: leadsErr } = await (supabaseAdmin
          .from('leads_pool') as any)
          .delete()
          .in('external_post_id', chunk);

        if (!leadsErr) {
          totalDeletedLeads += chunk.length;
        } else {
          console.warn('[Retention Cleanup] Leads deletion chunk warning:', leadsErr.message);
        }
      }

      // 4. Delete projects from projects table in safe chunks
      const projectChunks = chunkArray(toDeleteIds, 40);
      for (const chunk of projectChunks) {
        const { error: delErr } = await (supabaseAdmin
          .from('projects') as any)
          .delete()
          .in('id', chunk);

        if (!delErr) {
          totalDeletedProjects += chunk.length;
        } else {
          console.error('[Retention Cleanup] Projects deletion chunk error:', delErr.message);
        }
      }
    }

    console.log(
      `[Retention Cleanup] Completed: deleted ${totalDeletedProjects} projects & ${totalDeletedLeads} leads older than ${retentionHours}h. Preserved ${preservedIdsSet.size} projects.`
    );

    return {
      ok: true,
      retentionHours,
      cutoffTime,
      preservedProjectCount: preservedIdsSet.size,
      deletedProjects: totalDeletedProjects,
      deletedLeads: totalDeletedLeads,
    };
  } catch (err: any) {
    console.error('[Retention Cleanup] Unexpected failure:', err);
    return {
      ok: false,
      retentionHours,
      cutoffTime,
      preservedProjectCount: 0,
      deletedProjects: 0,
      deletedLeads: 0,
      error: err.message,
    };
  }
}
