// GoCardless Bank Account Data (PSD2) client
// Documentatie: https://bankaccountdata.gocardless.com/api/v2/
// Gratis registratie op: https://bankaccountdata.gocardless.com

import { createAdminClient } from '@/lib/supabase/admin'

const GC_BASE = 'https://bankaccountdata.gocardless.com/api/v2'

export const ING_NL_BANK_ID = 'ING_INGBNL2A'

export type GcToken = { access: string; access_expires: number }

export type GcAccount = {
  id: string
  iban: string
  currency: string
  ownerName?: string
  name?: string
  status: string
}

export type GcBalance = {
  balanceAmount: { amount: string; currency: string }
  balanceType: string
  referenceDate?: string
}

export type GcTransaction = {
  transactionId: string
  bookingDate: string
  valueDate?: string
  transactionAmount: { amount: string; currency: string }
  creditorName?: string
  debtorName?: string
  creditorAccount?: { iban: string }
  debtorAccount?: { iban: string }
  remittanceInformationUnstructured?: string
  remittanceInformationStructured?: string
  endToEndId?: string
}

export type GcRequisition = {
  id: string
  status: string
  link: string
  accounts: string[]
  reference: string
}

async function getCredentials(): Promise<{ secret_id: string; secret_key: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('personal_bank_credentials')
    .select('secret_id, secret_key')
    .eq('provider', 'gocardless')
    .single()

  if (error || !data) throw new Error('GoCardless credentials niet geconfigureerd. Ga naar Dyme OS > Instellingen.')
  return data
}

async function getAccessToken(): Promise<string> {
  const supabase = createAdminClient()
  const { data: cred } = await supabase
    .from('personal_bank_credentials')
    .select('*')
    .eq('provider', 'gocardless')
    .single()

  if (!cred) throw new Error('GoCardless niet geconfigureerd')

  const now = new Date()
  if (cred.access_token && cred.token_expires && new Date(cred.token_expires) > now) {
    return cred.access_token
  }

  const res = await fetch(`${GC_BASE}/token/new/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ secret_id: cred.secret_id, secret_key: cred.secret_key }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GoCardless token fout [${res.status}]: ${err.slice(0, 200)}`)
  }

  const token: GcToken = await res.json()

  await supabase.from('personal_bank_credentials').update({
    access_token:  token.access,
    token_expires: new Date(Date.now() + (token.access_expires - 60) * 1000).toISOString(),
    updated_at:    new Date().toISOString(),
  }).eq('provider', 'gocardless')

  return token.access
}

async function gcFetch<T>(path: string): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${GC_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GoCardless API [${res.status}]: ${err.slice(0, 200)}`)
  }
  return res.json()
}

async function gcPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${GC_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GoCardless POST [${res.status}]: ${err.slice(0, 200)}`)
  }
  return res.json()
}

// ── Publieke functies ─────────────────────────────────────────────────────────

export async function saveCredentials(secretId: string, secretKey: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('personal_bank_credentials').upsert({
    provider:   'gocardless',
    secret_id:  secretId,
    secret_key: secretKey,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'provider' })
}

export async function hasCredentials(): Promise<boolean> {
  try {
    await getCredentials()
    return true
  } catch {
    return false
  }
}

export async function createIngRequisition(redirectUrl: string): Promise<GcRequisition> {
  // Maak end-user agreement
  const agreement = await gcPost<{ id: string }>('/agreements/enduser/', {
    institution_id:       ING_NL_BANK_ID,
    max_historical_days:  90,
    access_valid_for_days: 30,
    access_scope:         ['balances', 'details', 'transactions'],
  })

  // Maak requisition (autorisatielink)
  return gcPost<GcRequisition>('/requisitions/', {
    redirect:       redirectUrl,
    institution_id: ING_NL_BANK_ID,
    reference:      `orlando-ing-${Date.now()}`,
    agreement:      agreement.id,
    user_language:  'NL',
  })
}

export async function getRequisition(requisitionId: string): Promise<GcRequisition> {
  return gcFetch<GcRequisition>(`/requisitions/${requisitionId}/`)
}

export async function getAccountDetails(accountId: string): Promise<GcAccount> {
  return gcFetch<GcAccount>(`/accounts/${accountId}/details/`)
}

export async function getAccountBalances(accountId: string): Promise<GcBalance[]> {
  const res = await gcFetch<{ balances: GcBalance[] }>(`/accounts/${accountId}/balances/`)
  return res.balances ?? []
}

export async function getAccountTransactions(
  accountId: string,
  dateFrom?: string,
): Promise<{ booked: GcTransaction[]; pending: GcTransaction[] }> {
  const params = dateFrom ? `?date_from=${dateFrom}` : ''
  const res = await gcFetch<{ transactions: { booked: GcTransaction[]; pending: GcTransaction[] } }>(
    `/accounts/${accountId}/transactions/${params}`
  )
  return res.transactions ?? { booked: [], pending: [] }
}

export async function testCredentials(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getAccessToken()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}
