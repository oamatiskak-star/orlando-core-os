import { NextRequest, NextResponse } from 'next/server'

// Register your app at: https://moneybird.com/user/applications
// Redirect URI to add: https://dashboard.strkbeheer.nl/api/integrations/moneybird/callback

const SCOPES = [
  'sales_invoices',
  'documents',
  'payments',
  'contacts',
  'financial_mutations',
  'bank',
  'settings',
].join(' ')

export async function GET(request: NextRequest) {
  const clientId = process.env.MONEYBIRD_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'MONEYBIRD_CLIENT_ID niet geconfigureerd' }, { status: 500 })
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/moneybird/callback`

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES,
  })

  return NextResponse.redirect(`https://moneybird.com/oauth/authorize?${params.toString()}`)
}
