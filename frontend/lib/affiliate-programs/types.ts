// Shared types voor Affiliate & Revenue Infrastructure (migratie 100).
// Additieve laag — los van 099 (account_setups). Spiegelt affiliate_programs.

export type ProgramCategory =
  | 'saas_ai'
  | 'finance_crypto'
  | 'vastgoed_data'
  | 'affiliate_network'
  | 'other'

export type AccountStatus =
  | 'not_started'
  | 'applied'
  | 'pending'
  | 'approved'
  | 'active'
  | 'payout_active'
  | 'rejected'
  | 'suspended'

export type LoginStatus =
  | 'none'
  | 'created'
  | 'verified'
  | 'mfa_pending'
  | 'locked'

export type RunKind =
  | 'account_setup'
  | 'affiliate_registration'
  | 'verification'
  | 'revenue_sync'
  | 'reminder'
  | 'terms_analysis'

export type RunStatus =
  | 'queued'
  | 'running'
  | 'awaiting_action'
  | 'awaiting_approval'
  | 'failed'
  | 'recovered'
  | 'completed'
  | 'cancelled'

export type HumanActionKind =
  | 'kyc_upload'
  | 'sms_verify'
  | 'captcha'
  | 'manual_review'
  | 'tax_form'
  | 'payout_setup'
  | 'login_2fa'
  | 'other'

export type HumanActionStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'

export type AffiliateProgramRow = {
  id: string
  company_id: string | null
  name: string
  account_type: string
  category: ProgramCategory
  url: string | null
  payout_model: string | null
  recurring: boolean | null
  account_status: AccountStatus
  login_status: LoginStatus
  payout_threshold: number | null
  payout_currency: string
  affiliate_link: string | null
  referral_code: string | null
  connected_channels: string[]
  connected_brands: string[]
  tax_requirements: string | null
  kyc_requirements: string | null
  country_availability: string[]
  api_available: boolean | null
  notes: string | null
  assigned_agent: string | null
  monthly_revenue: number
  lifetime_revenue: number
  last_status_check_at: string | null
  next_action_at: string | null
  created_at: string
  updated_at: string
}

export type ProgramOverviewRow = {
  id: string
  company_id: string | null
  name: string
  category: ProgramCategory
  account_status: AccountStatus
  login_status: LoginStatus
  recurring: boolean | null
  monthly_revenue: number
  lifetime_revenue: number
  affiliate_link: string | null
  next_action_at: string | null
  open_human_actions: number
  required_docs: number
  active_runs: number
}

export type HumanActionRow = {
  id: string
  program_id: string | null
  run_id: string | null
  action_kind: HumanActionKind
  title: string
  description: string | null
  status: HumanActionStatus
  assigned_to: string | null
  due_at: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export const CATEGORY_LABEL: Record<ProgramCategory, string> = {
  saas_ai: 'SaaS / AI / Marketing',
  finance_crypto: 'Finance / Investing / Crypto',
  vastgoed_data: 'Vastgoed / Data',
  affiliate_network: 'Affiliate Networks',
  other: 'Overig',
}

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  not_started: 'Not started',
  applied: 'Applied',
  pending: 'Pending',
  approved: 'Approved',
  active: 'Active',
  payout_active: 'Payout active',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

export const HUMAN_ACTION_LABEL: Record<HumanActionKind, string> = {
  kyc_upload: 'KYC upload',
  sms_verify: 'SMS verificatie',
  captcha: 'Captcha',
  manual_review: 'Handmatige review',
  tax_form: 'Tax form',
  payout_setup: 'Payout setup',
  login_2fa: 'Login 2FA',
  other: 'Overig',
}

// ── F2: documenten / revenue / affiliate-links ──────────────────────────────
export type DocKind = 'kyc_id' | 'proof_address' | 'tax_form' | 'contract' | 'bank' | 'other'
export type DocStatus = 'required' | 'uploaded' | 'verified' | 'rejected'

export type AccountDocumentRow = {
  id: string
  program_id: string
  doc_kind: DocKind
  storage_path: string | null
  status: DocStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type RevenueLedgerRow = {
  id: string
  program_id: string
  period_month: string
  gross_revenue: number
  commission_revenue: number
  currency: string
  source: string
  recorded_at: string
}

// 066_affiliate_engine.sql — affiliate_performance view (link-niveau tracking)
export type AffiliatePerformanceRow = {
  link_id: string
  product: string | null
  network: string | null
  niche: string | null
  commission_pct: number | null
  click_count: number
  conversion_count: number
  confirmed_count: number
  confirmed_commission_eur: number
  pending_commission_eur: number
  conversion_rate_pct: number
  epc_eur: number
}

export const DOC_KIND_LABEL: Record<DocKind, string> = {
  kyc_id: 'ID / KYC',
  proof_address: 'Adresbewijs',
  tax_form: 'Tax form',
  contract: 'Contract',
  bank: 'Bankgegevens',
  other: 'Overig',
}

export const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  required: 'Vereist',
  uploaded: 'Geüpload',
  verified: 'Geverifieerd',
  rejected: 'Afgewezen',
}

export const LOGIN_STATUS_LABEL: Record<LoginStatus, string> = {
  none: 'Geen login',
  created: 'Aangemaakt',
  verified: 'Geverifieerd',
  mfa_pending: 'MFA pending',
  locked: 'Geblokkeerd',
}

// ── F4: YouTube Connector + Aquier Revenue ──────────────────────────────────
export type YoutubeChannelRow = {
  id: string
  name: string | null
  naam: string | null
  handle: string | null
  subscriber_count: number | null
  subscribers: number | null
  monthly_revenue: number | null
  estimated_revenue: number | null
  status: string | null
  language: string | null
}

export type AquierMonitorRow = {
  id: string
  event_at: string
  category: string | null
  title: string | null
  metric_key: string | null
  metric_value: number | null
  metric_target: number | null
  variance_pct: number | null
}

// Channel display-naam (naam heeft voorrang op name)
export function channelLabel(c: { name: string | null; naam: string | null; handle: string | null }): string {
  return c.naam || c.name || c.handle || 'Onbekend kanaal'
}

// ── F5: account-type scaling framework ──────────────────────────────────────
export type AccountTypeDomain = 'affiliate' | 'social' | 'finance' | 'legal' | 'infra' | 'marketplace' | 'investor'

export type AccountSetupTypeRow = {
  type_key: string
  label: string
  domain: AccountTypeDomain
  description: string | null
  checklist: { step: string; action_kind: string }[]
  required_docs: string[]
  default_run_kind: string
  active: boolean
  sort_order: number
}

export const DOMAIN_LABEL: Record<AccountTypeDomain, string> = {
  affiliate: 'Affiliate',
  social: 'Social',
  finance: 'Finance',
  legal: 'Legal',
  infra: 'Infrastructuur',
  marketplace: 'Marketplace',
  investor: 'Investor',
}
