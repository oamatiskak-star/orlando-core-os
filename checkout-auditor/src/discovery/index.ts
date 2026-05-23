import { loadCountries, loadTiers } from '../specs'
import { detectRouteStrategy, probeRoute } from './route-prober'
import { detectTiersInHtml } from './tier-availability'
import { supabase } from '../lib/supabase'
import { uploadArtifact, buildArtifactPath } from '../lib/storage'
import { logger } from '../lib/logger'
import type { DiscoverySnapshot } from '../types'

/**
 * Runs discovery for one country: detects routing strategy, probes /membership,
 * extracts visible tiers + pricing, stores snapshot + HTML artifact in DB.
 */
export async function discoverCountry(runId: string, countryCode: string): Promise<DiscoverySnapshot> {
  const country = loadCountries().find(c => c.code === countryCode)
  if (!country) throw new Error(`Unknown country code: ${countryCode}`)

  const tiers = loadTiers()
  const detection = await detectRouteStrategy(country)
  const html = detection.best_probe.body_excerpt
  const { tier_codes_visible, pricing_observed } = detectTiersInHtml(html, tiers)

  // Store HTML snapshot
  let snapshotArtifactId: string | null = null
  if (html.length > 0) {
    const path = buildArtifactPath(runId, null, `discovery-html-${countryCode}`, 'html')
    try {
      await uploadArtifact(path, html, 'text/html')
      const { data: artifactRow } = await supabase
        .from('aquier_audit_artifacts')
        .insert({
          run_id: runId,
          kind: 'dom_snapshot',
          storage_path: path,
          size_bytes: Buffer.byteLength(html),
          mime_type: 'text/html',
        })
        .select('id')
        .single()
      snapshotArtifactId = artifactRow?.id ?? null
    } catch (err) {
      logger.warn({ err: String(err), country: countryCode }, 'snapshot upload failed')
    }
  }

  const snapshot: DiscoverySnapshot = {
    country_code: countryCode,
    locale_resolved: country.locale_default,
    routing_strategy: detection.routing_strategy,
    route_path: detection.best_route_path,
    http_status: detection.best_probe.status,
    accessibility: detection.best_probe.accessibility,
    tier_codes_visible,
    pricing_observed,
    snapshot_html_artifact_id: snapshotArtifactId,
    notes: detection.best_probe.notes,
  }

  // Persist
  await supabase.from('aquier_audit_discovery_snapshots').insert({
    run_id: runId,
    country_code: snapshot.country_code,
    locale_resolved: snapshot.locale_resolved,
    routing_strategy: snapshot.routing_strategy,
    route_path: snapshot.route_path,
    http_status: snapshot.http_status,
    accessibility: snapshot.accessibility,
    tier_codes_visible: snapshot.tier_codes_visible,
    pricing_observed: snapshot.pricing_observed,
    snapshot_html_artifact_id: snapshot.snapshot_html_artifact_id,
    notes: snapshot.notes,
  })

  logger.info({
    country: countryCode,
    routing: snapshot.routing_strategy,
    route: snapshot.route_path,
    status: snapshot.http_status,
    accessibility: snapshot.accessibility,
    tiers_seen: tier_codes_visible.length,
  }, 'discovery completed for country')

  return snapshot
}

/**
 * Run discovery across all countries (or scope subset). Sequential to be polite to aquier.com.
 */
export async function runDiscovery(runId: string, countryCodes?: string[]): Promise<DiscoverySnapshot[]> {
  const allCountries = loadCountries()
  const targets = countryCodes?.length
    ? allCountries.filter(c => countryCodes.includes(c.code))
    : allCountries
  const results: DiscoverySnapshot[] = []
  for (const country of targets) {
    try {
      const snap = await discoverCountry(runId, country.code)
      results.push(snap)
    } catch (err) {
      logger.error({ err: String(err), country: country.code }, 'discovery failed for country')
    }
  }
  return results
}
