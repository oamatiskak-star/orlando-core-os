// Tink (by Visa) Open Banking client — PSD2 NL
// Documentatie: https://docs.tink.com/api

import { createAdminClient } from '@/lib/supabase/admin'

const TINK_API   = 'https://api.tink.com/api/v1'
const TINK_LINK  = 'https://link.tink.com/1.0'

export type TinkAccount = {
  id:             string
  name:           string
  type:           string
  balances:       { booked: { amount: { value: { scale: number; unscaledValue: number }; currencyCode: string } } }
  identifiers:    { iban?: { iban: string } }
}

export type TinkTransaction = {
  id:                 string
  accountId:          string
  amount:             { value: { scale: number; unscaledValue: number }; currencyCode: string }
  dates:              { booked?: string; value?: string }
  descriptions:       { original?: string; display?: string }
  merchantInformation?: { merchantName?: string; merchantCategoryCode?: string }
  status:             string
  types:              { type?: string }
  counterparties?:    { payer?: { name?: { unstructured?: string }; identifiers?: { financialInstitution?: { accountNumber?: string } } }; payee?: { name?: { unstructured?: string } } }
}

async function getCredentials(): Promise<{ client_id: string; client_secret: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('personal_bank_credentials')
    .select('secret_id, secret_key')
    .eq('provider', 'tink')
    .single()
  if (error || !data) throw new Error('Tink credentials niet geconfigureerd.')
  return { client_id: data.secret_id, client_secret: data.secret_key }
}

async function getClientToken(): Promise<string> {
  const { client_id, client_secret } = await getCredentials()
  const res = await fetch(`${TINK_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id,
      client_secret,
      scope:         'user:create,user:delete,authorization:grant',
    }).toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tink client token fout [${res.status}]: ${err.slice(0, 200)}`)
  }
  const json = await res.json()
  return json.access_token
}

// Exchange authorization code (from redirect) for user access token
export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token?: string }> {
  const { client_id, client_secret } = await getCredentials()
  const res = await fetch(`${TINK_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      client_id,
      client_secret,
      code,
    }).toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tink code exchange fout [${res.status}]: ${err.slice(0, 200)}`)
  }
  return res.json()
}

// Refresh user access token
export async function refreshToken(refresh_token: string): Promise<{ access_token: string; refresh_token?: string }> {
  const { client_id, client_secret } = await getCredentials()
  const res = await fetch(`${TINK_API}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id,
      client_secret,
      refresh_token,
    }).toString(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tink refresh fout [${res.status}]: ${err.slice(0, 200)}`)
  }
  return res.json()
}

// Get stored user access token (refresh if expired)
async function getUserToken(connectionId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data: conn } = await supabase
    .from('personal_bank_connections')
    .select('*')
    .eq('id', connectionId)
    .single()

  if (!conn) throw new Error('Verbinding niet gevonden')

  const now = new Date()
  if (conn.access_token && conn.access_expires_at && new Date(conn.access_expires_at) > now) {
    return conn.access_token
  }

  if (conn.refresh_token) {
    const tokens = await refreshToken(conn.refresh_token)
    const expires = new Date(Date.now() + 29 * 60 * 1000) // 29 min buffer
    await supabase.from('personal_bank_connections').update({
      access_token:      tokens.access_token,
      refresh_token:     tokens.refresh_token ?? conn.refresh_token,
      access_expires_at: expires.toISOString(),
      updated_at:        now.toISOString(),
    }).eq('id', connectionId)
    return tokens.access_token
  }

  throw new Error('Sessie verlopen — verbind ING opnieuw')
}

async function tinkFetch<T>(path: string, userToken: string): Promise<T> {
  const res = await fetch(`${TINK_API}${path}`, {
    headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
    next: { revalidate: 0 },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tink API [${res.status}]: ${err.slice(0, 300)}`)
  }
  return res.json()
}

// ── Publieke functies ─────────────────────────────────────────────────────────

export async function saveCredentials(clientId: string, clientSecret: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('personal_bank_credentials').upsert({
    provider:   'tink',
    secret_id:  clientId,
    secret_key: clientSecret,
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

// Generates the Tink Link URL for user authorization (ING NL)
export async function createIngAuthUrl(redirectUri: string): Promise<string> {
  const { client_id } = await getCredentials()
  const params = new URLSearchParams({
    client_id,
    redirect_uri:     redirectUri,
    market:           'NL',
    locale:           'nl_NL',
    scope:            'accounts:read,balances:read,transactions:read',
    input_provider:   'nl-ing-ob-aispsd2',  // ING NL provider
  })
  return `${TINK_LINK}/transactions/connect-accounts?${params.toString()}`
}

// Complete the connection after user is redirected back with code
export async function completeConnection(code: string): Promise<string> {
  const tokens = await exchangeCode(code)
  const supabase = createAdminClient()
  const expires = new Date(Date.now() + 29 * 60 * 1000)

  const { data, error } = await supabase
    .from('personal_bank_connections')
    .insert({
      bank_id:           'ING_INGBNL2A',
      bank_name:         'ING',
      status:            'pending',
      access_token:      tokens.access_token,
      refresh_token:     tokens.refresh_token ?? null,
      access_expires_at: expires.toISOString(),
    })
    .select('id')
    .single()

  if (error || !data) throw new Error('Kon verbinding niet opslaan')
  return data.id
}

export async function getAccounts(connectionId: string): Promise<TinkAccount[]> {
  const token = await getUserToken(connectionId)
  const res = await tinkFetch<{ accounts: TinkAccount[] }>('/accounts/list', token)
  return res.accounts ?? []
}

export async function getTransactions(
  connectionId: string,
  accountId?: string,
  dateFrom?: string,
): Promise<TinkTransaction[]> {
  const token = await getUserToken(connectionId)
  const params = new URLSearchParams()
  if (accountId) params.set('accountIdIn', accountId)
  if (dateFrom)  params.set('bookedDateGte', dateFrom)
  params.set('pageSize', '1000')

  const res = await tinkFetch<{ transactions: TinkTransaction[]; nextPageToken?: string }>(
    `/transactions/list${params.size ? `?${params.toString()}` : ''}`,
    token,
  )
  return res.transactions ?? []
}

// Convert Tink unscaledValue/scale to decimal amount
export function tinkAmount(val: { scale: number; unscaledValue: number }): number {
  return val.unscaledValue / Math.pow(10, val.scale)
}

export async function testCredentials(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getClientToken()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Onbekende fout' }
  }
}

// Update connection with IBAN after accounts are fetched
export async function updateConnectionIban(connectionId: string, iban: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('personal_bank_connections').update({
    iban,
    status:     'active',
    updated_at: new Date().toISOString(),
  }).eq('id', connectionId)
}
