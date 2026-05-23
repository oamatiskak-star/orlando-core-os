import Stripe from 'stripe'
import { env, hasStripeKey } from './secrets'
import { logger } from './logger'

let _stripe: Stripe | null = null

export function getStripe(): Stripe | null {
  if (!hasStripeKey()) {
    logger.warn('Stripe restricted key not configured — observer disabled')
    return null
  }
  if (!_stripe) {
    _stripe = new Stripe(env.STRIPE_RESTRICTED_KEY_TEST!, {
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
      typescript: true,
      maxNetworkRetries: 2,
      timeout: 15_000,
    })
  }
  return _stripe
}

/**
 * Hard guard: any caller asking for the Stripe client must accept that it may be null
 * (when key absent or when key has Write permissions, which we refuse to use).
 *
 * Auditor MUST never attempt to create/modify Stripe objects — Stripe-side observation only.
 * The restricted key is expected to fail any write request from Stripe's side.
 */
export function requireReadOnlyStripe(): Stripe {
  const s = getStripe()
  if (!s) throw new Error('Stripe restricted key missing — cannot observe Stripe objects')
  return s
}
