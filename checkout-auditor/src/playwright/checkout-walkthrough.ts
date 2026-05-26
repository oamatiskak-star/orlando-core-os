import type { Page } from 'playwright'
import { newContextForDevice } from './browser-pool'
import { MEMBERSHIP_SELECTORS } from './selectors'
import { attachNetworkRecorder, type NetworkEvent } from './network-recorder'
import { assertLocale, type LocaleAssertResult } from './locale-asserts'
import { driveStripeCheckout, type StripeCheckoutResult } from './stripe-checkout-driver'
import { loginIfConfigured, type AuthFlowResult } from './auth-flow'
import { loadStripeTestCards, loadCountries, loadTiers, loadDevices } from '../specs'
import { uploadArtifact, buildArtifactPath } from '../lib/storage'
import { supabase } from '../lib/supabase'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'
import type { Scenario } from '../types'

export type PostCtaDestination = 'stripe' | 'signup' | 'login' | 'register' | 'dashboard' | 'membership' | 'unknown'

export type WalkthroughResult = {
  membership_page_loaded: boolean
  membership_page_url: string | null
  redirect_chain: string[]
  page_load_ms: number | null
  locale_observations: LocaleAssertResult | null
  console_errors: string[]
  tier_visible: boolean
  cta_clickable: boolean
  pricing_observed_eur: number | null
  post_cta_url: string | null
  post_cta_destination: PostCtaDestination | null
  auth_flow: AuthFlowResult | null
  stripe_result: StripeCheckoutResult | null
  network_events: NetworkEvent[]
  artifacts: Array<{ kind: string; storage_path: string; size_bytes: number }>
  errors: string[]
}

function classifyDestination(url: string): PostCtaDestination {
  if (/checkout\.stripe\.com/.test(url)) return 'stripe'
  if (/\/signup(\b|\?|\/)/.test(url)) return 'signup'
  if (/\/register(\b|\?|\/)/.test(url)) return 'register'
  if (/\/login(\b|\?|\/)/.test(url)) return 'login'
  if (/\/dashboard(\b|\?|\/)/.test(url)) return 'dashboard'
  if (/\/membership(\b|\?|\/)/.test(url)) return 'membership'
  return 'unknown'
}

/**
 * Runs ONE scenario end-to-end:
 *   1. open /membership for the given country
 *   2. select billing cycle + tier
 *   3. click CTA → Stripe Checkout
 *   4. fill test card → submit
 *   5. capture screenshots, video, HAR per step
 *
 * For Institutional/Private tiers: only step 1-2 (discovery-only).
 */
