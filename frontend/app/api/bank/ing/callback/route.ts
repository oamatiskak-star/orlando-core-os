import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCustomerToken, getAccounts } from '@/lib/ing/client'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')

  if (!code) {
    return NextResponse.redirect(new URL('/mobile/finance?error=no_code', req.url))
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const redirectUri = `${req.nextUrl.origin}/api/bank/ing/callback`
    const tokens = await getCustomerToken(code, redirectUri) as { access_token: string; refresh_token?: string; expires_in?: number }

    if (!tokens.access_token) {
      throw new Error('Geen access token ontvangen')
    }

    // Haal accounts op
    const accounts = await getAccounts(tokens.access_token) as Array<{
      resourceId: string
      iban?: string
      currency?: string
      name?: string
      product?: string
    }>

    const iban = accounts[0]?.iban ?? null

    // Sla verbinding op
    await supabase.from('personal_bank_connections').upsert({
      bank_id:   'ING',
      bank_name: 'ING',
      iban,
      status:    'active',
      raw_data: {
        access_token:  tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at:    tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
        accounts,
      },
    }, { onConflict: 'bank_id' })

    return NextResponse.redirect(new URL('/mobile/finance?connected=ING', req.url))
  } catch (err) {
    console.error('ING callback error:', err)
    return NextResponse.redirect(new URL(`/mobile/finance?error=${encodeURIComponent(String(err))}`, req.url))
  }
}
