import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

// Veilige projectie: nooit secrets/tokens naar de client. Alleen booleans.
const SAFE_COLUMNS =
  'id, platform, company, account_label, external_account_id, external_account_name, profile_url, redirect_uri, scopes, status, last_error, last_synced_at, expires_at, created_at, updated_at'

type Row = {
  id: string
  client_secret?: string | null
  access_token?: string | null
  [k: string]: unknown
}

function redact(rows: Row[]) {
  return rows.map(r => ({
    ...r,
    has_credentials: Boolean(r.client_id && r.client_secret),
    has_token:       Boolean(r.access_token),
    client_id:       undefined,
    client_secret:   undefined,
    access_token:    undefined,
    refresh_token:   undefined,
    oauth_state:     undefined,
  }))
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin   = createAdminClient()
  const company = req.nextUrl.searchParams.get('company') ?? ''

  let q = admin
    .from('social_connections')
    .select(`${SAFE_COLUMNS}, client_id, client_secret, access_token`)
    .order('platform', { ascending: true })
  if (company) q = q.eq('company', company)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ connections: redact((data ?? []) as Row[]) })
}

// Maakt/updatet een koppeling op (platform, company, account_label).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const platform = String(body.platform ?? '').toLowerCase()
  const valid = ['linkedin', 'facebook', 'instagram', 'tiktok', 'x', 'youtube']
  if (!valid.includes(platform)) {
    return NextResponse.json({ error: `platform moet één van: ${valid.join(', ')}` }, { status: 400 })
  }

  const company = body.company || 'modiwe-software'
  const label   = body.account_label || 'Aquier'
  const origin  = req.nextUrl.origin

  const patch: Record<string, unknown> = {
    platform, company, account_label: label,
    updated_at: new Date().toISOString(),
  }
  // Alleen meegegeven velden bijwerken (secrets optioneel).
  for (const k of ['external_account_id', 'external_account_name', 'profile_url',
                   'client_id', 'client_secret', 'redirect_uri', 'access_token',
                   'refresh_token', 'scopes', 'meta'] as const) {
    if (k in body && body[k] !== undefined) patch[k] = body[k]
  }
  if (!patch.redirect_uri) {
    patch.redirect_uri = `${origin}/api/social/oauth/${platform}/callback`
  }
  // Statuslogica: token aanwezig → connected; alleen app-creds → configured.
  if (body.access_token)          patch.status = 'connected'
  else if (body.client_id)        patch.status = 'configured'
  patch.last_error = null

  const admin = createAdminClient()
  const { error } = await admin
    .from('social_connections')
    .upsert(patch, { onConflict: 'platform,company,account_label' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true }, { status: 201 })
}
