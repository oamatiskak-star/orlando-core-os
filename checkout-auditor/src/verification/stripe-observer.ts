import type Stripe from 'stripe'
import { getStripe } from '../lib/stripe'
import { logger } from '../lib/logger'

export type StripeObservation = {
  session: {
    id: string
    mode: string
    payment_status: string | null
    amount_total: number | null
    amount_subtotal: number | null
    total_details_amount_tax: number | null
    currency: string | null
    locale: string | null
    customer: string | null
    subscription: string | null
    tax_behavior_observed: 'inclusive' | 'exclusive' | 'unknown' | null
    automatic_tax_enabled: boolean | null
    created_at: number | null
  } | null
  customer: {
    id: string
    email: string | null
    name: string | null
    address_country: string | null
    tax_ids: Array<{ type: string; value: string }>
    livemode: boolean
  } | null
  subscription: {
    id: string
    status: string
    current_period_start: number
    current_period_end: number
    items: Array<{ price_id: string; recurring_interval: string; unit_amount: number | null }>
    livemode: boolean
  } | null
  recent_events: Array<{
    id: string
    type: string
    created: number
    livemode: boolean
    object_id: string | null
  }>
  errors: string[]
}

/**
 * After Playwright finishes a checkout, query Stripe API (read-only restricted key)
 * to retrieve canonical state of Session/Customer/Subscription + recent events.
 */
export async function observeStripe(sessionId: string | null): Promise<StripeObservation> {
  const result: StripeObservation = {
    session: null,
    customer: null,
    subscription: null,
    recent_events: [],
    errors: [],
  }

  const stripe = getStripe()
  if (!stripe) {
    result.errors.push('Stripe restricted key not configured — observation skipped')
    return result
  }
  if (!sessionId) {
    result.errors.push('No session id provided')
    return result
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription', 'subscription.items.data.price', 'total_details'],
    })
    result.session = {
      id: session.id,
      mode: session.mode,
      payment_status: session.payment_status,
      amount_total: session.amount_total,
      amount_subtotal: session.amount_subtotal,
      total_details_amount_tax: session.total_details?.amount_tax ?? null,
      currency: session.currency,
      locale: session.locale,
      customer: typeof session.customer === 'string' ? session.customer : (session.customer?.id ?? null),
      subscription: typeof session.subscription === 'string' ? session.subscription : (session.subscription?.id ?? null),
      tax_behavior_observed: deriveTaxBehavior(session),
      automatic_tax_enabled: session.automatic_tax?.enabled ?? null,
      created_at: session.created,
    }

    if (session.customer && typeof session.customer !== 'string' && session.customer.deleted !== true) {
      const c = session.customer as Stripe.Customer
      const customerRecord = {
        id: c.id,
        email: c.email ?? null,
        name: c.name ?? null,
        address_country: c.address?.country ?? null,
        tax_ids: [] as Array<{ type: string; value: string }>,
        livemode: c.livemode,
      }
      result.customer = customerRecord
      try {
        const taxIds = await stripe.customers.listTaxIds(c.id)
        customerRecord.tax_ids = taxIds.data.map(t => ({ type: t.type, value: t.value }))
      } catch (err) {
        result.errors.push(`tax_ids listing failed: ${err instanceof Error ? err.message : err}`)
      }
    }

    if (session.subscription && typeof session.subscription !== 'string') {
      const s = session.subscription
      result.subscription = {
        id: s.id,
        status: s.status,
        current_period_start: s.current_period_start,
        current_period_end: s.current_period_end,
        items: s.items.data.map(item => ({
          price_id: item.price.id,
          recurring_interval: item.price.recurring?.interval ?? 'unknown',
          unit_amount: item.price.unit_amount,
        })),
        livemode: s.livemode,
      }
    }

    // Recent events for this session/customer (last 5 minutes)
    const fiveMinAgo = Math.floor(Date.now() / 1000) - 300
    const events = await stripe.events.list({ limit: 50, created: { gte: fiveMinAgo } })
    result.recent_events = events.data
      .filter(e => {
        const obj = e.data.object as { id?: string; customer?: string; subscription?: string }
        return obj.id === sessionId
          || obj.id === result.session?.subscription
          || obj.id === result.session?.customer
          || obj.customer === result.session?.customer
          || obj.subscription === result.session?.subscription
      })
      .map(e => ({
        id: e.id,
        type: e.type,
        created: e.created,
        livemode: e.livemode,
        object_id: (e.data.object as { id?: string }).id ?? null,
      }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`Stripe observation failed: ${msg}`)
    logger.error({ err: msg, sessionId }, 'Stripe observe error')
  }

  return result
}

function deriveTaxBehavior(session: any): StripeObservation['session'] extends infer S
  ? S extends { tax_behavior_observed: infer T } ? T : never
  : never {
  const lineItems = session.line_items?.data
  if (!lineItems || lineItems.length === 0) return 'unknown' as any
  // Look at first line item — tax_behavior is set per price object normally
  const lineItem = lineItems[0]
  const taxBehavior = lineItem.price?.tax_behavior
  if (taxBehavior === 'inclusive') return 'inclusive' as any
  if (taxBehavior === 'exclusive') return 'exclusive' as any
  return 'unknown' as any
}
