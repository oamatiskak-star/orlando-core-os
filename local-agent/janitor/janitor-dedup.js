#!/usr/bin/env node
/*
 * janitor-dedup.js — inhouds-gebaseerde duplicaat- en botsingsdetectie.
 *
 * Twee complementaire detectoren, beide op INHOUDS-HASH (nooit op naam/nummer):
 *   A. Duplicaten: identieke inhoud onder (eventueel) verschillende namen.
 *      -> overtollige kopie naar quarantaine (1 origineel blijft).
 *   B. Botsingen: zelfde naam OF zelfde factuurnummer maar VERSCHILLENDE inhoud.
 *      -> NIET verwijderen; hernoemen met korte inhouds-hash zodat ze uniek worden.
 *
 * VEILIGHEID:
 *   - Default DRY-RUN: rapporteert alleen, verandert niets. Pas met --apply gebeurt er iets.
 *   - Dataless/online-only cloud-placeholders (blocks=0, size>0) worden OVERGESLAGEN
 *     (anders zou hashen ze downloaden/hydrateren).
 *   - Quarantaine = verplaatsen (omkeerbaar) + manifest; nooit harde delete hier.
 *   - Hernoemen wordt gelogd in het manifest -> terug te draaien.
 *
 * Gebruik:
 *   node janitor-dedup.js                 # dry-run op config-roots
 *   node janitor-dedup.js --apply         # voer quarantaine + hernoemen uit
 *   node janitor-dedup.js --root ~/Documents --root ~/Desktop
 *   node janitor-dedup.js --no-pdf        # sla pdftotext-factuurnummerextractie over
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

// Zorg dat pdftotext (poppler, /opt/homebrew/bin) en brctl (/usr/bin) vindbaar zijn,
// ook als de PM2-runner een kale PATH heeft.
process.env.PATH = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', process.env.PATH || ''].join(':');

function expand(p) { return p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p; }

// ---- args ----
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const NO_PDF = argv.includes('--no-pdf');
const HYDRATE = argv.includes('--hydrate');
const rootOverrides = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === '--root' && argv[i + 1]) rootOverrides.push(argv[++i]);

// ---- config ----
const cfgPath = path.join(__dirname, 'janitor.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
const ROOTS = (rootOverrides.length ? rootOverrides : cfg.roots).map(expand);
const EXCLUDE = new Set(cfg.exclude);
const MIN_BYTES = cfg.minBytes ?? 1024;
const PARTIAL = cfg.partialHashBytes ?? 65536;
const SKIP_DATALESS = cfg.skipDataless !== false;
const INCLUDE_EXT = new Set((cfg.includeExtensions || []).map(e => e.toLowerCase()));
const QUAR = expand(cfg.quarantineDir);
const INV_RE = new RegExp(cfg.invoiceNumberRegex, 'i');
const HAVE_PDFTOTEXT = (() => { try { execFileSync('which', ['pdftotext'], { stdio: 'ignore' }); return true; } catch { return false; } })();

const stats = { scanned: 0, skippedDataless: 0, skippedSmall: 0, skippedExcluded: 0, skippedType: 0, hydrated: 0, hashedPartial: 0, hashedFull: 0, pdfTextRead: 0 };
function includedType(p) {
  if (!INCLUDE_EXT.size) return true;            // lege allowlist = alles toestaan
  const ext = path.extname(p).slice(1).toLowerCase();
  return INCLUDE_EXT.has(ext);
}

// ---- walk ----
function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (EXCLUDE.has(e.name)) { stats.skippedExcluded++; continue; }
      yield* walk(full);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

function statSafe(p) { try { return fs.statSync(p); } catch { return null; } }
function isDataless(st) { return st.size > 0 && st.blocks === 0; } // online-only cloud placeholder

// iCloud-beheerd pad (Desktop/Documents-sync of Mobile Documents), niet OneDrive/GDrive.
const HOME = os.homedir();
function isICloudPath(p) {
  if (p.includes('/Library/CloudStorage/')) return false;
  return p.startsWith(path.join(HOME, 'Desktop')) || p.startsWith(path.join(HOME, 'Documents'))
      || p.includes('/Library/Mobile Documents/');
}
const HYDRATE_MAX = cfg.hydrate?.maxFilesPerRun ?? 400;
const HYDRATE_SETTLE = (cfg.hydrate?.settleSeconds ?? 10);
const EVICT_AFTER = cfg.hydrate?.evictAfter !== false;
const hydratedPaths = [];   // iCloud-bestanden die we na afloop weer uitladen
let dlBytes = 0;

function hydrateFile(p, st) {
  try {
    if (isICloudPath(p)) execFileSync('brctl', ['download', p], { stdio: 'ignore', timeout: 30000 });
    else { const fd = fs.openSync(p, 'r'); const b = Buffer.allocUnsafe(65536); fs.readSync(fd, b, 0, 65536, 0); fs.closeSync(fd); } // OneDrive/GDrive: lezen triggert download
  } catch { return null; }
  // wacht tot blocks>0 (gehydrateerd)
  for (let i = 0; i < HYDRATE_SETTLE * 2; i++) {
    const s2 = statSafe(p);
    if (s2 && s2.blocks > 0) { dlBytes += s2.size; if (isICloudPath(p) && EVICT_AFTER) hydratedPaths.push(p); return s2; }
    try { execFileSync('sleep', ['0.5']); } catch {}
  }
  return null;
}

function hashFile(p, bytes) {
  const h = crypto.createHash('sha256');
  const fd = fs.openSync(p, 'r');
  try {
    const len = bytes ?? Infinity;
    const buf = Buffer.allocUnsafe(1 << 20);
    let read = 0, total = 0;
    while ((read = fs.readSync(fd, buf, 0, Math.min(buf.length, len - total), null)) > 0) {
      h.update(buf.subarray(0, read));
      total += read;
      if (total >= len) break;
    }
  } finally { fs.closeSync(fd); }
  return h.digest('hex');
}

// invoice-number identifier: uit bestandsnaam, en (indien hydrated PDF) uit tekst
function fileIdentifier(p, st) {
  const ext = path.extname(p);
  const stem = path.basename(p, ext)
    .replace(/__c[0-9a-f]{8}(_\d+)?$/i, '')   // strip eerdere disambiguatie
    .toLowerCase().replace(/[\s_]+/g, ' ').trim();
  // Naam-botsing alleen bij gelijke naam EN extensie (anders matchen bron+export-
  // paren zoals foo.docx + foo.pdf onterecht; dat zijn geen overschrijf-risico's).
  const ids = new Set([`name:${stem}${ext.toLowerCase()}`]);
  const m = stem.match(INV_RE);
  if (m) ids.add(`inv:${m[1].toLowerCase()}`);
  if (!NO_PDF && HAVE_PDFTOTEXT && p.toLowerCase().endsWith('.pdf') && st.size <= 25 * 1024 * 1024) {
    try {
      const txt = execFileSync('pdftotext', ['-l', '2', '-q', p, '-'], { maxBuffer: 4 << 20, timeout: 15000 }).toString();
      stats.pdfTextRead++;
      const im = txt.match(INV_RE);
      if (im) ids.add(`inv:${im[1].toLowerCase()}`);
    } catch { /* corrupt/locked pdf: negeren */ }
  }
  return [...ids];
}

