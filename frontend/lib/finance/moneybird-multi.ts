// Moneybird multi-company client — directe API key authenticatie (geen OAuth)
// Haalt configuratie op uit moneybird_companies tabel (server-side only)

import { createAdminClient } from '@/lib/supabase/admin'

const MB_BASE = 'https://moneybird.com/api/v2'

export type MbCompanyConfig = {
  company_id: string
  company_name: string
  administration_id: string
  api_key: string
  digit_email: string | null
  is_active: boolean
  last_sync_at: string | null
}

export type MbSalesInvoice = {
  id: string
  invoice_id: string
  invoice_date: string
  due_date: string | null
  state: string
  contact?: {
    id: string
    company_name: string
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
  }
  total_price_incl_tax: string
  total_price_excl_tax: string
  total_tax: string
  currency: string
  paid_at: string | null
  url: string
  created_at: string
  updated_at: string
}

export type MbContact = {
  id: string
  company_name: string
  firstname: string
  lastname: string
  email: string | null
  phone: string | null
  address1: string | null
  city: string | null
  country: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
}

export type MbLiveData = {
  company: MbCompanyConfig
  invoices: {
    all: MbSalesInvoice[]
    open: MbSalesInvoice[]
    overdue: MbSalesInvoice[]
    paid: MbSalesInvoice[]
    late: MbSalesInvoice[]
  }
  summary: {
    total_open: number
    total_overdue: number
    total_paid: number
    amount_open: number
    amount_overdue: number
    amount_paid_ytd: number
    oldest_overdue_days: number
  }
}

async function getCompanyConfig(companyId: string): Promise<MbCompanyConfig> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('moneybird_companies')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .single()

  if (error || !data) throw new Error(`Moneybird configuratie niet gevonden voor ${companyId}`)
  return data as MbCompanyConfig
}

export async function getAllCompanyConfigs(): Promise<MbCompanyConfig[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('moneybird_companies')
    .select('*')
    .eq('is_active', true)
    .order('company_id')

  if (error) throw new Error('Kan Moneybird bedrijven niet ophalen')
  return (data ?? []) as MbCompanyConfig[]
}

async function mbGet<T>(config: MbCompanyConfig, path: string): Promise<T> {
  const url = `${MB_BASE}/${config.administration_id}${path}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const err = await res.text().catch(() => 'Onbekende fout')
    throw new Error(`Moneybird API [${res.status}] voor ${config.company_id}: ${err.slice(0, 200)}`)
  }
  return res.json()
}

async function mbGetPaginated<T>(config: MbCompanyConfig, path: string): Promise<T[]> {
  const results: T[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const sep = path.includes('?') ? '&' : '?'
    const url = `${MB_BASE}/${config.administration_id}${path}${sep}per_page=100&page=${page}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.api_key}` },
      next: { revalidate: 0 },
    })
    if (!res.ok) break

    const data: T[] = await res.json()
    results.push(...data)
    hasMore = data.length === 100
    page++
    if (hasMore) await new Promise(r => setTimeout(r, 250))
  }
  return results
}

export async function getSalesInvoicesForCompany(
  companyId: string,
  state?: 'open' | 'late' | 'paid' | 'all',
): Promise<MbSalesInvoice[]> {
  const config = await getCompanyConfig(companyId)
  const filter = state && state !== 'all' ? `?filter=state%3A${state}` : ''
  return mbGetPaginated<MbSalesInvoice>(config, `/sales_invoices${filter}`)
}

export async function getLiveData(companyId: string): Promise<MbLiveData> {
  const config = await getCompanyConfig(companyId)

  // Haal open + late facturen op in parallel
  const [openInvoices, lateInvoices, paidInvoices] = await Promise.all([
    mbGetPaginated<MbSalesInvoice>(config, '/sales_invoices?filter=state%3Aopen'),
    mbGetPaginated<MbSalesInvoice>(config, '/sales_invoices?filter=state%3Alate'),
    mbGetPaginated<MbSalesInvoice>(config, '/sales_invoices?filter=state%3Apaid,period%3Athis_year'),
  ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdue = [...openInvoices, ...lateInvoices].filter(inv => {
    if (!inv.due_date) return false
    return new Date(inv.due_date) < today
  })

  const amountOpen = openInvoices.reduce((s, i) => s + parseFloat(i.total_price_incl_tax ?? '0'), 0)
  const amountOverdue = overdue.reduce((s, i) => s + parseFloat(i.total_price_incl_tax ?? '0'), 0)
  const amountPaid = paidInvoices.reduce((s, i) => s + parseFloat(i.total_price_incl_tax ?? '0'), 0)

  const oldestOverdue = overdue.reduce((max, inv) => {
    if (!inv.due_date) return max
    const days = Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000)
    return Math.max(max, days)
  }, 0)

  return {
    company: config,
    invoices: {
      all: [...openInvoices, ...lateInvoices, ...paidInvoices],
      open: openInvoices,
      overdue,
      paid: paidInvoices,
      late: lateInvoices,
    },
    summary: {
      total_open:          openInvoices.length,
      total_overdue:       overdue.length,
      total_paid:          paidInvoices.length,
      amount_open:         amountOpen,
      amount_overdue:      amountOverdue,
      amount_paid_ytd:     amountPaid,
      oldest_overdue_days: oldestOverdue,
    },
  }
}

export async function getContactsForCompany(companyId: string): Promise<MbContact[]> {
  const config = await getCompanyConfig(companyId)
  return mbGetPaginated<MbContact>(config, '/contacts')
}

export async function testConnection(companyId: string): Promise<{
  ok: boolean
  company_name?: string
  administration_id?: string
  error?: string
}> {
  try {
    const config = await getCompanyConfig(companyId)
    const res = await fetch(`${MB_BASE}/${config.administration_id}/administrations`, {
      headers: { Authorization: `Bearer ${config.api_key}` },
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return {
      ok: true,
      company_name:      config.company_name,
      administration_id: config.administration_id,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

export async function updateLastSync(companyId: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase
    .from('moneybird_companies')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('company_id', companyId)
}
