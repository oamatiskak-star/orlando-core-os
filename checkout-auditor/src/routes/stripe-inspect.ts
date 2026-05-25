import { Router } from 'express'
import { getStripe } from '../lib/stripe'
import { requireTriggerSecret } from './auth'
import { logger } from '../lib/logger'

const router = Router()

/**
 * Read-only inspection endpoint: lists active prices for given product IDs.
 * Used to map product → price IDs for DB wiring. Uses the LIVE read-only key.
 *
 * GET /stripe/prices?products=prod_x,prod_y
 */
router.get('/stripe/prices', requireTriggerSecret, async (req, res) => {
  const stripe = getStripe()
  if (!stripe) {
    res.status(503).json({ error: 'No Stripe key configured' })
    return
  }

  const productsParam = (req.query.products as string | undefined) ?? ''
  const productIds = productsParam.split(',').map(s => s.trim()).filter(Boolean)

  try {
    const out: Array<{
      product_id: string
      product_name: string | null
      prices: Array<{
        price_id: string
        currency: string
        unit_amount: number | null
        interval: string | null
        active: boolean
        nickname: string | null
      }>
    }> = []

    if (productIds.length > 0) {
      for (const pid of productIds) {
        let productName: string | null = null
        try {
          const product = await stripe.products.retrieve(pid)
          productName = product.name
        } catch (e) {
          logger.warn({ pid, err: String(e) }, 'product retrieve failed')
        }
        const prices = await stripe.prices.list({ product: pid, active: true, limit: 20 })
        out.push({
          product_id: pid,
          product_name: productName,
          prices: prices.data.map(p => ({
            price_id: p.id,
            currency: p.currency,
            unit_amount: p.unit_amount,
            interval: p.recurring?.interval ?? null,
            active: p.active,
            nickname: p.nickname,
          })),
        })
      }
    } else {
      // No products specified — list all active prices (limit 100)
      const prices = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] })
      const grouped = new Map<string, typeof out[0]>()
      for (const p of prices.data) {
        const prod = p.product as { id: string; name?: string } | string
        const pid = typeof prod === 'string' ? prod : prod.id
        const pname = typeof prod === 'string' ? null : (prod.name ?? null)
        if (!grouped.has(pid)) grouped.set(pid, { product_id: pid, product_name: pname, prices: [] })
        grouped.get(pid)!.prices.push({
          price_id: p.id,
          currency: p.currency,
          unit_amount: p.unit_amount,
          interval: p.recurring?.interval ?? null,
          active: p.active,
          nickname: p.nickname,
        })
      }
      out.push(...grouped.values())
    }

    res.json({ ok: true, products: out })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.warn({ err: msg }, 'prices.list failed — falling back to Events API (price.created)')

    // Fallback: the read key may lack plan_read but DOES have Event read.
    // Recently-created prices fire price.created events — extract from there.
    try {
      const events = await stripe.events.list({ type: 'price.created', limit: 100 })
      const fromEvents = events.data.map(ev => {
        const p = ev.data.object as {
          id: string; product: string; currency: string;
          unit_amount: number | null; recurring?: { interval?: string }; active: boolean; nickname: string | null
        }
        return {
          price_id: p.id,
          product_id: p.product,
          currency: p.currency,
          unit_amount: p.unit_amount,
          interval: p.recurring?.interval ?? null,
          active: p.active,
          nickname: p.nickname,
          event_created: ev.created,
        }
      })
      const filtered = productIds.length > 0
        ? fromEvents.filter(p => productIds.includes(p.product_id))
        : fromEvents
      res.json({ ok: true, source: 'events_api', prices: filtered })
      return
    } catch (evErr) {
      const evMsg = evErr instanceof Error ? evErr.message : String(evErr)
      logger.error({ err: msg, evErr: evMsg }, 'both prices.list and events fallback failed')
      res.status(502).json({
        error: msg,
        events_fallback_error: evMsg,
        hint: 'Read key lacks Products/Prices read AND Events fallback failed. Add Read on Products to the restricted key in Stripe Dashboard.',
      })
      return
    }
  }
})

export default router