console.log(`[janitor-dedup] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} roots=${ROOTS.join(', ')} pdftotext=${HAVE_PDFTOTEXT && !NO_PDF}`);

// ---- pass 1: verzamel kandidaten, groepeer op grootte ----
const bySize = new Map();
for (const root of ROOTS) {
  if (!fs.existsSync(root)) { console.log(`  (overslaan, bestaat niet: ${root})`); continue; }
  for (const f of walk(root)) {
    const st = statSafe(f);
    if (!st || !st.isFile()) continue;
    stats.scanned++;
    if (!includedType(f)) { stats.skippedType++; continue; }
    let useSt = st;
    if (isDataless(st)) {
      if (HYDRATE && stats.hydrated < HYDRATE_MAX) {
        const h = hydrateFile(f, st);
        if (h) { useSt = h; stats.hydrated++; } else { stats.skippedDataless++; continue; }
      } else { stats.skippedDataless++; continue; }
    }
    if (useSt.size < MIN_BYTES) { stats.skippedSmall++; continue; }
    if (!bySize.has(useSt.size)) bySize.set(useSt.size, []);
    bySize.get(useSt.size).push({ path: f, size: useSt.size, mtime: useSt.mtimeMs, st: useSt });
  }
}

// ---- pass 2: same-size -> partial hash -> full hash ----
const byFull = new Map();   // fullHash -> [files]
for (const [size, files] of bySize) {
  if (files.length < 2) continue;                 // unieke grootte = nooit duplicaat
  const byPartial = new Map();
  for (const f of files) {
    let ph; try { ph = hashFile(f.path, PARTIAL); stats.hashedPartial++; } catch { continue; }
    (byPartial.get(ph) || byPartial.set(ph, []).get(ph)).push(f);
  }
  for (const [, grp] of byPartial) {
    if (grp.length < 2) continue;
    for (const f of grp) {
      let fh; try { fh = f.size <= PARTIAL ? hashFile(f.path, PARTIAL) : hashFile(f.path); stats.hashedFull++; } catch { continue; }
      f.full = fh;
      (byFull.get(fh) || byFull.set(fh, []).get(fh)).push(f);
    }
  }
}

