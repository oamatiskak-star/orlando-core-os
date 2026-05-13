import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ING Open Banking API — register at: https://developer.ing.com
// Requires: Client ID + Client Secret from ING Developer Portal
export async function POST(request: NextRequest) {
  const { clientId, clientSecret, iban } = await request.json() as {
    clientId: string
    clientSecret: string
    iban?: string
  }

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Client ID en Client Secret zijn vereist' }, { status: 400 })
  }

  const supabase = createAdminClient()
  await supabase.from('integration_connections').upsert({
    type:         'ing',
    api_key:      clientId,
    status:       'connected',
    connected_at: new Date().toISOString(),
    updated_at:   new Date().toISOString(),
    metadata:     {
      client_id:     clientId,
      client_secret: clientSecret,
      iban:          iban ?? null,
      note:          'ING Open Banking — verificatie bij eerste API-aanroep',
    },
  }, { onConflict: 'type' })

  return NextResponse.json({ ok: true })
}
