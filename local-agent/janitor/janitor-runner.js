#!/usr/bin/env node
/*
 * janitor-runner.js — PM2-service die de janitor autonoom draait binnen het
 * engine_schedule-venster 'janitor' (00:00–04:00), met lage prioriteit (nice).
 *
 *   engine_window_open('janitor:clean')  -> macOS-cleaner (1x per venster)
 *   engine_window_open('janitor:dedup')  -> 1 dedup/hydrate-batch (--apply)
 *
 * Logt start/resultaat naar hermes.logs en heartbeat naar hermes.hosts.
 * Degradeert netjes als Supabase/Hermes onbereikbaar is (blijft idle pollen).
 *
 * Vereist local-agent/.env met SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (zoals
 * de andere runners). Start via PM2 (zie janitor README / ecosystem-snippet).
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

// .env zelf inlezen (geen dotenv-dep). Probeer meerdere locaties: CLI-L gebruikt
// local-agent/.env, CLI-R heeft de creds in executor/.env. Eerste die bestaat wint.
function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([\w.\-]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return true;
  } catch { return false; }
}
for (const c of ['../.env', '../../.env', '../../executor/.env', '../../local-watchdog/.env']) {
  if (loadEnv(path.join(__dirname, c)) && process.env.SUPABASE_URL) break;
}
const { createClient } = require('@supabase/supabase-js');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const HOST_ID = process.env.WATCHDOG_HOST_ID || 'cli-r';
const POLL_MS = parseInt(process.env.JANITOR_POLL_MS || '300000', 10);   // 5 min
const DIR = __dirname;

const db = (URL && KEY) ? createClient(URL, KEY, { auth: { persistSession: false } }) : null;
const hermes = () => db.schema('hermes');
const stamp = () => new Date().toISOString();
function log(msg, ...a) { console.log(`[${stamp()}] [janitor] ${msg}`, ...a); }

async function hlog(level, event, message, context = {}) {
  if (!db) return;
  try { await hermes().from('logs').insert({ level, event, message, context: { host: HOST_ID, ...context } }); }
  catch (e) { log('hermes log faalde:', e.message); }
}
async function heartbeat() {
  if (!db) return;
  try { await hermes().from('hosts').update({ last_seen_at: stamp() }).eq('host_id', HOST_ID); } catch { /* idle */ }
}
async function windowOpen(key) {
  if (!db) return false;
  try { const { data, error } = await db.rpc('engine_window_open', { p_engine_key: key }); return !error && data === true; }
  catch { return false; }
}
function run(cmd, args) {
  return new Promise(resolve => {
    execFile('nice', ['-n', '15', cmd, ...args], { cwd: DIR, maxBuffer: 64 << 20, timeout: 3 * 3600 * 1000 },
      (err, stdout, stderr) => resolve({ code: err ? (err.code || 1) : 0, stdout: stdout || '', stderr: stderr || '' }));
  });
}
// laatste regel(s) van de output als korte samenvatting
const tail = (s, n = 6) => s.trim().split('\n').slice(-n).join(' | ');

let busy = false;
let lastCleanDay = '';

async function tick() {
  await heartbeat();
  if (busy) return;
  const today = stamp().slice(0, 10);

  // 1) macOS-cleaner: 1x per dag binnen het venster
  if (lastCleanDay !== today && await windowOpen('janitor:clean')) {
    busy = true;
    log('venster open -> macOS-cleaner');
    await hlog('info', 'janitor.clean.start', 'Janitor macOS-cleaner gestart');
    const r = await run('bash', ['janitor-clean.sh', '--apply']);
    lastCleanDay = today;
    await hlog(r.code === 0 ? 'info' : 'warn', 'janitor.clean.done', `Cleaner klaar (code ${r.code})`, { summary: tail(r.stdout) });
    log('cleaner klaar', r.code);
    busy = false;
  }

  // 2) dedup/hydrate-batch (cap per run = breekpunt; meerdere nachten dekt alles)
  if (await windowOpen('janitor:dedup')) {
    busy = true;
    log('venster open -> dedup/hydrate-batch');
    await hlog('info', 'janitor.dedup.start', 'Janitor dedup/hydrate-batch gestart');
    const r = await run('node', ['janitor-dedup.js', '--hydrate', '--apply']);
    await hlog(r.code === 0 ? 'info' : 'warn', 'janitor.dedup.done', `Dedup-batch klaar (code ${r.code})`, { summary: tail(r.stdout, 10) });
    log('dedup klaar', r.code);
    busy = false;
  }
}

(async () => {
  log(`start host=${HOST_ID} poll=${POLL_MS}ms supabase=${db ? 'ja' : 'NEE (idle)'}`);
  await hlog('info', 'janitor.runner.online', `Janitor runner online op ${HOST_ID}`);
  await tick();
  setInterval(() => { tick().catch(e => log('tick-fout', e.message)); }, POLL_MS);
})();
