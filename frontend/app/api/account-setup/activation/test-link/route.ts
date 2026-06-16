import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Onboarding stap 4 — TEST LINK. Eenmalige check van één referral-URL (geen crawler):
 * geldige URL? redirect? affiliate-tag aanwezig? bereikbaar (link-health)? Direct resultaat.
 */
export const revalidate = 0
export const maxDuration = 30

const TIMEOUT_MS = 8000
const UA = 'Mozilla/5.0 (compatible; HermesLinkTest/1.0)'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const url = String(body.url ?? '').trim()
  const tag = String(body.tag ?? '').trim()

  // 1) URL geldig?
  let parsed: URL | null = null
  try { parsed = new URL(url) } catch { parsed = null }
  const urlValid = Boolean(parsed && (parsed.protocol === 'http:' || parsed.protocol === 'https:'))
  if (!urlValid) {
    return NextResponse.json({ ok: false, url_valid: false, tag_present: false, redirect_works: false, health: 'invalid_url', message: 'Geen geldige http(s)-URL' })
  }

  // 2) Affiliate-tag aanwezig in de URL?
  const tagPresent = tag.length > 0 && url.toLowerCase().includes(tag.toLowerCase())

  // 3) Bereikbaarheid + redirect (eenmalige fetch, HEAD→GET fallback)
  let health = 'error'; let httpStatus: number | null = null; let redirected = false; let finalUrl: string | null = null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': UA } })
    if ([403, 405, 501].includes(res.status)) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': UA } })
    }
    httpStatus = res.status
    finalUrl = res.url || null
    redirected = Boolean(res.redirected) || (res.url ? res.url !== url : false)
    health = res.status >= 200 && res.status < 400 ? 'ok' : 'broken'
  } catch (e) {
    health = (e as Error).name === 'AbortError' ? 'timeout' : 'error'
  } finally {
    clearTimeout(timer)
  }

  const ok = urlValid && health === 'ok' && tagPresent
  return NextResponse.json({
    ok, url_valid: urlValid, tag_present: tagPresent, redirect_works: redirected,
    health, http_status: httpStatus, final_url: finalUrl,
    message: ok ? 'Link werkt en bevat de affiliate-tag' :
      (!tagPresent ? 'Affiliate-tag niet in URL gevonden' : health !== 'ok' ? `Link onbereikbaar (${health})` : 'Controleer de link'),
  })
}
