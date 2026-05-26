#!/usr/bin/env node
/*
 * Idempotent: maakt de USD maand+jaar prijzen aan voor Scout (explorer) en
 * Developer op de bestaande LIVE Stripe-producten, en print de price-ids + SQL.
 *
 * Vereist een Stripe WRITE-key in env var STRIPE_WRITE_KEY (sk_live_... of een
 * restricted key met Products+Prices WRITE). De key wordt uit de omgeving /
 * .env gelezen — NOOIT hardcoden, NOOIT in een chat plakken.
 *
 * Draaien (vanuit checkout-auditor/):
 *   1) zet in checkout-auditor/.env:  STRIPE_WRITE_KEY=sk_live_xxx
 *   2) node scripts/create-usd-prices.js
 */
require('dotenv/config')
const Stripe = require('stripe')

const KEY = process.env.STRIPE_WRITE_KEY
if (!KEY) {
  console.error('FOUT: STRIPE_WRITE_KEY ontbreekt. Zet hem in checkout-auditor/.env (sk_live_... of restricted key met Products+Prices WRITE).')
  process.exit(1)
}
if (!KEY.includes('_live_')) {
  console.error('WAARSCHUWING: key is geen *_live_* key. De aquier checkout draait cs_live_, dus je hebt een LIVE write-key nodig. Afgebroken.')
  process.exit(1)
}

const stripe = new Stripe(KEY, {
  apiVersion: '2024-12-18.acacia',
  maxNetworkRetries: 2,
  timeout: 20000,
})

// tier -> { db_id, product, prices: [{interval, amount_cents}] }
const TIERS = [
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

async function ensurePrice(productId, interval, amount) {
  // Zoek bestaande actieve USD-prijs met juiste interval + bedrag (idempotent)
  const existing = await stripe.prices.list({ product: productId, active: true, limit: 100 })
  const match = existing.data.find(
    p => p.currency === 'usd' && p.recurring && p.recurring.interval === interval && p.unit_amount === amount
  )
  if (match) {
    return { id: match.id, created: false }
  }
  const created = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: amount,
    recurring: { interval },
  })
  return { id: created.id, created: true }
}

async function main() {
  const result = {}
  for (const tier of TIERS) {
    result[tier.db_id] = {}
    console.error(`\n== ${tier.label} (${tier.db_id}) — product ${tier.product} ==`)
    for (const pr of tier.prices) {
      const r = await ensurePrice(tier.product, pr.interval, pr.amount)
      const col = pr.interval === 'month' ? 'monthly' : 'annual'
      result[tier.db_id][col] = r.id
      console.error(`  ${pr.interval} $${(pr.amount / 100).toFixed(2)} -> ${r.id} ${r.created ? '(NIEUW aangemaakt)' : '(bestond al)'}`)
    }
  }

  console.error('\n===== PRICE IDS (JSON) =====')
  console.log(JSON.stringify(result, null, 2))

  // Wire de DB direct als Supabase-creds aanwezig zijn; anders print SQL.
  const SB_URL = process.env.SUPABASE_URL
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (SB_URL && SB_KEY) {
    const { createClient } = require('@supabase/supabase-js')
    const sb = createClient(SB_URL, SB_KEY, { db: { schema: 'vastgoed_core' } })
    console.error('\n===== DB WIRING (vastgoed_core.membership_tiers) =====')
    for (const tier of TIERS) {
      const r = result[tier.db_id]
      const { error } = await sb
        .from('membership_tiers')
        .update({ stripe_monthly_price_id_usd: r.monthly, stripe_annual_price_id_usd: r.annual })
        .eq('id', tier.db_id)
      if (error) console.error(`  ${tier.db_id}: FOUT ${error.message}`)
      else console.error(`  ${tier.db_id}: gekoppeld (maand=${r.monthly}, jaar=${r.annual})`)
    }
  } else {
    console.error('\n===== READY-TO-RUN SQL (geen Supabase-creds in env) =====')
    for (const tier of TIERS) {
      const r = result[tier.db_id]
      console.error(
        `update vastgoed_core.membership_tiers set stripe_monthly_price_id_usd='${r.monthly}', stripe_annual_price_id_usd='${r.annual}' where id='${tier.db_id}';`
      )
    }
  }
}

main().catch(err => {
  console.error('\nSTRIPE FOUT:', err && err.message ? err.message : err)
  if (err && /permission|does not have/i.test(String(err.message))) {
    console.error('De key mist WRITE-rechten op Products/Prices. Gebruik een sk_live_ key of een restricted key met Products+Prices: Write.')
  }
  process.exit(1)
})