// Detector A: identieke inhoud (>1 bestand met zelfde full hash)
const dupGroups = [...byFull.values()].filter(g => g.length > 1);
let dupReclaim = 0;
for (const g of dupGroups) { g.sort((a, b) => a.mtime - b.mtime); dupReclaim += g.slice(1).reduce((s, f) => s + f.size, 0); }

// Detector B: zelfde identifier maar verschillende inhoud.
// Bouw identifier-index over ALLE >=MIN_BYTES bestanden (ook unieke grootte!),
// want naam/nummer-botsing hangt niet van grootte af. We hebben full-hash nodig;
// hash alleen bestanden die een gedeelde identifier hebben (lazy).
const byIdent = new Map();   // identifier -> [files]
for (const [, files] of bySize) for (const f of files) {
  for (const id of fileIdentifier(f.path, f.st)) {
    (byIdent.get(id) || byIdent.set(id, []).get(id)).push(f);
  }
}
const collisions = [];
for (const [id, files] of byIdent) {
  if (files.length < 2) continue;
  // full-hash on demand
  for (const f of files) if (!f.full) { try { f.full = hashFile(f.path); stats.hashedFull++; } catch { f.full = 'ERR:' + f.path; } }
  const distinct = new Set(files.map(f => f.full));
  if (distinct.size > 1) collisions.push({ id, raw: files, files: files.map(f => ({ path: f.path, full: f.full, size: f.size })) });
}

