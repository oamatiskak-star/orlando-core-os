import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// bunq API key — generate in bunq app: Profile → Security → API Keys
export async function POST(request: NextRequest) {
  const { apiKey } = await request.json() as { apiKey: string }

  if (!apiKey || apiKey.length < 20) {
    return NextResponse.json({ error: 'Ongeldige API key' }, { status: 400 })
  }

  // Verify the key by calling bunq API
  const verifyRes = await fetch('https://api.bunq.com/v1/user', {
    headers: {
      'X-Bunq-Client-Authentication': apiKey,
      'Cache-Control': 'no-cache',
      'User-Agent': 'OrlandoOS/1.0',
      'X-Bunq-Language': 'nl_NL',
      'X-Bunq-Region': 'nl_NL',
      'X-Bunq-Geolocation': '0 0 0 0 NL',
    },
  })

  const userData = await verifyRes.json().catch(() => null)
  const userName = userData?.Response?.[0]?.UserCompany?.display_name
    ?? userData?.Response?.[0]?.UserPerson?.display_name
    ?? null

  const supabase = createAdminClient()
  await supabase.from('integration_connections').upsert({
    type:         'bunq',
    api_key:      apiKey,
    status:       verifyRes.ok ? 'connected' : 'error',
    connected_at: new Date().toISOString(),
    updated_at:   new Date().toISOString(),
    metadata:     { verified: verifyRes.ok, display_name: userName },
  }, { onConflict: 'type' })

  if (!verifyRes.ok) {
    return NextResponse.json({ error: 'bunq API key ongeldig of geweigerd' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, displayName: userName })
}
