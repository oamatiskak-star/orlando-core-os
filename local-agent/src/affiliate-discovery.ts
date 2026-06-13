/**
 * Affiliate Discovery — continue, config-gedreven crawler over affiliate_api_connectors.
 *
 * Doel: nieuwe affiliate-programma's ontdekken bij netwerken (Impact/Awin/PartnerStack/
 * Rewardful/…) en importeren in affiliate_programs, met een audittrail in affiliate_import_runs.
 * (affiliate_import_runs was 0 → de discovery draaide nooit.)
 *
 * GEEN hardcoded netwerk-endpoints/mock: de crawler is GENERIEK en wordt aangestuurd door
 * affiliate_api_connectors (provider, base_url, auth_type, credential_env, config). De
 * provider-specifieke responsevorm staat in connector.config (list_path, result_path, field_map).
 * Ontbreekt de credential (env via credential_env) → de connector wordt overgeslagen met een
 * gelogde reden (rows_received=0), nooit verzonnen data.
 *
 * Engine Planner = single source of truth: draait alleen wanneer venster 'affiliate:discovery'
 * open is (mig 213, blok 'acq_ai'). Fail-open als de RPC faalt.
 *
 * Draaien (runtime, CLI-L lane L3): AFFILIATE_DISCOVERY_RUN=1 node dist/affiliate-discovery.js
 * Loop: AFFILIATE_DISCOVERY_LOOP=1 (interval AFFILIATE_DISCOVERY_INTERVAL_MS, standaard 6u).
 */
import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import axios from 'axios'

const ENGINE_KEY = 'affiliate:discovery'
const LOOP = process.env.AFFILIATE_DISCOVERY_LOOP === '1'
const INTERVAL_MS = Number(process.env.AFFILIATE_DISCOVERY_INTERVAL_MS) || 6 * 60 * 60 * 1000
const log = (...a: unknown[]) => console.log('[affiliate-discovery]', ...a)

type Connector = {
  id: string
  provider: string
  base_url: string | null
  auth_type: string | null         // bearer | header | query | none
  credential_env: string | null
  config: {
    list_path?: string             // suffix op base_url voor de programma-lijst
    result_path?: string           // dot-pad naar de array in de response (bv. "data.programs")
    field_map?: Record<string, string> // doelveld -> bron-pad (name/category/url/payout_model/avg_epc/recurring)
    auth_header?: string           // header-naam bij auth_type='header' (default Authorization)
    query_param?: string           // query-naam bij auth_type='query' (default api_key)
    extra_params?: Record<string, string>
  } | null
}

function db(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function engineWindowOpen(client: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await client.rpc('engine_window_open', { p_engine_key: ENGINE_KEY })
    if (error) { log(`engine_window_open RPC fout (${error.message}) — fail-open`); return true }
    return data !== false
  } catch (e) { log(`engine_window_open exception (${String((e as Error).message ?? e)}) — fail-open`); return true }
}

/** dot-pad uit een object halen ("data.programs" → obj.data.programs). */
function pluck(obj: unknown, path?: string): unknown {
  if (!path) return obj
  return path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), obj)
}

function mapProgram(raw: Record<string, unknown>, fieldMap: Record<string, string> | undefined, provider: string) {
  const get = (key: string) => (fieldMap?.[key] ? pluck(raw, fieldMap[key]) : raw[key])
  const name = String(get('name') ?? '').trim()
  if (!name) return null
  return {
    name,
    category: get('category') ? String(get('category')) : null,
    url: get('url') ? String(get('url')) : null,
    payout_model: get('payout_model') ? String(get('payout_model')) : null,
    recurring: Boolean(get('recurring') ?? false),
    avg_epc: get('avg_epc') != null ? Number(get('avg_epc')) : null,
    api_available: true,
    media_relevant: true,
    notes: `discovered via ${provider}`,
    metadata: { source: 'affiliate-discovery', provider, raw_keys: Object.keys(raw).slice(0, 20) },
    updated_at: new Date().toISOString(),
  }
}

