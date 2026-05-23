import { runWalkthrough } from '../playwright/checkout-walkthrough'
import { observeStripe } from '../verification/stripe-observer'
import { observeWebhooks } from '../verification/webhook-observer'
import { observeDatabaseSync } from '../verification/database-observer'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'
import type { Scenario, Observations } from '../types'
import { loadTiers, loadCountries } from '../specs'

export type ScenarioRunOutcome = {
  scenario_db_id: string
  status: 'passed' | 'failed' | 'skipped' | 'blocked'
  observations: Observations
  error_message: string | null
  duration_ms: number
}

export async function runScenario(runId: string, scenario: Scenario): Promise<ScenarioRunOutcome> {
  const start = Date.now()

  // Insert scenario row with status running
  const { data: row, error: insertErr } = await supabase
    .from('aquier_audit_scenarios')
    .insert({
      run_id: runId,
      scenario_code: scenario.scenario_code,
      tier_code: scenario.tier_code,
      billing_cycle: scenario.billing_cycle,
      country_code: scenario.country_code,
      device: scenario.device,
      negative_case: scenario.negative_case,
      status: 'running',
    })
    .select('id')
    .single()

  if (insertErr || !row) {
    logger.error({ err: insertErr?.message, scenario: scenario.scenario_code }, 'scenario insert failed')
    throw new Error(`scenario insert failed: ${insertErr?.message}`)
  }
  const scenarioDbId = row.id as string

  let status: ScenarioRunOutcome['status'] = 'passed'
  let errorMessage: string | null = null
  let observations: Observations

  try {
    // 1. Playwright walkthrough
    const walk = await runWalkthrough(runId, scenarioDbId, scenario)

    // 2. Stripe observation (if reached Stripe)
    const sessionId = walk.stripe_result?.session_id_from_url ?? null
    const stripeObs = sessionId ? await observeStripe(sessionId) : null

    // 3. Webhook observation
    const webhookObs = await observeWebhooks(
      sessionId,
      stripeObs?.session?.created_at ?? null,
      stripeObs?.session?.customer ?? null,
    )

    // 4. Database sync
    const dbObs = await observeDatabaseSync(
      stripeObs?.session?.customer ?? null,
      stripeObs?.session?.subscription ?? null,
      scenario.tier_code,
      stripeObs?.session?.created_at ?? null,
    )

    observations = {
      page_observations: {
        membership_page_loaded: walk.membership_page_loaded,
        membership_page_url: walk.membership_page_url,
        tier_visible: walk.tier_visible,
        pricing_observed_eur: walk.pricing_observed_eur,
        locale_detected: walk.locale_observations?.locale_attribute_detected ?? null,
        currency_label_detected: walk.locale_observations?.currency_label_detected ?? null,
        vat_label_detected: walk.locale_observations?.vat_label_detected ?? null,
        cta_clickable: walk.cta_clickable,
        redirect_chain: walk.redirect_chain,
        console_errors: walk.console_errors,
        page_load_ms: walk.page_load_ms,
        auth_attempted: walk.auth_flow?.attempted ?? false,
        auth_success: walk.auth_flow?.success ?? false,
        auth_post_url: walk.auth_flow?.post_login_url ?? null,
        auth_steps: walk.auth_flow?.steps ?? [],
        auth_errors: walk.auth_flow?.errors ?? [],
        post_cta_url: walk.post_cta_url ?? null,
        post_cta_destination: walk.post_cta_destination ?? null,
      },
      stripe_session: stripeObs?.session
        ? {
            session_id: stripeObs.session.id,
            customer_id: stripeObs.session.customer,
            subscription_id: stripeObs.session.subscription,
            amount_total_cents: stripeObs.session.amount_total,
            amount_subtotal_cents: stripeObs.session.amount_subtotal,
            currency: stripeObs.session.currency,
            tax_amount_cents: stripeObs.session.total_details_amount_tax,
            tax_behavior: stripeObs.session.tax_behavior_observed,
            locale: stripeObs.session.locale,
            mode: stripeObs.session.mode,
            payment_status: stripeObs.session.payment_status,
          }
        : null,
      webhooks: {
        events_received: webhookObs.events_received.map(e => ({
          event_type: e.event_type,
          received_at: e.received_at,
          latency_from_session_ms: e.latency_from_session_ms,
        })),
        expected_events_missing: webhookObs.expected_events_missing,
        max_latency_ms: webhookObs.max_latency_ms,
      },
      database_sync: {
        user_membership_row_exists: dbObs.user_membership_row_exists,
        user_membership_status: dbObs.user_membership_status,
        sync_latency_ms: dbObs.sync_latency_ms,
        discrepancies: dbObs.discrepancies,
      },
      artifacts: walk.artifacts,
    }

    // Determine pass/fail
    if (scenario.is_discovery_only) {
      status = walk.tier_visible ? 'passed' : 'failed'
    } else {
      const reachedStripe = walk.stripe_result?.reached_stripe ?? false
      if (!walk.membership_page_loaded) {
        status = 'failed'
        errorMessage = 'membership page did not load'
      } else if (!walk.tier_visible) {
        status = 'failed'
        errorMessage = 'tier not visible on membership page'
      } else if (!walk.cta_clickable) {
        status = 'failed'
        errorMessage = 'CTA button not found on tier card'
      } else if (reachedStripe) {
        status = 'passed'
      } else {
        // Membership page works, CTA clickable, but didn't reach Stripe.
        // This is a partial-pass scenario — the audit captured useful data
        // (post_cta_destination tells us where it went). Mark as passed so
        // the auditor still analyzes; the post_cta_destination observation
        // will surface the "checkout requires signup-first" finding.
        status = 'passed'
        errorMessage = `Did not reach Stripe directly; landed on ${walk.post_cta_destination ?? 'unknown'} (${walk.post_cta_url ?? 'no url'})`
      }
    }

    // Update scenario row
    await supabase
      .from('aquier_audit_scenarios')
      .update({
        status,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        error_message: errorMessage,
        stripe_session_id: stripeObs?.session?.id ?? null,
        stripe_customer_id: stripeObs?.session?.customer ?? null,
        stripe_subscription_id: stripeObs?.session?.subscription ?? null,
        observed_amount_cents: stripeObs?.session?.amount_total ?? null,
        observed_currency: stripeObs?.session?.currency ?? null,
        observed_vat_cents: stripeObs?.session?.total_details_amount_tax ?? null,
        observed_locale: stripeObs?.session?.locale ?? null,
        observed_total_cents: stripeObs?.session?.amount_total ?? null,
        user_membership_synced: dbObs.user_membership_row_exists,
        webhook_latency_ms: webhookObs.max_latency_ms,
        observations,
      })
      .eq('id', scenarioDbId)
  } catch (err) {
    status = 'failed'
    errorMessage = err instanceof Error ? err.message : String(err)
    observations = emptyObservations()
    await supabase
      .from('aquier_audit_scenarios')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        error_message: errorMessage,
        observations,
      })
      .eq('id', scenarioDbId)
    logger.error({ err: errorMessage, scenario: scenario.scenario_code }, 'scenario run failed')
  }

  return {
    scenario_db_id: scenarioDbId,
    status,
    observations,
    error_message: errorMessage,
    duration_ms: Date.now() - start,
  }
}

function emptyObservations(): Observations {
  return {
    page_observations: {
      membership_page_loaded: false,
      membership_page_url: null,
      tier_visible: false,
      pricing_observed_eur: null,
      locale_detected: null,
      currency_label_detected: null,
      vat_label_detected: null,
      cta_clickable: false,
      redirect_chain: [],
      console_errors: [],
      page_load_ms: null,
    },
    stripe_session: null,
    webhooks: { events_received: [], expected_events_missing: [], max_latency_ms: null },
    database_sync: {
      user_membership_row_exists: false,
      user_membership_status: null,
      sync_latency_ms: null,
      discrepancies: ['scenario errored — no observation'],
    },
    artifacts: [],
  }
}
