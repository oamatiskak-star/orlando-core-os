// CFO Agent — Type definities voor alle finance intelligence modules

export type CfoCompanyId = 'STRKBEHEER' | 'STRKBOUW' | 'BOUWPROFFS' | 'MODIWERIJO'

export type CfoTransaction = {
  id: string
  company_id: CfoCompanyId
  source: 'moneybird' | 'bunq' | 'ing' | 'handmatig' | 'mail'
  external_id?: string
  direction: 'debet' | 'credit'
  amount_excl: number
  amount_vat: number
  amount_incl: number
  vat_pct: number
  currency: string
  description?: string
  reference?: string
  supplier_id?: string
  supplier?: CfoSupplier
  ledger_account?: string
  ledger_account_code?: string
  category?: string
  project_id?: string
  transaction_date: string
  payment_date?: string
  status: 'concept' | 'geboekt' | 'betaald' | 'geannuleerd'
  ai_category?: string
  ai_confidence: number
  ai_ledger_suggestion?: string
  approved_by_human: boolean
  moneybird_id?: string
  moneybird_type?: string
  created_at: string
  updated_at: string
}

export type CfoSupplier = {
  id: string
  name: string
  aliases: string[]
  kvk?: string
  btw_number?: string
  iban?: string
  email?: string
  website?: string
  category: string
  subcategory?: string
  default_ledger?: string
  default_ledger_code?: string
  default_vat_pct: number
  risk_level: 'laag' | 'midden' | 'hoog' | 'kritiek'
  is_subscription: boolean
  subscription_amount?: number
  subscription_cycle?: 'maandelijks' | 'kwartaal' | 'jaarlijks'
  total_spend_ytd: number
  total_spend_all: number
  transaction_count: number
  last_invoice_at?: string
  ai_fingerprint?: Record<string, unknown>
  notes?: string
  created_at: string
  updated_at: string
}

export type CfoTaxReservation = {
  id: string
  company_id: string
  tax_type: 'btw' | 'vpb' | 'ib' | 'loonheffing' | 'overig'
  period_year: number
  period_quarter?: number
  period_month?: number
  amount_required: number
  amount_reserved: number
  amount_paid: number
  deadline?: string
  status: 'open' | 'gereserveerd' | 'ingediend' | 'betaald' | 'te_laat'
  ai_forecast?: number
  notes?: string
  created_at: string
  updated_at: string
}

export type CfoCashflowForecast = {
  id: string
  company_id: string
  forecast_date: string
  period_type: 'dag' | 'week' | 'maand'
  expected_in: number
  expected_out: number
  net_flow: number
  opening_balance: number
  closing_balance: number
  confidence: number
  risk_flag: boolean
  risk_reason?: string
  actuals_in?: number
  actuals_out?: number
  created_at: string
}

export type CfoInsight = {
  id: string
  company_id?: string
  insight_type: 'kostenoptimalisatie' | 'omzetgroei' | 'liquiditeit' | 'belasting' | 'risico' | 'groei' | 'anomalie' | 'advies'
  priority: 'kritiek' | 'hoog' | 'middel' | 'laag'
  title: string
  body: string
  impact_amount?: number
  impact_pct?: number
  action_required: boolean
  action_label?: string
  action_url?: string
  is_dismissed: boolean
  dismissed_at?: string
  ai_model?: string
  confidence?: number
  valid_until?: string
  created_at: string
}

export type CfoRiskAlert = {
  id: string
  company_id?: string
  alert_type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  title: string
  message: string
  threshold?: number
  current_value?: number
  is_resolved: boolean
  resolved_at?: string
  resolved_by?: string
  notified_at?: string
  created_at: string
}

export type CfoMonthlyReport = {
  id: string
  company_id?: string
  period_year: number
  period_month: number
  report_type: 'cfo_maand' | 'cfo_kwartaal' | 'cfo_jaar' | 'belasting' | 'liquiditeit'
  status: 'concept' | 'genereren' | 'gereed' | 'fout'
  revenue_total: number
  costs_total: number
  profit_net: number
  profit_margin_pct: number
  cashflow_end: number
  btw_to_pay: number
  vpb_reserved: number
  debtors_open: number
  executive_summary?: string
  kpi_data?: CfoKpiData
  cashflow_data?: CfoCashflowData
  tax_data?: CfoTaxData
  insights_data?: CfoInsightsData
  action_list?: CfoAction[]
  pdf_url?: string
  pdf_storage_path?: string
  generated_at?: string
  generated_by: string
  created_at: string
}

