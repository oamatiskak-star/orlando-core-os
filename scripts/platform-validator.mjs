#!/usr/bin/env node
// ============================================================================
// Hermes Platform Validator — P4.0 (route discovery + HTTP validatie)
// ============================================================================
// Capability-based (geen permanente service). Draait on-demand via Hermes of CLI.
//
// Wat het doet:
//   1. DISCOVERY: scant frontend/app op page/route-bestanden → upsert in
//      hermes.route_registry (self-registering; orphan-vlag = niet meer gezien).
//   2. VALIDATIE (optioneel, als VALIDATOR_BASE_URL gezet): HTTP-probe van
//      publieke routes → hermes.validation_runs + hermes.validation_errors +
//      één hermes.production_scores rij (dimension 'routes').
//
// No-mock: schrijft alleen echte observaties. Auth-routes die 401/redirect geven
// worden NIET als fout geteld (verwacht gedrag zonder sessie).
//
// Degradeert netjes: ontbreekt de hermes-governance-laag (migratie 109 nog niet
// toegepast), dan logt het dat en eindigt met exit 0 (geen crash).
//
// Env:
//   SUPABASE_URL                 (verplicht)
//   SUPABASE_SERVICE_ROLE_KEY    (verplicht)
//   VALIDATOR_APP_ROOT           (default: ./frontend/app)
//   VALIDATOR_SCOPE              (default: orlando-core-os)
//   VALIDATOR_BASE_URL           (optioneel; bv. https://<vercel-prod>)
//   VALIDATOR_TRIGGERED_BY       (default: manual)
//
// Run:  node scripts/platform-validator.mjs
// ============================================================================

import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_ROOT = process.env.VALIDATOR_APP_ROOT || './frontend/app';
const SCOPE = process.env.VALIDATOR_SCOPE || 'orlando-core-os';
const BASE_URL = process.env.VALIDATOR_BASE_URL || '';
const TRIGGERED_BY = process.env.VALIDATOR_TRIGGERED_BY || 'manual';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('[validator] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY vereist');
  process.exit(1);
}

