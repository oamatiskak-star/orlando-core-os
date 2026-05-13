import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Fetch all channels that have a refresh token and are connected or expired
  const { data: channels } = await admin
    .from('youtube_channels')
    .select('id, naam, refresh_token, token_expires, oauth_status, oauth_client_id, oauth_client_secret')
    .in('oauth_status', ['connected', 'expired'])
    .not('refresh_token', 'is', null)

  if (!channels?.length) {
    return NextResponse.json({ message: 'No channels to refresh', refreshed: 0 })
  }

  const results: { naam: string; status: string }[] = []

  for (const ch of channels) {
    // Only refresh if token expires within 10 minutes or is already expired
    const expires = ch.token_expires ? new Date(ch.token_expires) : new Date(0)
    const needsRefresh = expires < new Date(Date.now() + 10 * 60 * 1000)

    if (!needsRefresh) {
      results.push({ naam: ch.naam, status: 'skipped_still_valid' })
      continue
    }

    try {
      const clientId     = (ch as any).oauth_client_id     ?? process.env.YOUTUBE_CLIENT_ID!
      const clientSecret = (ch as any).oauth_client_secret ?? process.env.YOUTUBE_CLIENT_SECRET!

      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id:     clientId,
          client_secret: clientSecret,
          refresh_token: ch.refresh_token!,
          grant_type:    'refresh_token',
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // Mark as needing reconnect only on invalid_grant (refresh token revoked)
        if (err.error === 'invalid_grant') {
          await admin.from('youtube_channels')
            .update({ oauth_status: 'revoked' })
            .eq('id', ch.id)
          results.push({ naam: ch.naam, status: 'revoked' })
        } else {
          results.push({ naam: ch.naam, status: `error: ${err.error ?? res.status}` })
        }
        continue
      }

      const { access_token, expires_in } = await res.json()
      const token_expires = new Date(Date.now() + (expires_in ?? 3600) * 1000).toISOString()

      await admin.from('youtube_channels').update({
        access_token,
        token_expires,
        oauth_status: 'connected',
        status: 'active',
      }).eq('id', ch.id)

      results.push({ naam: ch.naam, status: 'refreshed' })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ naam: ch.naam, status: `exception: ${msg}` })
    }
  }

  const refreshed = results.filter(r => r.status === 'refreshed').length
  const revoked   = results.filter(r => r.status === 'revoked').length

  console.log(`Token cron: ${refreshed} refreshed, ${revoked} revoked`, results)

  return NextResponse.json({ refreshed, revoked, results })
}
