import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
].join(' ')

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clientId = process.env.GMAIL_CLIENT_ID ?? process.env.YOUTUBE_CLIENT_ID
  const appUrl   = process.env.NEXT_PUBLIC_APP_URL

  if (!clientId)  return NextResponse.json({ error: 'GMAIL_CLIENT_ID niet geconfigureerd' }, { status: 500 })
  if (!appUrl)    return NextResponse.json({ error: 'NEXT_PUBLIC_APP_URL niet geconfigureerd' }, { status: 500 })

  const redirectUri = `${appUrl}/api/mail/oauth/callback`

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         SCOPES,
    access_type:   'offline',
    prompt:        'select_account consent',
    state:         user.id,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
