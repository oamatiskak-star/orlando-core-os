// Moneybird API v2 client — volledige implementatie
// Gebruikt de OAuth tokens opgeslagen in integration_connections

import { createAdminClient } from '@/lib/supabase/admin'
import type {
  MoneybirdAdministration,
  MoneybirdPurchaseInvoice,
  MoneybirdSalesInvoice,
  MoneybirdFinancialMutation,
} from './cfo-types'

const MB_BASE = 'https://moneybird.com/api/v2'

async function getMoneybirdToken(): Promise<{ access_token: string; administration_id: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('integration_connections')
    .select('access_token, refresh_token, token_expires, metadata')
    .eq('type', 'moneybird')
    .eq('status', 'connected')
    .single()

  if (error || !data) throw new Error('Moneybird niet verbonden. Ga naar Instellingen > Integraties.')

  const expires = data.token_expires ? new Date(data.token_expires) : null
  if (expires && expires < new Date()) {
    return refreshMoneybirdToken(data.refresh_token, data.metadata?.administration_id)
  }

  return {
    access_token:      data.access_token,
    administration_id: data.metadata?.administration_id ?? '',
  }
}

async function refreshMoneybirdToken(
  refresh_token: string,
  administration_id: string,
): Promise<{ access_token: string; administration_id: string }> {
  const res = await fetch('https://moneybird.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type:    'refresh_token',
      refresh_token,
      client_id:     process.env.MONEYBIRD_CLIENT_ID!,
      client_secret: process.env.MONEYBIRD_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error('Moneybird token refresh mislukt')
  const tokens = await res.json()

  const supabase = createAdminClient()
  await supabase.from('integration_connections').update({
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token ?? refresh_token,
    token_expires: tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  }).eq('type', 'moneybird')

  return { access_token: tokens.access_token, administration_id }
}

async function mbFetch<T>(path: string): Promise<T> {
  const { access_token } = await getMoneybirdToken()
  const res = await fetch(`${MB_BASE}${path}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Moneybird API fout [${res.status}]: ${err.slice(0, 200)}`)
  }
  return res.json()
}

async function mbFetchPaginated<T>(path: string, perPage = 100): Promise<T[]> {
  const { access_token, administration_id } = await getMoneybirdToken()
  const results: T[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `${MB_BASE}/${administration_id}${path}?per_page=${perPage}&page=${page}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${access_token}` },
    })
    if (!res.ok) break

    const data: T[] = await res.json()
    results.push(...data)

    if (data.length < perPage) {
      hasMore = false
    } else {
      page++
    }

    // Rate limiting — Moneybird staat max 300 req/min toe
    await new Promise(r => setTimeout(r, 220))
  }
  return results
}

// ── Publieke functies ─────────────────────────────────────────────────────────

export async function getAdministrations(): Promise<MoneybirdAdministration[]> {
  return mbFetch<MoneybirdAdministration[]>('/administrations')
}

export async function getPurchaseInvoices(
  updatedSince?: string,
): Promise<MoneybirdPurchaseInvoice[]> {
  const path = updatedSince
    ? `/documents/purchase_invoices?filter=period%3Athis_year,state%3Aall&updated_since=${encodeURIComponent(updatedSince)}`
    : `/documents/purchase_invoices?filter=period%3Athis_year,state%3Aall`
  const { administration_id } = await getMoneybirdToken()
  const { access_token } = await getMoneybirdToken()
  const results: MoneybirdPurchaseInvoice[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `${MB_BASE}/${administration_id}${path}&per_page=100&page=${page}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } })
    if (!res.ok) break
    const data: MoneybirdPurchaseInvoice[] = await res.json()
    results.push(...data)
    hasMore = data.length === 100
    page++
    if (hasMore) await new Promise(r => setTimeout(r, 220))
  }
  return results
}

export async function getSalesInvoices(
  updatedSince?: string,
): Promise<MoneybirdSalesInvoice[]> {
  const { administration_id } = await getMoneybirdToken()
  const { access_token } = await getMoneybirdToken()
  const results: MoneybirdSalesInvoice[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const sinceParam = updatedSince ? `&filter=updated_since%3A${encodeURIComponent(updatedSince)}` : ''
    const url = `${MB_BASE}/${administration_id}/sales_invoices?per_page=100&page=${page}${sinceParam}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } })
    if (!res.ok) break
    const data: MoneybirdSalesInvoice[] = await res.json()
    results.push(...data)
    hasMore = data.length === 100
    page++
    if (hasMore) await new Promise(r => setTimeout(r, 220))
  }
  return results
}

export async function getFinancialMutations(
  updatedSince?: string,
): Promise<MoneybirdFinancialMutation[]> {
  const { administration_id } = await getMoneybirdToken()
  const { access_token } = await getMoneybirdToken()
  const results: MoneybirdFinancialMutation[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const sinceParam = updatedSince ? `&filter=updated_since%3A${encodeURIComponent(updatedSince)}` : ''
    const url = `${MB_BASE}/${administration_id}/financial_mutations?per_page=100&page=${page}${sinceParam}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${access_token}` } })
    if (!res.ok) break
    const data: MoneybirdFinancialMutation[] = await res.json()
    results.push(...data)
    hasMore = data.length === 100
    page++
    if (hasMore) await new Promise(r => setTimeout(r, 220))
  }
  return results
}

export async function getLedgerAccounts() {
  const { administration_id } = await getMoneybirdToken()
  return mbFetch<{ id: string; name: string; account_type: string; account_id?: string }[]>(
    `/${administration_id}/ledger_accounts`,
  )
}

export async function getTaxRates() {
  const { administration_id } = await getMoneybirdToken()
  return mbFetch<{ id: string; name: string; percentage: string; tax_rate_type: string }[]>(
    `/${administration_id}/tax_rates`,
  )
}

export async function checkConnection(): Promise<boolean> {
  try {
    await getMoneybirdToken()
    return true
  } catch {
    return false
  }
}