export type CfoSubscription = {
  id: string
  company_id: string
  supplier_id?: string
  supplier?: CfoSupplier
  name: string
  description?: string
  category: string
  amount_monthly: number
  amount_yearly: number
  currency: string
  billing_cycle: 'maandelijks' | 'kwartaal' | 'jaarlijks' | 'onbekend'
  next_billing_date?: string
  last_seen_date?: string
  is_active: boolean
  is_essential: boolean
  ai_detected: boolean
  ai_confidence: number
  notes?: string
  created_at: string
  updated_at: string
}

// ── CFO Intelligence types ────────────────────────────────────────────────────

export type CfoKpiData = {
  revenue_total: number
  revenue_recurring: number
  revenue_one_off: number
  revenue_mom_change: number
  costs_total: number
  costs_top: { category: string; amount: number; change_pct: number }[]
  profit_net: number
  profit_margin_pct: number
  ebitda: number
  burnrate: number
  runway_days: number
}

export type CfoCashflowData = {
  current_balance: number
  balance_30d: number
  balance_60d: number
  balance_90d: number
  incoming_30d: number
  outgoing_30d: number
  risk_date?: string
  risk_amount?: number
}

export type CfoTaxData = {
  btw_q1?: number; btw_q2?: number; btw_q3?: number; btw_q4?: number
  btw_current_quarter: number
  btw_reserved: number
  btw_gap: number
  btw_deadline?: string
  vpb_estimated_year: number
  vpb_reserved: number
  vpb_gap: number
  ib_risk_amount?: number
  loonheffing_monthly?: number
  next_deadlines: { type: string; deadline: string; amount: number; status: string }[]
}

export type CfoInsightsData = {
  top_cost_saving?: string
  top_revenue_opportunity?: string
  top_liquidity_risk?: string
  all_insights: {
    type: string
    title: string
    impact_amount?: number
    priority: string
  }[]
}

export type CfoAction = {
  priority: 'Hoog' | 'Middel' | 'Laag'
  category: string
  action: string
  impact?: string
  deadline?: string
}

// ── Moneybird API types ───────────────────────────────────────────────────────

export type MoneybirdAdministration = {
  id: string
  name: string
  language: string
  currency: string
  country: string
  time_zone: string
}

export type MoneybirdPurchaseInvoice = {
  id: string
  administration_id: string
  contact?: { id: string; company_name: string; email?: string }
  reference?: string
  date: string
  due_date?: string
  state: string
  invoice_id?: string
  details?: {
    id: string
    description?: string
    price: string
    amount?: string
    tax_rate_id?: string
  }[]
  total_price_incl_tax: string
  total_price_excl_tax: string
  total_tax: string
  currency: string
  created_at: string
  updated_at: string
}

export type MoneybirdSalesInvoice = {
  id: string
  administration_id: string
  contact?: { id: string; company_name: string; firstname?: string; lastname?: string }
  invoice_date: string
  due_date?: string
  state: string
  invoice_id: string
  details?: {
    id: string
    description?: string
    price: string
    amount?: string
    tax_rate_id?: string
  }[]
  total_price_incl_tax: string
  total_price_excl_tax: string
  total_tax: string
  currency: string
  paid_at?: string
  created_at: string
  updated_at: string
}

export type MoneybirdFinancialMutation = {
  id: string
  administration_id: string
  amount: string
  code?: string
  date: string
  message?: string
  account_servicer_transaction_id?: string
  created_at: string
  updated_at: string
}

// ── CFO Analyse samenvatting ──────────────────────────────────────────────────

export type CfoDashboardSummary = {
  last_updated: string
  companies: {
    id: string
    name: string
    cashflow_balance: number
    revenue_mtd: number
    costs_mtd: number
    open_invoices_amount: number
    tax_debt: number
    risk_level: 'groen' | 'oranje' | 'rood'
  }[]
  total_cashflow: number
  total_revenue_mtd: number
  total_costs_mtd: number
  total_open_invoices: number
  total_tax_reserved: number
  active_alerts: number
  critical_alerts: number
  insights_count: number
  last_sync_at?: string
}

export type CfoMailDocument = {
  supplier: string
  invoice_total: number
  vat: number
  category: string
  confidence: number
  company: string
  project_id?: string
  is_duplicate: boolean
  is_subscription: boolean
  ubl_detected: boolean
  payment_reminder: boolean
  contract_detected: boolean
  raw_amounts: number[]
}
