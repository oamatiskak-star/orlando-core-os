import { supabaseVastgoedCore } from '../lib/supabase'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'

export type DatabaseObservation = {
  user_membership_row_exists: boolean
  user_membership_status: string | null
  user_membership_tier_id: string | null
  stripe_customer_id_stored: string | null
  stripe_subscription_id_stored: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean | null
  sync_latency_ms: number | null
  discrepancies: string[]
}

/**
 * After webhook delivery, verify that vastgoed_core.user_memberships shows the correct state.
 * Polls up to WEBHOOK_WAIT_MAX_MS — sync may lag webhook by seconds.
 */
export async function observeDatabaseSync(
  customerId: string | null,
  subscriptionId: string | null,
  expectedTierCode: string,
  sessionCreatedAt: number | null,
): Promise<DatabaseObservation> {
  const result: DatabaseObservation = {
    user_membership_row_exists: false,
    user_membership_status: null,
    user_membership_tier_id: null,
    stripe_customer_id_stored: null,
    stripe_subscription_id_stored: null,
    current_period_end: null,
    cancel_at_period_end: null,
    sync_latency_ms: null,
    discrepancies: [],
  }

  if (!customerId && !subscriptionId) {
    result.discrepancies.push('No customer or subscription id to query — sync not verifiable')
    return result
  }

  const deadline = Date.now() + env.WEBHOOK_WAIT_MAX_MS
  while (Date.now() < deadline) {
    let query = supabaseVastgoedCore
      .from('user_memberships')
      .select('tier_id, status, stripe_customer_id, stripe_subscription_id, current_period_end, cancel_at_period_end, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (subscriptionId) {
      query = query.eq('stripe_subscription_id', subscriptionId)
    } else if (customerId) {
      query = query.eq('stripe_customer_id', customerId)
    }

    const { data, error } = await query.maybeSingle()
    if (error) {
      logger.warn({ err: error.message }, 'database sync poll error')
    } else if (data) {
      result.user_membership_row_exists = true
      result.user_membership_status = data.status
      result.user_membership_tier_id = data.tier_id
      result.stripe_customer_id_stored = data.stripe_customer_id
      result.stripe_subscription_id_stored = data.stripe_subscription_id
      result.current_period_end = data.current_period_end
      result.cancel_at_period_end = data.cancel_at_period_end
      const updatedTs = new Date(data.updated_at).getTime()
      const sessionTs = (sessionCreatedAt ?? 0) * 1000
      result.sync_latency_ms = sessionTs ? updatedTs - sessionTs : null

      if (data.tier_id !== expectedTierCode) {
        result.discrepancies.push(`tier_id mismatch: expected ${expectedTierCode}, got ${data.tier_id}`)
      }
      if (!['active', 'trialing'].includes(data.status)) {
        result.discrepancies.push(`unexpected status: ${data.status}`)
      }
      return result
    }
    await new Promise(r => setTimeout(r, 2_000))
  }

  result.discrepancies.push('No user_memberships row found within sync window')
  return result
}
