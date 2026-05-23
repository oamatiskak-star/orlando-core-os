import { z } from 'zod'

// ── Spec types ───────────────────────────────────────────────────────────

export const BillingCycleSchema = z.enum(['monthly', 'quarterly', 'yearly', 'n/a'])
export type BillingCycle = z.infer<typeof BillingCycleSchema>

export const DeviceSchema = z.enum([
  'desktop_chrome',
  'desktop_safari',
  'mobile_chrome',
  'mobile_safari',
])
export type Device = z.infer<typeof DeviceSchema>

export const TierSpecSchema = z.object({
  code: z.string(),                          // e.g. "explorer"
  display_name: z.string(),                  // e.g. "Aquier Scout"
  billing_cycles_supported: z.array(BillingCycleSchema),
  expected_prices_eur: z.object({
    monthly: z.number().nullable(),
    quarterly: z.number().nullable(),
    yearly: z.number().nullable(),
  }),
  flow_type: z.enum(['self_serve_stripe', 'sales_contact_form', 'hybrid']),
  test_priority: z.enum(['critical', 'high', 'medium', 'low']),
})
export type TierSpec = z.infer<typeof TierSpecSchema>

export const CountrySpecSchema = z.object({
  code: z.string().length(2),
  name: z.string(),
  tier_classification: z.enum(['tier1', 'tier2']),
  locale_default: z.string(),
  currency_expected: z.string().length(3),
  vat_rate_b2c_standard: z.number().nullable(),
  vat_reverse_charge_b2b: z.boolean(),
  route_prefix_candidates: z.array(z.string()),
  launch_status_in_plan: z.enum(['live', 'planned', 'tier2_future']),
  // From vastgoed_core.country_pricing_rules — geo-pricing multipliers
  pricing_multiplier: z.object({
    purchasing_power_factor: z.number().nullable(),
    market_factor: z.number().nullable(),
    combined: z.number().nullable(),
    note: z.string().optional(),
  }),
  // Pre-computed expected EUR prices per (tier × cycle); null when country has no pricing rule
  expected_prices_eur: z.object({
    explorer_monthly: z.number().nullable(),
    explorer_yearly: z.number().nullable(),
    developer_monthly: z.number().nullable(),
    developer_yearly: z.number().nullable(),
  }),
})
export type CountrySpec = z.infer<typeof CountrySpecSchema>

export const DeviceSpecSchema = z.object({
  id: DeviceSchema,
  display_name: z.string(),
  playwright_browser: z.enum(['chromium', 'webkit']),
  viewport: z.object({ width: z.number(), height: z.number() }),
  user_agent: z.string().optional(),
  is_mobile: z.boolean(),
  has_touch: z.boolean(),
})
export type DeviceSpec = z.infer<typeof DeviceSpecSchema>

export const StripeTestCardSchema = z.object({
  scenario_id: z.string(),
  card_number: z.string(),
  exp_month: z.string(),
  exp_year: z.string(),
  cvc: z.string(),
  expected_outcome: z.enum(['success', 'requires_3ds', 'declined', 'declined_after_3ds', 'insufficient_funds']),
  description: z.string(),
})
export type StripeTestCard = z.infer<typeof StripeTestCardSchema>

export const NegativeScenarioSchema = z.object({
  id: z.string(),
  description: z.string(),
  trigger: z.enum([
    'failed_card',
    'three_ds_failure',
    'session_expired',
    'coupon_applied',
    'b2b_vat_id',
    'reverse_charge',
    'declined_after_auth',
  ]),
  expected_severity_if_broken: z.enum(['info', 'low', 'medium', 'high', 'critical']),
  stripe_test_card_id: z.string().optional(),
})
export type NegativeScenario = z.infer<typeof NegativeScenarioSchema>

// ── Scenario combinatie ───────────────────────────────────────────────────

export const ScenarioSchema = z.object({
  scenario_code: z.string(),                   // unique combo identifier
  tier_code: z.string(),
  billing_cycle: BillingCycleSchema,
  country_code: z.string().length(2),
  device: DeviceSchema,
  negative_case: z.string().nullable(),        // ref naar NegativeScenario.id
  is_discovery_only: z.boolean().default(false),
})
export type Scenario = z.infer<typeof ScenarioSchema>

// ── Observations (gevangen per scenario) ──────────────────────────────────

