import axios, { AxiosError } from 'axios'
import { env } from '../lib/secrets'
import { logger } from '../lib/logger'
import type { CountrySpec, DiscoverySnapshot } from '../types'

type ProbeResult = {
  url: string
  status: number | null
  final_url: string
  was_redirected: boolean
  body_excerpt: string
  load_ms: number
  accessibility: DiscoverySnapshot['accessibility']
  notes: string | null
}

/**
 * Probes a single (country, route_path) combo via HEAD then GET fallback.
 * Determines accessibility + redirect behaviour.
 */
export async function probeRoute(country: CountrySpec, routePath: string): Promise<ProbeResult> {
  const url = new URL(routePath, env.AQUIER_BASE_URL).toString()
  const acceptLanguage = country.locale_default
  const start = Date.now()

  try {
    const response = await axios.get(url, {
      headers: { 'Accept-Language': acceptLanguage, 'User-Agent': 'AquierCheckoutAuditor/1.0' },
      maxRedirects: 5,
      validateStatus: () => true,
      timeout: 12_000,
    })
    const loadMs = Date.now() - start
    const finalUrl = response.request?.res?.responseUrl ?? url
    const wasRedirected = finalUrl !== url
    const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
    // 250KB excerpt — Next.js SSR/RSC payload includes tier+price data in initial HTML stream;
    // 5KB cutoff was below the RSC chunk boundary so tier detection saw nothing
    const bodyExcerpt = body.slice(0, 250_000)

    let accessibility: DiscoverySnapshot['accessibility'] = 'ok'
    if (response.status === 404) accessibility = 'not_found'
    else if (response.status >= 400 && response.status < 500) accessibility = 'blocked'
    else if (response.status >= 500) accessibility = 'error'
    else if (wasRedirected) accessibility = 'redirected'

    return {
      url,
      status: response.status,
      final_url: finalUrl,
      was_redirected: wasRedirected,
      body_excerpt: bodyExcerpt,
      load_ms: loadMs,
      accessibility,
      notes: wasRedirected ? `Redirected to ${finalUrl}` : null,
    }
  } catch (err) {
    const loadMs = Date.now() - start
    const axiosErr = err as AxiosError
    const isTimeout = axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT'
    logger.warn({ url, err: axiosErr.message, code: axiosErr.code }, 'probe failed')
    return {
      url,
      status: null,
      final_url: url,
      was_redirected: false,
      body_excerpt: '',
      load_ms: loadMs,
      accessibility: isTimeout ? 'timeout' : 'error',
      notes: axiosErr.message,
    }
  }
}

/**
 * Determines the most-likely locale routing strategy by probing all candidates for a country.
 * Returns the first prefix that responds with 200 and contains country-locale-ish content.
 */
export async function detectRouteStrategy(country: CountrySpec): Promise<{
  routing_strategy: DiscoverySnapshot['routing_strategy']
  best_route_path: string
  best_probe: ProbeResult
  all_probes: Array<{ path: string; probe: ProbeResult }>
  country_route_works: boolean
}> {
  const probes: Array<{ path: string; probe: ProbeResult }> = []
  // Always include plain /membership as final fallback — many sites serve via Accept-Language only
  const candidates = [...country.route_prefix_candidates, '']
  for (const candidate of candidates) {
    const path = candidate.endsWith('/membership') ? candidate : `${candidate}/membership`.replace(/\/+/g, '/')
    if (probes.some(p => p.path === path)) continue // dedupe
    const probe = await probeRoute(country, path)
    probes.push({ path, probe })
    if (probe.status === 200 && !probe.was_redirected) {
      const usedFallback = candidate === '' || candidate === '/'
      return {
        routing_strategy: usedFallback ? 'accept_language' : 'path',
        country_route_works: !usedFallback, // true only if country-specific prefix works
        best_route_path: path,
        best_probe: probe,
        all_probes: probes,
      }
    }
  }
  // Fallback: pick the highest-status probe
  const best = probes.sort((a, b) => (b.probe.status ?? 0) - (a.probe.status ?? 0))[0]
  return {
    routing_strategy: best?.probe.was_redirected ? 'cookie' : 'unknown',
    country_route_works: false,
    best_route_path: best?.path ?? '/membership',
    best_probe: best?.probe ?? probes[0]!.probe,
    all_probes: probes,
  }
}
