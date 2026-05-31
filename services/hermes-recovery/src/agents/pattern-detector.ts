import { getSupabase } from '../connectors/supabase'
import { logger } from '../core/logger'

const log = logger.child({ agent: 'pattern-detector' })

export interface PatternResult {
  isSystemic: boolean
  occurrences: number
  clusterIds: string[]
}

export async function detectAndEscalatePattern(
  errorCode: string,
  windowHours: number,
  threshold: number
): Promise<PatternResult> {
  const db = getSupabase()

  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()

  try {
    // Count occurrences of this error code in the window
    const { data: events, error: queryError } = await db
      .from('hermes.error_events')
      .select('id', { count: 'exact' })
      .eq('error_code', errorCode)
      .gte('created_at', windowStart)

    if (queryError) throw queryError

    const occurrences = events?.length || 0

    log.info({ errorCode, occurrences, threshold, windowHours }, 'Pattern check')

    if (occurrences >= threshold) {
      // Check if pattern already exists
      const { data: existingPattern } = await db
        .from('hermes.error_patterns')
        .select('id, cluster_ids')
        .eq('error_code', errorCode)
        .eq('is_systemic', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!existingPattern) {
        // Create new pattern record
        const clusterIds = events?.map((e) => e.id) || []
        const { data: newPattern, error: insertError } = await db
          .from('hermes.error_patterns')
          .insert({
            error_code: errorCode,
            is_systemic: true,
            occurrence_count: occurrences,
            cluster_ids: clusterIds,
            detection_window_hours: windowHours,
            created_at: new Date().toISOString(),
          })
          .select('cluster_ids')
          .single()

        if (insertError) {
          log.error({ insertError }, 'Failed to insert error pattern')
          throw insertError
        }

        log.warn({ errorCode, occurrences }, 'Systemic pattern created')

        return {
          isSystemic: true,
          occurrences,
          clusterIds: newPattern?.cluster_ids || clusterIds,
        }
      }

      // Update existing pattern
      const clusterIds = existingPattern.cluster_ids || []
      const updatedIds = Array.from(new Set([...clusterIds, ...(events?.map((e) => e.id) || [])]))

      const { error: updateError } = await db
        .from('hermes.error_patterns')
        .update({
          occurrence_count: occurrences,
          cluster_ids: updatedIds,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPattern.id)

      if (updateError) {
        log.error({ updateError }, 'Failed to update error pattern')
        throw updateError
      }

      return {
        isSystemic: true,
        occurrences,
        clusterIds: updatedIds,
      }
    }

    return {
      isSystemic: false,
      occurrences,
      clusterIds: [],
    }
  } catch (err) {
    log.error({ err }, 'Pattern detection error')
    throw err
  }
}