export const ObservationsSchema = z.object({
  page_observations: z.object({
    membership_page_loaded: z.boolean(),
    membership_page_url: z.string().nullable(),
    tier_visible: z.boolean(),
    pricing_observed_eur: z.number().nullable(),
    locale_detected: z.string().nullable(),
    currency_label_detected: z.string().nullable(),
    vat_label_detected: z.string().nullable(),
    cta_clickable: z.boolean(),
    redirect_chain: z.array(z.string()),
    console_errors: z.array(z.string()),
    page_load_ms: z.number().nullable(),
    post_cta_url: z.string().nullable().optional(),
    post_cta_destination: z.string().nullable().optional(),
  }),
  stripe_session: z.object({
    session_id: z.string().nullable(),
    customer_id: z.string().nullable(),
    subscription_id: z.string().nullable(),
    amount_total_cents: z.number().nullable(),
    amount_subtotal_cents: z.number().nullable(),
    currency: z.string().nullable(),
    tax_amount_cents: z.number().nullable(),
    tax_behavior: z.string().nullable(),
    locale: z.string().nullable(),
    mode: z.string().nullable(),
    payment_status: z.string().nullable(),
  }).nullable(),
  webhooks: z.object({
    events_received: z.array(z.object({
      event_type: z.string(),
      received_at: z.string(),
      latency_from_session_ms: z.number().nullable(),
    })),
    expected_events_missing: z.array(z.string()),
    max_latency_ms: z.number().nullable(),
  }),
  database_sync: z.object({
    user_membership_row_exists: z.boolean(),
    user_membership_status: z.string().nullable(),
    sync_latency_ms: z.number().nullable(),
    discrepancies: z.array(z.string()),
  }),
  artifacts: z.array(z.object({
    kind: z.string(),
    storage_path: z.string(),
    size_bytes: z.number(),
  })),
})
export type Observations = z.infer<typeof ObservationsSchema>

// ── Discovery snapshot ────────────────────────────────────────────────────

export const DiscoverySnapshotSchema = z.object({
  country_code: z.string(),
  locale_resolved: z.string().nullable(),
  routing_strategy: z.enum(['path', 'subdomain', 'cookie', 'accept_language', 'none', 'unknown']),
  route_path: z.string(),
  http_status: z.number().nullable(),
  accessibility: z.enum(['ok', 'redirected', 'not_found', 'blocked', 'timeout', 'error']),
  tier_codes_visible: z.array(z.string()),
  pricing_observed: z.record(z.unknown()),
  snapshot_html_artifact_id: z.string().nullable(),
  notes: z.string().nullable(),
})
export type DiscoverySnapshot = z.infer<typeof DiscoverySnapshotSchema>

// ── AI Auditor output schema ─────────────────────────────────────────────

export const FindingSeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical'])
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>

export const FindingCategorySchema = z.enum([
  'vat_anomaly',
  'conversion_blocker',
  'ux_friction',
  'locale_issue',
  'mobile_render',
  'safari_issue',
  'payment_dropoff',
  'webhook_latency',
  'retry_failure',
  'missing_country',
  'missing_tier',
  'pricing_inconsistency',
  'currency_mismatch',
  'accessibility',
  'legal_compliance',
  'db_sync_failure',
  'stripe_misconfiguration',
  'tax_behavior_anomaly',
  'session_expired_handling',
])
export type FindingCategory = z.infer<typeof FindingCategorySchema>

// Lenient finding schema — Claude may emit slightly different field shapes.
// Defaults applied so a finding with severity+category+evidence is still usable.
export const FindingSchema = z.object({
  severity: FindingSeveritySchema,
  category: FindingCategorySchema,
  affected_route: z.string().default('unknown'),
  affected_country: z.string().default('all'),
  affected_tier: z.string().default('all'),
  affected_billing_cycle: z.string().default('all'),
  affected_device: z.string().default('all'),
  stripe_object_ids: z.array(z.string()).default([]),
  evidence_summary: z.string().min(1).max(4000),
  recommended_fix: z.string().min(1).max(4000),
  confidence_score: z.number().min(0).max(1).default(0.5),
  revenue_impact_eur_estimate: z.number().min(0).max(2_000_000).default(0),
  revenue_impact_reasoning: z.string().max(1000).default(''),
  evidence_artifact_paths: z.array(z.string()).default([]),
}).passthrough() // tolerate extra fields Claude adds (finding_id, etc.)
export type Finding = z.infer<typeof FindingSchema>

export const AuditorOutputSchema = z.object({
  findings: z.array(FindingSchema).default([]),
  summary: z.object({
    total_findings: z.number().default(0),
    by_severity: z.record(z.string(), z.number()).default({}),
    by_category: z.record(z.string(), z.number()).default({}),
    countries_with_no_checkout: z.array(z.string()).default([]),
    tiers_with_issues: z.array(z.string()).default([]),
    overall_health_score: z.number().min(0).max(100).default(100),
    executive_summary: z.string().min(1).max(4000).default('No summary provided.'),
  }).passthrough().default({}),
}).passthrough()
export type AuditorOutput = z.infer<typeof AuditorOutputSchema>

// ── Run-level types ───────────────────────────────────────────────────────

export type AuditRun = {
  id: string
  status: 'running' | 'completed' | 'failed' | 'aborted'
  started_at: string
  scope_filter: Partial<ScopeFilter>
}

export type ScopeFilter = {
  tier_codes: string[]
  country_codes: string[]
  devices: Device[]
  billing_cycles: BillingCycle[]
  include_negative_cases: boolean
  max_scenarios: number
}
