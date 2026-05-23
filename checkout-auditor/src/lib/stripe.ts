import Stripe from 'stripe'
import { pickStripeKey, hasStripeKey } from './secrets'
import { logger } from './logger'

const _clients = new Map<string, Stripe>() // cache per key

function buildClient(apiKey: string): Stripe {
  return new Stripe(apiKey, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    typescript: true,
    maxNetworkRetries: 2,
    timeout: 15_000,
  })
}

/**
 * Returns a Stripe client matched to the session ID prefix (cs_live_* → LIVE key,
 * cs_test_* → TEST key). Returns null when no appropriate key is configured.
 */
export function getStripeForSession(sessionId: string | null): Stripe | null {
  const apiKey = pickStripeKey(sessionId)
  if (!apiKey) {
    logger.warn({ sessionId, hasKey: hasStripeKey() }, 'No Stripe key matching session prefix — observer disabled for this session')
    return null
  }
  let client = _clients.get(apiKey)
  if (!client) {
    client = buildClient(apiKey)
    _clients.set(apiKey, client)
    const mode = apiKey.includes('_live_') ? 'live' : 'test'
    logger.info({ mode }, 'Stripe client initialized')
  }
  return client
}

/**
 * Legacy helper — returns ANY available Stripe client (live preferred).
 * Use getStripeForSession() when you have a session ID.
 */
export function getStripe(): Stripe | null {
  return getStripeForSession(null)
}