// --- PostgREST helper (hermes-schema, geen npm-dependency) -----------------
async function pg(method, path, { body, prefer, profile = 'hermes', query = '' } = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}${query}`;
  const headers = {
    apikey: SERVICE_KEY,
    authorization: `Bearer ${SERVICE_KEY}`,
    'content-type': 'application/json',
  };
  if (method === 'GET' || method === 'HEAD') headers['accept-profile'] = profile;
  else headers['content-profile'] = profile;
  if (prefer) headers.prefer = prefer;
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

// Detecteer of de governance-laag bestaat (migratie 109 toegepast?).
// 200/206 → ready; 404/400 (schema/tabel ontbreekt) → niet ready.
async function governanceReady() {
  const r = await pg('GET', 'route_registry', { query: '?limit=1' });
  return r.ok;
}

// Eén tijdstempel per run: alles ouder dan dit dat we niet meer zagen = orphan.
const SCAN_STAMP = new Date().toISOString();

// --- 1. Route discovery (filesystem) ---------------------------------------
async function walk(dir, out) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      await walk(full, out);
    } else if (/^(page|route)\.(tsx|ts|jsx|js)$/.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

function toRoute(file) {
  const isApi = /^route\./.test(file.split('/').pop());
  const rel = relative(APP_ROOT, file);
  const segs = rel.split('/').slice(0, -1) // drop the filename
    .filter((s) => !/^\(.*\)$/.test(s))     // drop route groups (auth), (marketing)
    .map((s) => s.replace(/^\[\.\.\.(.+)\]$/, '*$1').replace(/^\[(.+)\]$/, ':$1'));
  const path = '/' + segs.join('/');
  const cleanPath = path === '/' ? '/' : path.replace(/\/$/, '');
  const authRequired = cleanPath.startsWith('/dashboard');
  const app = isApi ? 'api' : authRequired ? 'dashboard' : 'front';
  return {
    app, path: cleanPath, method: 'GET',
    kind: isApi ? 'api' : 'page',
    auth_required: authRequired,
    is_dynamic: /[:*]/.test(cleanPath),
  };
}

// --- 2. Upsert route_registry ----------------------------------------------
async function upsertRoutes(routes) {
  const rows = routes.map((r) => ({
    app: r.app, path: r.path, method: r.method, kind: r.kind,
    auth_required: r.auth_required, last_seen_at: SCAN_STAMP, is_orphan: false,
  }));
  // PostgREST bulk upsert in chunks
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const r = await pg('POST', 'route_registry', {
      body: slice,
      query: '?on_conflict=app,path,method',
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    if (!r.ok) throw new Error(`route_registry upsert faalde (${r.status}): ${r.text.slice(0, 300)}`);
  }
  return rows.length;
}

// --- 3. Optionele HTTP-validatie -------------------------------------------
function severityFor(status, authRequired) {
  if (status >= 500) return 'critical';
  if (status === 404) return 'high';
  if ((status === 401 || status === 403) && authRequired) return null; // verwacht
  if (status === 401 || status === 403) return 'medium';
  if (status >= 400) return 'medium';
  return null; // 2xx/3xx ok
}

async function httpValidate(routes) {
  // open run
  const runRes = await pg('POST', 'validation_runs', {
    body: [{ run_kind: 'route', target_scope: SCOPE, status: 'running',
             triggered_by: TRIGGERED_BY, started_at: new Date().toISOString() }],
    prefer: 'return=representation',
  });
  if (!runRes.ok) throw new Error(`validation_run insert faalde: ${runRes.text.slice(0, 300)}`);
  const runId = JSON.parse(runRes.text)[0].id;

  const probeable = routes.filter((r) => r.kind === 'page' && !r.is_dynamic);
  let passed = 0, failed = 0;
  const errors = [];
  const sevCount = { critical: 0, high: 0, medium: 0, low: 0 };

  for (const r of probeable) {
    let status = 0;
    try {
      const res = await fetch(`${BASE_URL}${r.path}`, { method: 'GET', redirect: 'manual' });
      status = res.status;
    } catch (e) {
      status = 0;
    }
    const sev = status === 0 ? 'critical' : severityFor(status, r.auth_required);
    if (sev) {
      failed++; sevCount[sev]++;
      errors.push({ run_id: runId, route: r.path, check_kind: 'http', severity: sev,
        title: `HTTP ${status || 'geen respons'} op ${r.path}`,
        detail: status === 0 ? 'Geen respons / netwerk-fout' : `Onverwachte status ${status}`,
        evidence: { status, auth_required: r.auth_required } });
    } else {
      passed++;
    }
  }
  if (errors.length) {
    for (let i = 0; i < errors.length; i += 200) {
      await pg('POST', 'validation_errors', { body: errors.slice(i, i + 200), prefer: 'return=minimal' });
    }
  }
  const total = probeable.length;
  const score = total ? Math.round((passed / total) * 10000) / 100 : 100;
  await pg('PATCH', 'validation_runs', {
    query: `?id=eq.${runId}`,
    body: { status: failed ? 'failed' : 'passed', total_checks: total, passed, failed,
            production_score: score, severity_summary: sevCount, finished_at: new Date().toISOString() },
    prefer: 'return=minimal',
  });
  await pg('POST', 'production_scores', {
    body: [{ run_id: runId, scope: SCOPE, dimension: 'routes', score,
             severity: sevCount.critical ? 'critical' : sevCount.high ? 'high' : failed ? 'medium' : 'low' }],
    prefer: 'return=minimal',
  });
  return { runId, total, passed, failed, score, sevCount };
}

// --- main -------------------------------------------------------------------
(async () => {
  if (!(await governanceReady())) {
    console.log('[validator] hermes.route_registry niet bereikbaar — migratie 109 nog niet toegepast? Stop netjes (exit 0).');
    process.exit(0);
  }

  const files = await walk(APP_ROOT, []);
  const routes = files.map(toRoute);
  // dedup op app+path+method
  const seen = new Set();
  const unique = routes.filter((r) => {
    const k = `${r.app} ${r.path} ${r.method}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });

  const n = await upsertRoutes(unique);
  console.log(`[validator] discovery: ${files.length} bestanden → ${n} unieke routes ge-upsert in route_registry`);

  // Orphan-sweep: routes die deze scan niet meer gezien zijn → is_orphan=true
  const orphan = await pg('PATCH', 'route_registry', {
    query: `?last_seen_at=lt.${SCAN_STAMP}&is_orphan=eq.false`,
    body: { is_orphan: true }, prefer: 'return=minimal',
  });
  if (orphan.ok) console.log('[validator] orphan-sweep uitgevoerd (niet-meer-geziene routes gemarkeerd)');

  if (BASE_URL) {
    const res = await httpValidate(unique);
    console.log(`[validator] http-validatie (${BASE_URL}): ${res.passed}/${res.total} ok, ${res.failed} fout, score ${res.score} (run ${res.runId})`);
    console.log(`[validator] severities:`, res.sevCount);
  } else {
    console.log('[validator] VALIDATOR_BASE_URL niet gezet → alleen discovery, geen HTTP-validatie.');
  }
})().catch((e) => { console.error('[validator] fout:', e.message); process.exit(1); });
