import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

const SETTABLE = [
  'external_account_id', 'external_account_name', 'profile_url',
  'client_id', 'client_secret', 'redirect_uri', 'scopes',
  'access_token', 'refresh_token', 'expires_at', 'status', 'last_error', 'meta',
]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of SETTABLE) if (k in body) update[k] = body[k]

  const admin = createAdminClient()
  const { error } = await admin.from('social_connections').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Ontkoppelen: tokens/secrets wissen, status terug naar disconnected.
// ?hard=1 verwijdert de rij volledig.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const admin = createAdminClient()

  if (req.nextUrl.searchParams.get('hard') === '1') {
    const { error } = await admin.from('social_connections').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, removed: true })
  }

  const { error } = await admin.from('social_connections').update({
    access_token: null, refresh_token: null, oauth_state: null,
    expires_at: null, status: 'disconnected', last_error: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, disconnected: true })
}
