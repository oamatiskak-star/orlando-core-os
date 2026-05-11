export type FinCustomer = {
  id: string
  company_id: string
  name: string
  kvk?: string
  btw?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  score: number
  risk_level: string
  payment_avg_days: number
}

export type FinInvoice = {
  id: string
  company_id: string
  customer_id: string
  invoice_nr: string
  description?: string
  amount_excl: number
  vat_pct?: number
  amount_vat: number
  amount_incl: number
  amount_paid: number
  issued_at: string
  due_date: string
  paid_at?: string
  status: string
  days_overdue: number
  workflow_stage: string
  customer?: FinCustomer
}

export type FinPayment = {
  id: string
  invoice_id: string
  amount: number
  method: string
  reference?: string
  paid_at: string
}

export type FinReminder = {
  id: string
  invoice_id: string
  type: string
  subject?: string
  body?: string
  sent_at?: string
  opened_at?: string
  stage: string
}

export type FinIncassoCase = {
  id: string
  invoice_id: string
  company_id?: string
  status: string
  amount_principal: number
  amount_interest?: number
  amount_costs?: number
  amount_total: number
  incasso_party?: string
  started_at: string
}

export type FinLegalCase = {
  id: string
  incasso_case_id?: string
  company_id?: string
  status: string
  lawyer?: string
  case_nr?: string
  amount_claimed: number
  started_at: string
}

export type FinTimeline = {
  id: string
  invoice_id: string
  event_type: string
  title: string
  description?: string
  amount?: number
  performed_by: string
  created_at: string
}

export type FinWorkflowRule = {
  id: string
  company_id: string
  name: string
  trigger_type: string
  trigger_days?: number
  action_type: string
  active: boolean
}

export type FinTemplate = {
  id: string
  company_id: string
  name: string
  type: string
  stage: string
  subject?: string
  body: string
  tone: string
  active: boolean
}

export type FinCompanySettings = {
  company_id: string
  company_name?: string
  kvk?: string
  btw?: string
  iban?: string
  payment_terms: number
  incasso_days: number
  interest_rate: number
  late_fee: number
  tone_of_voice: string
  auto_reminder: boolean
  auto_incasso: boolean
}

export type FinDashboardStats = {
  total_open: number
  total_open_amount: number
  total_overdue: number
  total_overdue_amount: number
  total_incasso: number
  total_incasso_amount: number
  total_paid_month: number
  total_paid_month_amount: number
  avg_payment_days: number
  overdue_pct: number
}
