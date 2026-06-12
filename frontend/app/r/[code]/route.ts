import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

// S4 — Affiliate short-link redirect: /r/<code>
// Resolveert short_code → logt de klik met attributie (link/kanaal/video) → 302 naar de
// affiliate-URL. Publiek. Faalt NOOIT de redirect af op een logfout (klik-logging is best-effort).
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('affiliate_links')
    .select('id, url, channel_id, content_item_id, active')
    .eq('short_code', code)
    .maybeSingle()

  if (!link || !link.url || link.active === false) {
    return NextResponse.redirect(new URL('/', req.url), 302)
  }

  // klik loggen — best-effort, mag de redirect nooit blokkeren
  try {
    await admin.from('affiliate_clicks').insert({
      link_id:         link.id,
      content_item_id: link.content_item_id ?? null,
      channel_id:      link.channel_id ?? null,
      source_platform: 'redirect',
      referrer:        req.headers.get('referer') ?? null,
      country_code:    req.headers.get('x-vercel-ip-country') ?? null,
    })
  } catch {
    /* slik logfout in — gebruiker moet altijd doorgestuurd worden */
  }

  return NextResponse.redirect(link.url, 302)
}
