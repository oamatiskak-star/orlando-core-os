import { NextRequest, NextResponse } from 'next/server'
import {
  saveCredentials,
  hasCredentials,
  createIngAuthUrl,
  testCredentials,
  completeConnection,
  updateConnectionIban,
  getAccounts,
  tinkAmount,
} from '@/lib/bank/tink'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — status van de bank koppeling
export async function GET() {
  const supabase = createAdminClient()

  const [hasCreds, { data: connections }] = await Promise.all([
    hasCredentials(),
    supabase
      .from('personal_bank_connections')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    has_credentials: hasCreds,
    connections:     connections ?? [],
    provider:        'tink',
  })
}

// POST — acties: save_credentials | connect_ing | complete_auth | fetch_accounts
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const action: string = body.action ?? 'save_credentials'

  try {
    // Sla Tink client_id + client_secret op
    if (action === 'save_credentials') {
      if (!body.client_id || !body.client_secret) {
        return NextResponse.json({ error: 'client_id en client_secret vereist' }, { status: 400 })
      }
      await saveCredentials(body.client_id, body.client_secret)
      const test = await testCredentials()
      return NextResponse.json({ ok: test.ok, error: test.error })
    }

    // Genereer Tink Link autorisatie-URL voor ING
    if (action === 'connect_ing') {
      const baseUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dashboard.strkbeheer.nl'
      const redirectUri = body.redirect_url ?? `${baseUrl}/dashboard/dyme/bank-callback`
      const authUrl    = await createIngAuthUrl(redirectUri)
      return NextResponse.json({ ok: true, link: authUrl })
    }

    // Verwerk de Tink redirect (code uitwisselen voor tokens)
    if (action === 'complete_auth') {
      if (!body.code) {
        return NextResponse.json({ error: 'code vereist' }, { status: 400 })
      }
      const connectionId = await completeConnection(body.code)
      // Probeer direct accounts op te halen om IBAN te registreren
      try {
        const accounts = await getAccounts(connectionId)
        if (accounts.length > 0) {
          const iban = accounts[0].identifiers?.iban?.iban ?? null
          if (iban) await updateConnectionIban(connectionId, iban)
        }
      } catch { /* IBAN kan later worden opgehaald */ }
      return NextResponse.json({ ok: true, connection_id: connectionId })
    }

    // Haal accounts op voor bestaande verbinding
    if (action === 'fetch_accounts') {
      if (!body.connection_id) {
        return NextResponse.json({ error: 'connection_id vereist' }, { status: 400 })
      }
      const accounts = await getAccounts(body.connection_id)
      const parsed = accounts.map(a => ({
        id:       a.id,
        name:     a.name,
        type:     a.type,
        iban:     a.identifiers?.iban?.iban ?? null,
        balance:  a.balances?.booked?.amount?.value ? tinkAmount(a.balances.booked.amount.value) : null,
        currency: a.balances?.booked?.amount?.currencyCode ?? 'EUR',
      }))
      return NextResponse.json({ ok: true, accounts: parsed })
    }

    return NextResponse.json({ error: 'Onbekende actie' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
