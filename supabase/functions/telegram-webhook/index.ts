import { createClient } from 'jsr:@supabase/supabase-js@2'

// Hermes Telegram-webhook: ontvangt updates van Telegram en zet ze via een
// SECURITY DEFINER RPC in hermes.telegram_inbox. Auth = Telegram secret_token
// (X-Telegram-Bot-Api-Secret-Token) vergeleken met hermes_config.webhook_secret.
// Bron-tagging: ?src=<bot> in de webhook-URL wordt opgeslagen als source_bot,
// zodat Hermes weet via welke bot (welk systeem) het bericht binnenkwam.
//
// Webhooks (alle 3 bots → deze functie, per bot een eigen ?src=):
//   os_vastgoed  (Hermes uitgaand naar Orlando, 2-weg)
//   orlando_os   (Orlando Core OS / systeem)
//   yt_agent     (Media Holding / YouTube)
Deno.serve(async (req: Request) => {
  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data: cfg } = await sb.from('hermes_config').select('value').eq('key', 'webhook_secret').single()
  const expected = cfg?.value
  const got = req.headers.get('x-telegram-bot-api-secret-token')
  if (!expected || got !== expected) {
    return new Response('forbidden', { status: 403 })
  }
  const src = new URL(req.url).searchParams.get('src')
  let update: unknown
  try {
    update = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }
  const { error } = await sb.rpc('ingest_telegram_update', { p_update: update, p_source: src })
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