export async function runWalkthrough(
  runId: string,
  scenarioId: string,
  scenario: Scenario,
): Promise<WalkthroughResult> {
  const country = loadCountries().find(c => c.code === scenario.country_code)
  const tier = loadTiers().find(t => t.code === scenario.tier_code)
  const device = loadDevices().find(d => d.id === scenario.device)
  if (!country || !tier || !device) throw new Error(`Missing spec for scenario ${scenario.scenario_code}`)

  const context = await newContextForDevice(device)
  // Record video
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false }).catch(() => {})

  const consoleErrors: string[] = []
  const errors: string[] = []
  const artifacts: WalkthroughResult['artifacts'] = []

  const page = await context.newPage()
  await page.context().setExtraHTTPHeaders({ 'Accept-Language': country.locale_default })

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  const recorder = attachNetworkRecorder(page)

  const result: WalkthroughResult = {
    membership_page_loaded: false,
    membership_page_url: null,
    redirect_chain: [],
    page_load_ms: null,
    locale_observations: null,
    console_errors: consoleErrors,
    tier_visible: false,
    cta_clickable: false,
    pricing_observed_eur: null,
    post_cta_url: null,
    post_cta_destination: null,
    auth_flow: null,
    stripe_result: null,
    network_events: [],
    artifacts,
    errors,
  }

  try {
    // 0. Optional pre-auth login (Phase 2). No-op when TEST_USER_EMAIL/PASSWORD not set.
    const authResult = await loginIfConfigured(page, context)
    result.auth_flow = authResult
    if (authResult.attempted && !authResult.success) {
      errors.push(`login failed: ${authResult.errors.join('; ') || 'unknown'}`)
    }

    // 1. open /membership
    const membershipUrl = new URL('/membership', env.AQUIER_BASE_URL).toString()
    const loadStart = Date.now()
    const navResponse = await page.goto(membershipUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    result.page_load_ms = Date.now() - loadStart
    result.membership_page_url = page.url()
    result.membership_page_loaded = navResponse?.status() === 200 || navResponse?.status() === 304

    // Snapshot screenshot of membership page
    const membershipScreenshot = await page.screenshot({ type: 'png', fullPage: true })
    artifacts.push(await persistArtifact(runId, scenarioId, 'screenshot-membership', 'png', 'image/png', membershipScreenshot))

    // 2. Locale + currency assertions
    const bodyText = (await page.locator('body').textContent().catch(() => '')) ?? ''
    const htmlLang = await page.locator('html').getAttribute('lang').catch(() => null)
    result.locale_observations = assertLocale(bodyText, htmlLang, country)

    // 3. Toggle billing cycle if needed.
    //    Aquier defaults to "Maandelijks" — only click for non-monthly scenarios.
    //    Also check button's aria-pressed/data-active before clicking to avoid toggling off.
    if (scenario.billing_cycle !== 'monthly') {
      const cycleToggle =
        scenario.billing_cycle === 'yearly' ? MEMBERSHIP_SELECTORS.yearly_toggle :
        scenario.billing_cycle === 'quarterly' ? MEMBERSHIP_SELECTORS.quarterly_toggle :
        null
      if (cycleToggle) {
        for (const sel of cycleToggle) {
          try {
            const loc = page.locator(sel).first()
            if (await loc.count()) {
              // Skip if already active (aria-pressed=true or class includes active marker)
              const aria = await loc.getAttribute('aria-pressed').catch(() => null)
              const className = (await loc.getAttribute('class').catch(() => '')) ?? ''
              const alreadyActive = aria === 'true' || /\b(active|selected|is-active|bg-stone-900|text-white)\b/.test(className)
              if (!alreadyActive) {
                await loc.click()
                await page.waitForTimeout(500)
              }
              break
            }
          } catch { /* continue */ }
        }
      }
    }

    // 4. Find tier card + extract price
    //    Aquier uses #tier-<code> container with the price in <span class="text-2xl font-black">€299</span>
    //    followed by <span class="text-xs text-stone-400">/mnd</span>. Description may contain €1.000/m²
    //    so we MUST find the price element specifically, not just grep the tier text.
    const tierName = tier.display_name
    let tierLocator = page.locator(MEMBERSHIP_SELECTORS.tier_card_by_code(tier.code)).first()
    if (await tierLocator.count() === 0) {
      tierLocator = page.locator(`:has-text("${tierName}")`).first()
    }
    if (await tierLocator.count() > 0) {
      result.tier_visible = true
      // Look for the dedicated price span (largest text, font-black)
      const priceSpan = tierLocator.locator('span.text-2xl, span.text-3xl, span.font-black').first()
      let priceText: string | null = null
      if (await priceSpan.count() > 0) {
        priceText = (await priceSpan.textContent().catch(() => '')) ?? null
      }
      // Fallback: try parsing tier text but EXCLUDE description-paragraph content
      if (!priceText) {
        const fullText = (await tierLocator.textContent().catch(() => '')) ?? ''
        // Find prices that are NOT followed by "/m²" or " per m²" (those are filter values, not tier prices)
        const matches = Array.from(fullText.matchAll(/€\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)(?!\s*\/m²|\s+per\s+m²)/g))
        // Prefer larger numbers (tier prices typically €100+; filter values are usually €1.000)
        const candidates = matches.map(m => m[1])
        priceText = candidates[0] ?? null
      }
      if (priceText) {
        const m = priceText.match(/(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/)
        if (m) {
          const numStr = m[1].replace(/\./g, '').replace(',', '.')
          result.pricing_observed_eur = Number(numStr)
        }
      }
      // Detect "Prijs op aanvraag" / "Contact sales" indicator
      const tierBlockText = (await tierLocator.textContent().catch(() => '')) ?? ''
      const hasContactSales = MEMBERSHIP_SELECTORS.sales_contact_indicator_text.some(t => tierBlockText.includes(t))
      if (hasContactSales) {
        errors.push(`tier shows contact-sales indicator (no checkout flow on this card)`)
      }
    }

    // 5. If discovery-only (sales_contact_form), stop here
    if (scenario.is_discovery_only) {
      logger.info({ scenario: scenario.scenario_code }, 'discovery-only scenario — stopping after page observation')
      result.network_events = recorder.getEvents()
      await context.tracing.stop({ path: `/tmp/trace-${scenarioId}.zip` }).catch(() => {})
      await context.close().catch(() => {})
      return result
    }

    // 6. Click CTA on the tier
    let ctaClicked = false
    for (const sel of MEMBERSHIP_SELECTORS.cta_button_within_tier) {
      try {
        const ctaLoc = tierLocator.locator(sel).first()
        if (await ctaLoc.count() > 0) {
          await ctaLoc.click({ timeout: 10_000 })
          ctaClicked = true
          result.cta_clickable = true
          break
        }
      } catch { /* try next */ }
    }
    if (!ctaClicked) {
      // Fallback: any pricing-cta button
      const fallbackButtons = await page.locator('a:has-text("Start"), button:has-text("Start"), a:has-text("Subscribe")').all()
      if (fallbackButtons.length > 0) {
        await fallbackButtons[0].click().catch(err => errors.push(`fallback CTA click: ${err}`))
        ctaClicked = true
        result.cta_clickable = true
      } else {
        errors.push('No CTA button found for tier')
      }
    }

    // 7. Capture post-CTA destination — classify before attempting Stripe driver
    if (ctaClicked) {
      await page.waitForTimeout(2500) // give navigation / SPA route change time
      const postCtaUrl = page.url()
      result.post_cta_url = postCtaUrl
      result.post_cta_destination = classifyDestination(postCtaUrl)

      logger.info({ scenario: scenario.scenario_code, post_cta_url: postCtaUrl, dest: result.post_cta_destination }, 'CTA clicked')

      // Only drive Stripe if we actually landed on Stripe Checkout
      if (result.post_cta_destination === 'stripe') {
        const testCard = loadStripeTestCards().find(c => c.scenario_id === 'card_visa_success')!
        result.stripe_result = await driveStripeCheckout(page, testCard, {
          email: `audit+${scenarioId.slice(0, 8)}@aquier-test.example`,
          timeoutMs: 90_000,
        })
      } else {
        errors.push(`CTA landed on ${result.post_cta_destination} (${postCtaUrl}) instead of Stripe Checkout`)
      }

      // Always capture post-CTA screenshot (regardless of destination)
      const postCheckout = await page.screenshot({ type: 'png', fullPage: true }).catch(() => null)
      if (postCheckout) {
        artifacts.push(await persistArtifact(runId, scenarioId, 'screenshot-post-checkout', 'png', 'image/png', postCheckout))
      }
    }

    result.network_events = recorder.getEvents()

    // Persist HAR-ish network log as JSON
    const harJson = JSON.stringify({ scenario: scenario.scenario_code, events: result.network_events }, null, 2)
    artifacts.push(await persistArtifact(runId, scenarioId, 'network-har', 'json', 'application/json', harJson))
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err))
    logger.error({ err: String(err), scenario: scenario.scenario_code }, 'walkthrough error')
  } finally {
    recorder.stop()
    await context.tracing.stop({ path: `/tmp/trace-${scenarioId}.zip` }).catch(() => {})
    await context.close().catch(() => {})
  }

  return result
}

async function persistArtifact(
  runId: string,
  scenarioId: string,
  kind: string,
  ext: string,
  contentType: string,
  body: Buffer | string,
): Promise<{ kind: string; storage_path: string; size_bytes: number }> {
  const path = buildArtifactPath(runId, scenarioId, kind, ext)
  try {
    const uploaded = await uploadArtifact(path, body, contentType)
    await supabase.from('aquier_audit_artifacts').insert({
      run_id: runId,
      scenario_id: scenarioId,
      kind: kind.includes('screenshot') ? 'screenshot' : kind.includes('network') ? 'har' : 'dom_snapshot',
      storage_path: uploaded.path,
      size_bytes: uploaded.size_bytes,
      mime_type: contentType,
    })
    return { kind, storage_path: uploaded.path, size_bytes: uploaded.size_bytes }
  } catch (err) {
    logger.warn({ err: String(err), path }, 'artifact persist failed')
    return { kind, storage_path: path, size_bytes: 0 }
  }
}
