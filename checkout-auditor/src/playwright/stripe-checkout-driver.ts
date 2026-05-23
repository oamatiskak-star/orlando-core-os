import type { Page } from 'playwright'
import { STRIPE_CHECKOUT_SELECTORS } from './selectors'
import type { StripeTestCard } from '../types'
import { logger } from '../lib/logger'

export type StripeCheckoutResult = {
  reached_stripe: boolean
  checkout_url: string | null
  session_id_from_url: string | null
  filled_card: boolean
  paid_button_clicked: boolean
  three_ds_encountered: boolean
  three_ds_completed: boolean
  final_redirect_url: string | null
  duration_ms: number
  errors: string[]
}

/**
 * Drives a Stripe Checkout page through to completion using a test card.
 * Will NEVER attempt with a real card — caller is responsible for using test-mode keys on aquier.com.
 *
 * If aquier.com checkout is in LIVE mode (not test), the auditor will not detect this from URL alone —
 * additional verification via Stripe API (mode='test' on Session) is done in stripe-observer.
 */
export async function driveStripeCheckout(page: Page, testCard: StripeTestCard, opts: {
  email?: string
  fillVatId?: string
  expectSuccess?: boolean
  timeoutMs?: number
}): Promise<StripeCheckoutResult> {
  const start = Date.now()
  const errors: string[] = []
  const result: StripeCheckoutResult = {
    reached_stripe: false,
    checkout_url: null,
    session_id_from_url: null,
    filled_card: false,
    paid_button_clicked: false,
    three_ds_encountered: false,
    three_ds_completed: false,
    final_redirect_url: null,
    duration_ms: 0,
    errors,
  }

  const timeout = opts.timeoutMs ?? 60_000
  const deadline = Date.now() + timeout

  try {
    // Wait for redirect to checkout.stripe.com
    await page.waitForURL(STRIPE_CHECKOUT_SELECTORS.url_pattern, { timeout: 20_000 }).catch(() => {
      errors.push('Did not redirect to checkout.stripe.com within 20s')
    })
    const url = page.url()
    if (STRIPE_CHECKOUT_SELECTORS.url_pattern.test(url)) {
      result.reached_stripe = true
      result.checkout_url = url
      const sessionMatch = url.match(/cs_(test|live)_[a-zA-Z0-9]+/)
      result.session_id_from_url = sessionMatch ? sessionMatch[0] : null
    } else {
      result.errors.push(`URL is not Stripe: ${url}`)
      return finalize(result, start)
    }

    // Email (if not pre-filled)
    if (opts.email) {
      const emailSel = await firstAvailable(page, STRIPE_CHECKOUT_SELECTORS.email_field)
      if (emailSel) await page.locator(emailSel).fill(opts.email).catch(() => errors.push('email fill failed'))
    }

    // VAT id (if provided + field exists)
    if (opts.fillVatId) {
      const vatSel = await firstAvailable(page, STRIPE_CHECKOUT_SELECTORS.vat_id_field)
      if (vatSel) await page.locator(vatSel).fill(opts.fillVatId).catch(() => errors.push('vat fill failed'))
      else errors.push('vat_id_field not found — B2B VAT path not testable')
    }

    // Fill card
    const cardSel = await firstAvailable(page, STRIPE_CHECKOUT_SELECTORS.card_number)
    const expSel = await firstAvailable(page, STRIPE_CHECKOUT_SELECTORS.card_expiry)
    const cvcSel = await firstAvailable(page, STRIPE_CHECKOUT_SELECTORS.card_cvc)
    if (!cardSel || !expSel || !cvcSel) {
      errors.push('Card fields not found on Stripe checkout — selectors may need update')
      return finalize(result, start)
    }
    await page.locator(cardSel).fill(testCard.card_number)
    await page.locator(expSel).fill(`${testCard.exp_month}/${testCard.exp_year.slice(-2)}`)
    await page.locator(cvcSel).fill(testCard.cvc)
    result.filled_card = true

    // Cardholder name (sometimes required)
    const nameSel = await firstAvailable(page, STRIPE_CHECKOUT_SELECTORS.cardholder_name)
    if (nameSel) await page.locator(nameSel).fill('Aquier Auditor Test').catch(() => {})

    // Click pay button
    const paySel = await firstAvailable(page, STRIPE_CHECKOUT_SELECTORS.pay_button)
    if (!paySel) {
      errors.push('Pay button not found')
      return finalize(result, start)
    }
    await page.locator(paySel).click()
    result.paid_button_clicked = true

    // Handle 3DS frame if expected
    if (testCard.expected_outcome === 'requires_3ds' || testCard.expected_outcome === 'declined_after_3ds') {
      try {
        const frameLoc = page.frameLocator(STRIPE_CHECKOUT_SELECTORS.three_ds_iframe)
        await frameLoc.locator('body').waitFor({ timeout: 15_000 })
        result.three_ds_encountered = true
        const completeSel = await firstAvailableInFrame(frameLoc, STRIPE_CHECKOUT_SELECTORS.three_ds_complete_button)
        if (completeSel) {
          await frameLoc.locator(completeSel).click()
          result.three_ds_completed = true
        } else {
          errors.push('3DS complete button not found in iframe')
        }
      } catch (err) {
        errors.push(`3DS handling failed: ${err instanceof Error ? err.message : err}`)
      }
    }

    // Wait for final redirect or for an error message
    const remainingTime = Math.max(5_000, deadline - Date.now())
    await Promise.race([
      page.waitForURL(/aquier\.com/, { timeout: remainingTime }).then(() => {
        result.final_redirect_url = page.url()
      }),
      page.waitForTimeout(remainingTime),
    ])
    if (!result.final_redirect_url) {
      result.final_redirect_url = page.url()
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
    logger.warn({ err: String(err), card: testCard.scenario_id }, 'driveStripeCheckout error')
  }

  return finalize(result, start)
}

function finalize(result: StripeCheckoutResult, start: number): StripeCheckoutResult {
  result.duration_ms = Date.now() - start
  return result
}

async function firstAvailable(page: Page, candidates: string[]): Promise<string | null> {
  for (const sel of candidates) {
    try {
      const count = await page.locator(sel).count()
      if (count > 0) return sel
    } catch { /* continue */ }
  }
  return null
}

async function firstAvailableInFrame(frame: ReturnType<Page['frameLocator']>, candidates: string[]): Promise<string | null> {
  for (const sel of candidates) {
    try {
      const count = await frame.locator(sel).count()
      if (count > 0) return sel
    } catch { /* continue */ }
  }
  return null
}
