import { Router } from 'express'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { requireTriggerSecret } from './auth'
import { logger } from '../lib/logger'

const router = Router()

type TierCfg = {
  db_id: string
  label: string
  product: string
  prices: Array<{ interval: 'month' | 'year'; amount: number }>
}

const TIERS: TierCfg[] = [
  {
    db_id: 'explorer',
    label: 'Aquier Scout',
    product: 'prod_Ua5noJ68DGz91p',
    prices: [
      { interval: 'month', amount: 27900 },
      { interval: 'year', amount: 267900 },
    ],
  },
  {
    db_id: 'developer',
    label: 'Aquier Developer',
    product: 'prod_Ua5npi33LhGL9b',
    prices: [
      { interval: 'month', amount: 41900 },
      { interval: 'year', amount: 419000 },
    ],
  },
]

async function ensurePrice(stripe: Stripe, productId: string, interval: 'month' | 'year', amount: number) {
  const existing = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  const match = existing.data.find(
    p => p.currency === 'usd' && p.recurring?.interval === interval && p.unit_amount === amount
  )
  if (match) return { id: match.id, created: false }
  const created = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: amount,
    recurring: { interval },
  })
  return { id: created.id, created: true }
}

/**
 * Maakt idempotent de USD maand+jaar prijzen aan voor explorer + developer op de
 * bestaande LIVE producten, en wireert vastgoed_core.membership_tiers.
 *
 * Vereist env var STRIPE_WRITE_KEY (rk_live_/sk_live_ met Products+Prices WRITE),
 * gezet in de Render dashboard env (geen bestand). Guard: RUN_TRIGGER_SECRET.
 *
 * POST /stripe/create-tier-prices
 */
router.post('/stripe/create-tier-prices', requireTriggerSecret, async (_req, res) => {
  const writeKey = process.env.STRIPE_WRITE_KEY
  if (!writeKey) {
    res.status(503).json({ error: 'STRIPE_WRITE_KEY niet geconfigureerd in Render env' })
    return
  }
  if (!writeKey.includes('_live_')) {
    res.status(400).json({ error: 'STRIPE_WRITE_KEY is geen _live_ key — aquier draait cs_live_, LIVE write-key vereist' })
    return
  }

  const stripe = new Stripe(writeKey, {
    apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    maxNetworkRetries: 2,
    timeout: 20_000,
  })

  try {
    const result: Record<string, { monthly: string; annual: string; created: string[] }> = {}
    for (const tier of TIERS) {
      const created: string[] = []
      let monthly = ''
      let annual = ''
      for (const pr of tier.prices) {
        const r = await ensurePrice(stripe, tier.product, pr.interval, pr.amount)
        if (pr.interval === 'month') monthly = r.id
        else annual = r.id
        if (r.created) created.push(`${pr.interval}:${r.id}`)
      }
      result[tier.db_id] = { monthly, annual, created }
    }

    // Wire DB
    const SB_URL = process.env.SUPABASE_URL
    const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    const wired: Record<string, string> = {}
    if (SB_URL && SB_KEY) {
      const sb = createClient(SB_URL, SB_KEY, { db: { schema: 'vastgoed_core' } })
      for (const tier of TIERS) {
        const r = result[tier.db_id]
        const { error } = await sb
          .from('membership_tiers')
          .update({ stripe_monthly_price_id_usd: r.monthly, stripe_annual_price_id_usd: r.annual })
          .eq('id', tier.db_id)
        wired[tier.db_id] = error ? `FOUT: ${error.message}` : 'ok'
      }
    }

    res.json({ ok: true, prices: result, db_wired: wired })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    logger.error({ err: msg }, 'create-tier-prices failed')
    res.status(502).json({
      error: msg,
      hint: /permission|does not have/i.test(msg)
        ? 'STRIPE_WRITE_KEY mist WRITE op Products/Prices. Gebruik sk_live_ of restricted key met Products+Prices: Write.'
        : undefined,
    })
  }
})

export default router
