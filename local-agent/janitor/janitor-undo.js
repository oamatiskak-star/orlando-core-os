#!/usr/bin/env node
/*
 * janitor-undo.js — draait janitor-acties terug op basis van het manifest.
 *   - rename:    bestand terug naar oorspronkelijke naam
 *   - quarantine: bestand terug uit quarantaine naar oorspronkelijke pad
 *
 * Gebruik:
 *   node janitor-undo.js                 # draait ALLE acties uit het manifest terug
 *   node janitor-undo.js --ts <stamp>    # alleen acties van die run-timestamp
 *   node janitor-undo.js --dry           # toon wat teruggedraaid zou worden
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'janitor.config.json'), 'utf8'));
const QUAR = (cfg.quarantineDir || '~/.janitor-quarantine').replace(/^~/, os.homedir());
const MANIFEST = path.join(QUAR, 'manifest.jsonl');
const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const tsIdx = argv.indexOf('--ts');
const onlyTs = tsIdx >= 0 ? argv[tsIdx + 1] : null;

if (!fs.existsSync(MANIFEST)) { console.log(`Geen manifest: ${MANIFEST}`); process.exit(0); }

const lines = fs.readFileSync(MANIFEST, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
// nieuwste eerst terugdraaien (volgorde-veilig)
const actions = lines.filter(r => (r.action === 'rename' || r.action === 'quarantine') && (!onlyTs || r.ts === onlyTs)).reverse();

let ok = 0, skip = 0, err = 0;
for (const a of actions) {
  const src = a.to, dst = a.from;        // terug: van 'to' naar 'from'
  if (!fs.existsSync(src)) { console.log(`SKIP (bron weg): ${src}`); skip++; continue; }
  if (fs.existsSync(dst)) { console.log(`SKIP (doel bestaat al): ${dst}`); skip++; continue; }
  console.log(`${a.action} terug: ${src}  ->  ${dst}`);
  if (!DRY) {
    try { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.renameSync(src, dst); ok++; }
    catch (e) { console.log(`  FOUT: ${e}`); err++; }
  }
}
console.log(`\n${DRY ? '[DRY] ' : ''}teruggedraaid=${ok} overgeslagen=${skip} fouten=${err}`);
