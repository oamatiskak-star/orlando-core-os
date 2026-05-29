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

// --- P4.1: persona flow-tests ----------------------------------------------
// Grounded in routes uit de inventaris (no-mock: geen verzonnen routes).
// Aquier-scope tegen VALIDATOR_AQUIER_URL, orlando-scope tegen VALIDATOR_BASE_URL.
const AQUIER_URL = process.env.VALIDATOR_AQUIER_URL || ''
const DEFAULT_FLOWS = [
  { persona: 'koper', flow_key: 'intake_checkout',
    steps: [{ path: '/object-indienen', base: 'aquier' }, { path: '/checkout', base: 'aquier' }] },
  { persona: 'lid', flow_key: 'membership',
    steps: [{ path: '/dashboard/membership', base: 'aquier', auth: true }, { path: '/dashboard/rapporten', base: 'aquier', auth: true }] },
  { persona: 'admin', flow_key: 'ops',
    steps: [{ path: '/dashboard', base: 'orlando', auth: true }, { path: '/dashboard/operations', base: 'orlando', auth: true }, { path: '/dashboard/build-tracker', base: 'orlando', auth: true }] },
]

// Self-registering: zet de standaard-flows neer als de registry leeg is.
async function ensureDefaultFlows() {
  const existing = await pg('GET', 'flow_tests', { query: '?select=id&limit=1' })
  if (!existing.ok) return false
  if (JSON.parse(existing.text).length > 0) return true
  await pg('POST', 'flow_tests', {
    body: DEFAULT_FLOWS.map((f) => ({ persona: f.persona, flow_key: f.flow_key, steps: f.steps, enabled: true })),
    prefer: 'return=minimal',
  })
  console.log(`[validator] ${DEFAULT_FLOWS.length} standaard-flows geregistreerd`)
  return true
}

function baseFor(step) {
  return step.base === 'aquier' ? AQUIER_URL : BASE_URL
}

async function runFlows() {
  const res = await pg('GET', 'flow_tests', { query: '?enabled=eq.true&select=id,persona,flow_key,steps' })
  if (!res.ok) return null
  const flows = JSON.parse(res.text)
  let scoreSum = 0, scoreN = 0
  for (const f of flows) {
    const steps = Array.isArray(f.steps) ? f.steps : []
    if (steps.some((s) => !baseFor(s))) {
      console.log(`[validator] flow ${f.persona}/${f.flow_key}: base-URL ontbreekt voor scope, overgeslagen`)
      continue
    }
    const runIns = await pg('POST', 'validation_runs', {
      body: [{ run_kind: 'flow', target_scope: steps[0]?.base ?? 'platform', persona: f.persona,
               status: 'running', triggered_by: TRIGGERED_BY, started_at: new Date().toISOString() }],
      prefer: 'return=representation',
    })
    if (!runIns.ok) continue
    const runId = JSON.parse(runIns.text)[0].id
    let passed = 0, failed = 0
    const errors = []
    for (const s of steps) {
      let status = 0
      try { status = (await fetch(`${baseFor(s)}${s.path}`, { method: 'GET', redirect: 'manual' })).status } catch { status = 0 }
      const sev = status === 0 ? 'critical' : severityFor(status, !!s.auth)
      if (sev) { failed++; errors.push({ run_id: runId, route: s.path, check_kind: 'flow', severity: sev,
        title: `${f.persona}/${f.flow_key}: HTTP ${status || 'geen respons'} op ${s.path}`,
        detail: `Stap in persona-flow ${f.persona}`, evidence: { status, auth: !!s.auth, base: s.base } }) }
      else passed++
    }
    if (errors.length) await pg('POST', 'validation_errors', { body: errors, prefer: 'return=minimal' })
    const total = steps.length
    const readiness = total ? Math.round((passed / total) * 10000) / 100 : 100
    scoreSum += readiness; scoreN++
    await pg('PATCH', 'validation_runs', { query: `?id=eq.${runId}`,
      body: { status: failed ? 'failed' : 'passed', total_checks: total, passed, failed, production_score: readiness, finished_at: new Date().toISOString() },
      prefer: 'return=minimal' })
    await pg('PATCH', 'flow_tests', { query: `?id=eq.${f.id}`,
      body: { last_run_id: runId, last_status: failed ? 'failed' : 'passed', readiness_score: readiness, last_run_at: new Date().toISOString() },
      prefer: 'return=minimal' })
    console.log(`[validator] flow ${f.persona}/${f.flow_key}: ${passed}/${total} ok → readiness ${readiness}`)
  }
  if (scoreN) {
    const avg = Math.round((scoreSum / scoreN) * 100) / 100
    await pg('POST', 'production_scores', { body: [{ scope: 'platform', dimension: 'flows', score: avg,
      severity: avg >= 90 ? 'low' : avg >= 70 ? 'medium' : 'high' }], prefer: 'return=minimal' })
    console.log(`[validator] flows gemiddelde readiness: ${avg}`)
  }
  return { flows: flows.length }
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

  // Persona flow-tests (P4.1): VALIDATOR_FLOWS=1
  if (process.env.VALIDATOR_FLOWS === '1') {
    await ensureDefaultFlows();
    const fr = await runFlows();
    if (fr) console.log(`[validator] flow-tests uitgevoerd over ${fr.flows} flow(s)`);
  } else {
    console.log('[validator] VALIDATOR_FLOWS!=1 → flow-tests overgeslagen.');
  }
})().catch((e) => { console.error('[validator] fout:', e.message); process.exit(1); });
