/**
 * Eenmalig Gmail-account koppelen aan de Mail Agent.
 *
 * Doet de Google OAuth-consent (loopback-redirect), haalt een refresh-token op
 * met scope gmail.modify (lezen + labels beheren) en schrijft het account naar
 * `mail_accounts` (provider=gmail). Daarna kan de Mail Agent labels aanmaken en
 * mail syncen.
 *
 * Vereist (lokaal in mail-engine/.env of als env):
 *   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET   (Google Cloud OAuth-client, type "Desktop")
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Gebruik:
 *   cd mail-engine && npx ts-node src/scripts/gmail-auth.ts
 *   → open de geprinte URL, log in als o.amatiskak@gmail.com, sta toe.
 */
import 'dotenv/config'
import http from 'http'
import { URL } from 'url'
import { google } from 'googleapis'
import { supabase } from '../lib/supabase'

const CLIENT_ID = process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
const PORT = parseInt(process.env.GMAIL_AUTH_PORT ?? '53682', 10)
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Ontbreekt: GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET (Google Cloud OAuth-client, type "Desktop").')
  process.exit(1)
}
if (!process.env.SUPABASE_URL || !(process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY)) {
  console.error('Ontbreekt: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

/** mail_accounts.user_id is NOT NULL → eigenaar via env of de (enige) auth-user. */
async function resolveUserId(): Promise<string> {
  if (process.env.MAIL_ACCOUNT_USER_ID) return process.env.MAIL_ACCOUNT_USER_ID
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error || !data?.users?.length) {
    throw new Error('Geen auth-user gevonden voor mail_accounts.user_id; zet MAIL_ACCOUNT_USER_ID in .env.')
  }
  return data.users[0].id
}

async function upsertAccount(tokens: { access_token: string; refresh_token: string; expiry: string }, email: string, displayName: string | null) {
  const userId = await resolveUserId()
  // E-mail is uniek over alle providers → match op e-mail, niet op provider.
  const { data: existing } = await supabase
    .from('mail_accounts').select('id, user_id, provider').eq('email', email).maybeSingle()

  const tokenFields = {
    gmail_access_token: tokens.access_token,
    gmail_refresh_token: tokens.refresh_token,
    gmail_token_expiry: tokens.expiry,
  }

  if (existing) {
    const e = existing as { id: string; user_id: string | null; provider: string }
    // Bestaande rij (bv. imap) verrijken met Gmail-OAuth-tokens; provider laten
    // staan zodat de mail-intake ongewijzigd blijft.
    const { error } = await supabase
      .from('mail_accounts')
      .update({ ...tokenFields, user_id: e.user_id ?? userId })
      .eq('id', e.id)
    if (error) throw new Error(error.message)
    return { mode: `updated (provider=${e.provider})`, id: e.id }
  }

  const { data, error } = await supabase.from('mail_accounts').insert({
    user_id: userId, provider: 'gmail', email, display_name: displayName, ...tokenFields, sync_status: 'idle',
  }).select('id').single()
  if (error) throw new Error(error.message)
  return { mode: 'created', id: (data as { id: string }).id }
}

function main() {
  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forceer refresh_token, ook bij her-autorisatie
    scope: SCOPES,
  })

  const server = http.createServer(async (req, res) => {
    if (!req.url || !req.url.startsWith('/oauth2callback')) {
      res.writeHead(404); res.end('niet gevonden'); return
    }
    const code = new URL(req.url, REDIRECT_URI).searchParams.get('code')
    if (!code) { res.writeHead(400); res.end('geen code'); return }

    try {
      const { tokens } = await oauth2.getToken(code)
      if (!tokens.refresh_token) throw new Error('Geen refresh_token ontvangen — herroep de app-toegang in je Google-account en probeer opnieuw (prompt=consent).')
      oauth2.setCredentials(tokens)

      const profile = await google.gmail({ version: 'v1', auth: oauth2 }).users.getProfile({ userId: 'me' })
      const email = profile.data.emailAddress ?? 'onbekend'

      const result = await upsertAccount({
        access_token: tokens.access_token ?? '',
        refresh_token: tokens.refresh_token,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : new Date(Date.now() + 3600_000).toISOString(),
      }, email, email)

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<h2>✅ Gekoppeld: ${email}</h2><p>mail_accounts ${result.mode} (id ${result.id}). Je kunt dit tabblad sluiten.</p>`)
      console.log(`\n✅ Gmail-account gekoppeld: ${email} (mail_accounts ${result.mode}, id ${result.id})`)
      console.log('De Mail Agent kan nu labels aanmaken + mail syncen.')
      setTimeout(() => { server.close(); process.exit(0) }, 500)
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end(`Fout: ${(e as Error).message}`)
      console.error('OAuth-fout:', (e as Error).message)
      setTimeout(() => { server.close(); process.exit(1) }, 500)
    }
  })

  server.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('  Gmail koppelen aan de Mail Agent')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Redirect: ${REDIRECT_URI}  (registreer dit als toegestane redirect in je OAuth-client)`)
    console.log('\nOpen deze URL in je browser, log in als o.amatiskak@gmail.com en sta toegang toe:\n')
    console.log(authUrl)
    console.log('\nWachten op autorisatie…')
  })
}

main()
