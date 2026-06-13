import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reportHeartbeat } from '@/lib/watchdog/heartbeat'

/**
 * Affiliate link-health crawler (S15, Engine Planner: media:affiliate-link-health).
 *
 * Valideert periodiek bestaande affiliate_links: bereikbaarheid (HTTP-status), redirect en
 * latency. Schrijft de laatste status per link naar affiliate_link_health (upsert) zodat
 * dode/kapotte links zichtbaar worden via v_affiliate_link_health. VOLLEDIG additief, geen
 * externe credentials — direct live. Batcht de minst-recent-gecontroleerde actieve links.
 *
 * Vercel-cron (zie vercel.json, 01:30 UTC binnen het off-peak 'janitor'-blok).
 */
export const revalidate = 0
export const maxDuration = 60

const ENGINE_KEY = 'media:affiliate-link-health'
const BATCH = 30
const TIMEOUT_MS = 8000
const UA = 'Mozilla/5.0 (compatible; HermesLinkHealth/1.0; +https://orlando-core-os)'

type Health = { status: 'ok' | 'broken' | 'error'; http_status: number | null; final_url: string | null; redirected: boolean; latency_ms: number; error: string | null }

async function checkLink(url: string): Promise<Health> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': UA } })
    // Sommige servers staan HEAD niet toe → val terug op GET.
    if ([403, 405, 501].includes(res.status)) {
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal, headers: { 'user-agent': UA } })
    }
    const latency = Date.now() - start
    const http = res.status
    return {
      status: http >= 200 && http < 400 ? 'ok' : 'broken',
      http_status: http,
      final_url: res.url || null,
      redirected: Boolean(res.redirected) || (res.url && res.url !== url) || false,
      latency_ms: latency,
      error: http >= 400 ? `HTTP ${http}` : null,
    }
  } catch (e) {
    return {
      status: 'error', http_status: null, final_url: null, redirected: false,
      latency_ms: Date.now() - start,
      error: (e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message,
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}` && !isDev) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const force = req.nextUrl.searchParams.get('force') === '1'
  const counts = { checked: 0, ok: 0, broken: 0, error: 0 }

  try {
    if (!isDev && !force) {
      const { data: open } = await admin.rpc('engine_window_open', { p_engine_key: ENGINE_KEY })
      if (open === false) {
        await reportHeartbeat('affiliate-link-health', { skipped: 'window_closed' }, 'ok')
        return NextResponse.json({ ok: true, skipped: 'window_closed' })
      }
    }

    // Minst-recent-gecontroleerde actieve links eerst (nulls = nog nooit gecheckt).
    const { data: links, error } = await admin
      .from('v_affiliate_link_health')
      .select('link_id, url')
      .eq('active', true)
      .order('checked_at', { ascending: true, nullsFirst: true })
      .limit(BATCH)
    if (error) throw new Error(error.message)

    const now = new Date().toISOString()
    for (const l of (links ?? []) as { link_id: string; url: string }[]) {
      if (!l.url) continue
      const h = await checkLink(l.url)
      counts.checked++
      counts[h.status]++
      await admin.from('affiliate_link_health').upsert({
        link_id: l.link_id, status: h.status, http_status: h.http_status, final_url: h.final_url,
        redirected: h.redirected, latency_ms: h.latency_ms, error: h.error, checked_at: now, updated_at: now,
      }, { onConflict: 'link_id' })
    }

    await reportHeartbeat('affiliate-link-health', counts, 'ok')
    return NextResponse.json({ ok: true, counts })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await reportHeartbeat('affiliate-link-health', { error: msg }, 'error')
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