/** Eén connector afzoeken; retourneert de import-run-telling. Schrijft programma's idempotent. */
async function crawlConnector(client: SupabaseClient, c: Connector) {
  const result = { network: c.provider, source: 'api', rows_received: 0, rows_imported: 0, rows_skipped: 0, detail: {} as Record<string, unknown> }

  const cred = c.credential_env ? process.env[c.credential_env] : undefined
  if (!c.base_url) { result.detail.error = 'no_base_url'; return result }
  if ((c.auth_type ?? 'none') !== 'none' && !cred) {
    result.detail.error = `missing_credential:${c.credential_env ?? '?'}`
    return result
  }

  const cfg = c.config ?? {}
  const url = `${c.base_url}${cfg.list_path ?? ''}`
  const headers: Record<string, string> = { accept: 'application/json' }
  const params: Record<string, string> = { ...(cfg.extra_params ?? {}) }
  if (c.auth_type === 'bearer') headers['authorization'] = `Bearer ${cred}`
  else if (c.auth_type === 'header') headers[cfg.auth_header ?? 'authorization'] = cred!
  else if (c.auth_type === 'query') params[cfg.query_param ?? 'api_key'] = cred!

  try {
    const res = await axios.get(url, { headers, params, timeout: 20_000 })
    const arr = pluck(res.data, cfg.result_path)
    const rows = Array.isArray(arr) ? arr : []
    result.rows_received = rows.length

    const mapped = rows
      .map((r) => mapProgram(r as Record<string, unknown>, cfg.field_map, c.provider))
      .filter((x): x is NonNullable<typeof x> => x !== null)

    for (const prog of mapped) {
      // idempotent op naam (case-insensitive); update bestaande, anders invoegen
      const { data: existing } = await client.from('affiliate_programs')
        .select('id').ilike('name', prog.name).maybeSingle()
      if (existing?.id) {
        await client.from('affiliate_programs').update({
          category: prog.category, url: prog.url, payout_model: prog.payout_model,
          recurring: prog.recurring, avg_epc: prog.avg_epc, api_available: true,
          metadata: prog.metadata, updated_at: prog.updated_at,
        }).eq('id', existing.id)
        result.rows_skipped++  // al bekend → niet als nieuw geteld
      } else {
        const { error } = await client.from('affiliate_programs').insert(prog)
        if (error) { result.rows_skipped++; result.detail.last_insert_error = error.message }
        else result.rows_imported++
      }
    }
    // connector-gezondheid bijwerken
    await client.from('affiliate_api_connectors').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'ok', last_error: null,
    }).eq('id', c.id)
  } catch (e) {
    result.detail.error = (e instanceof Error ? e.message : String(e)).slice(0, 300)
    await client.from('affiliate_api_connectors').update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: 'error', last_error: String(result.detail.error),
    }).eq('id', c.id)
  }
  return result
}

async function runOnce(client: SupabaseClient) {
  if (!(await engineWindowOpen(client))) { log('venster dicht (engine_schedule) — sla over'); return }

  const { data: connectors, error } = await client.from('affiliate_api_connectors')
    .select('id,provider,base_url,auth_type,credential_env,config').eq('enabled', true)
  if (error) { log(`connectors ophalen faalde: ${error.message}`); return }
  const list = (connectors ?? []) as Connector[]
  if (list.length === 0) { log('geen actieve connectors — niets te crawlen'); return }

  log(`crawl ${list.length} connector(s)…`)
  for (const c of list) {
    const r = await crawlConnector(client, c)
    await client.from('affiliate_import_runs').insert({
      network: r.network, source: r.source,
      rows_received: r.rows_received, rows_imported: r.rows_imported, rows_skipped: r.rows_skipped,
      ran_at: new Date().toISOString(), detail: r.detail,
    })
    log(`${r.network}: ontvangen ${r.rows_received}, nieuw ${r.rows_imported}, bekend ${r.rows_skipped}${r.detail.error ? `, fout: ${r.detail.error}` : ''}`)
  }
}

async function main() {
  if (process.env.AFFILIATE_DISCOVERY_RUN !== '1' && !LOOP) {
    log('idle — zet AFFILIATE_DISCOVERY_RUN=1 (eenmalig) of AFFILIATE_DISCOVERY_LOOP=1 (continu) om te draaien')
    return
  }
  const client = db()
  if (LOOP) {
    log(`loop elke ${Math.round(INTERVAL_MS / 60000)} min`)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try { await runOnce(client) } catch (e) { log(`run-fout: ${String((e as Error).message ?? e)}`) }
      await new Promise((r) => setTimeout(r, INTERVAL_MS))
    }
  } else {
    await runOnce(client)
  }
}

main().catch((e) => { log('fataal:', e); process.exit(1) })