// ---- APPLY: quarantaine (duplicaten) + hernoemen (botsingen), met omkeerbaar manifest ----
const applied = { quarantined: 0, renamed: 0, errors: 0 };
if (APPLY) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const manifestPath = path.join(QUAR, 'manifest.jsonl');
  fs.mkdirSync(QUAR, { recursive: true });
  const moved = new Set();
  const log = rec => fs.appendFileSync(manifestPath, JSON.stringify({ ts: stamp, ...rec }) + '\n');

  // A. duplicaten: behoud oudste, verplaats de rest naar quarantaine (omkeerbaar)
  for (const g of dupGroups) {
    for (const f of g.slice(1)) {
      try {
        const rel = f.path.replace(/^\//, '');
        const dest = path.join(QUAR, stamp, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(f.path, dest);
        moved.add(f.path);
        log({ action: 'quarantine', from: f.path, to: dest, hash: f.full, size: f.size, kept: g[0].path });
        applied.quarantined++;
      } catch (e) { applied.errors++; log({ action: 'error', op: 'quarantine', path: f.path, error: String(e) }); }
    }
  }
  // B. botsingen: oudste behoudt naam, rest krijgt __c<hash8>-suffix (in-place, omkeerbaar)
  const renamed = new Set();
  for (const c of collisions) {
    const files = [...c.raw].sort((a, b) => a.mtime - b.mtime);
    for (const f of files.slice(1)) {
      if (moved.has(f.path) || renamed.has(f.path)) continue;
      try {
        const dir = path.dirname(f.path), ext = path.extname(f.path), base = path.basename(f.path, ext);
        let dest = path.join(dir, `${base}__c${f.full.slice(0, 8)}${ext}`);
        let n = 1; while (fs.existsSync(dest)) dest = path.join(dir, `${base}__c${f.full.slice(0, 8)}_${n++}${ext}`);
        fs.renameSync(f.path, dest);
        renamed.add(f.path);
        log({ action: 'rename', from: f.path, to: dest, hash: f.full, id: c.id });
        applied.renamed++;
      } catch (e) { applied.errors++; log({ action: 'error', op: 'rename', path: f.path, error: String(e) }); }
    }
  }
}

// ---- gehydrateerde iCloud-bestanden weer uitladen (ruimte teruggeven) ----
let evicted = 0;
for (const p of hydratedPaths) {
  try { execFileSync('brctl', ['evict', p], { stdio: 'ignore', timeout: 30000 }); evicted++; } catch { /* laat staan */ }
}

// ---- rapport ----
const report = {
  generatedAt: new Date().toISOString(),
  host: os.hostname(),
  mode: APPLY ? 'apply' : 'dry-run',
  roots: ROOTS,
  stats,
  hydrate: { enabled: HYDRATE, downloadedBytes: dlBytes, evicted },
  applied,
  duplicateGroups: dupGroups.length,
  duplicateReclaimBytes: dupReclaim,
  collisionGroups: collisions.length,
  duplicates: dupGroups.map(g => ({ keep: g[0].path, quarantine: g.slice(1).map(f => f.path), bytes: g.slice(1).reduce((s, f) => s + f.size, 0) })),
  collisions
};
const reportFile = path.join(__dirname, 'reports', `dedup-${os.hostname()}-${report.generatedAt.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

const mb = b => (b / 1048576).toFixed(1) + ' MB';
console.log(`\n=== JANITOR DEDUP RAPPORT (${report.mode}) ===`);
console.log(`gescand=${stats.scanned}  overgeslagen: type=${stats.skippedType} dataless=${stats.skippedDataless} klein=${stats.skippedSmall}  pdf-tekst-gelezen=${stats.pdfTextRead}`);
if (HYDRATE) console.log(`hydratatie: ${stats.hydrated} bestanden gedownload (${mb(dlBytes)}), ${evicted} weer uitgeladen (iCloud)`);
console.log(`hashes: partieel=${stats.hashedPartial} volledig=${stats.hashedFull}`);
console.log(`A. INHOUDS-DUPLICATEN: ${dupGroups.length} groepen, terug te winnen ${mb(dupReclaim)}`);
for (const g of report.duplicates.slice(0, 8)) { console.log(`   keep: ${g.keep}`); g.quarantine.forEach(q => console.log(`     dup: ${q}`)); }
if (report.duplicates.length > 8) console.log(`   ... +${report.duplicates.length - 8} groepen (zie rapport)`);
console.log(`B. NAAM/NUMMER-BOTSING, ANDERE INHOUD: ${collisions.length} groepen (worden HERNOEMD, niet verwijderd)`);
for (const c of collisions.slice(0, 8)) { console.log(`   id=${c.id}`); c.files.forEach(f => console.log(`     ${f.path}  [${f.full.slice(0, 8)}]`)); }
if (collisions.length > 8) console.log(`   ... +${collisions.length - 8} groepen (zie rapport)`);
console.log(`\nRapport: ${reportFile}`);
if (APPLY) console.log(`APPLY uitgevoerd: ${applied.quarantined} naar quarantaine, ${applied.renamed} hernoemd, ${applied.errors} fouten. Manifest: ${path.join(QUAR, 'manifest.jsonl')}`);
else console.log('DRY-RUN: er is niets veranderd. Draai met --apply om quarantaine + hernoemen uit te voeren.');

module.exports = { report };
