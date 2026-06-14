#!/usr/bin/env node
/**
 * Combi-foto downloader voor de Bouw Calculator.
 *
 * Vereist dat er een beeld-host gewhitelist is in de netwerkpolicy.
 * Draai daarna:
 *
 *     node scripts/fetch-combi-fotos.mjs
 *
 * Standaard gebruikt het LoremFlickr (Creative-Commons Flickr-foto's op
 * trefwoord, geen API-key nodig). Wil je een andere bron, zet dan BASE:
 *
 *     IMG_BASE="https://loremflickr.com/640/480" node scripts/fetch-combi-fotos.mjs
 *
 * De {kw}-placeholder wordt vervangen door het Engelse trefwoord per combi.
 * Bestaande bestanden worden overgeslagen (idempotent).
 *
 * LET OP: gebruik uitsluitend royalty-vrije bronnen. Kopieer geen beeld uit
 * 2Jours/Raabcalc of betaalde bibliotheken.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PAGE = join(ROOT, 'app/dashboard/calculaties/calculator/page.tsx')
const COMBI_DIR = join(ROOT, 'public/combis')
const ELEM_DIR = join(COMBI_DIR, 'elementen')

// Bron-URL. {kw} = trefwoord(en), komma-gescheiden voor LoremFlickr.
const BASE = process.env.IMG_BASE || 'https://loremflickr.com/640/480/{kw}'

// Engelse trefwoorden per combi (sturen de fotokeuze).
const KEYWORDS = {
  'Sloopwerk': 'demolition,construction',
  'Fundering & Grondwerk': 'foundation,excavation,construction',
  'Metselwerk': 'bricklaying,masonry,brick,wall',
  'Betonwerk': 'concrete,construction,formwork',
  'Riolering': 'sewer,pipe,plumbing',
  'Asbestsanering': 'asbestos,removal,hazmat',
  'Dakwerk': 'roofing,roof,tiles',
  'Dakkapel & Dakraam': 'dormer,skylight,roof,window',
  'Isolatie': 'insulation,construction',
  'Gevelrenovatie': 'facade,renovation,plaster',
  'Kozijnen & Deuren': 'window,frame,door',
  'Stucwerk & Plafonds': 'plastering,drywall,ceiling',
  'Tegelwerk': 'tiling,tiles,bathroom',
  'Vloerwerk': 'flooring,laminate,parquet',
  'Schilderwerk': 'painting,paint,wall',
  'Timmerwerk': 'carpentry,woodwork',
  'Elektra': 'electrician,wiring,electrical',
  'Loodgieterij': 'plumbing,pipes,bathroom',
  'CV-installatie': 'boiler,heating,radiator',
  'Ventilatie & WTW': 'ventilation,ducting,hvac',
  'Zonnepanelen': 'solar,panels,roof',
  'Badkamer compleet': 'bathroom,renovation,tiles',
  'Keukenplaatsing': 'kitchen,installation,renovation',
  'Trap & Balustrade': 'staircase,stairs,railing',
  'Bestrating & Terras': 'paving,patio,terrace',
  'Tuinafscheiding': 'fence,garden,gate',
}

// Bestandsnaam per combi (moet matchen met COMBI_FOTO in page.tsx).
const COMBI_FOTO = {
  'Sloopwerk': 'sloopwerk.jpg', 'Fundering & Grondwerk': 'fundering.jpg',
  'Metselwerk': 'metselwerk.jpg', 'Betonwerk': 'betonwerk.jpg',
  'Riolering': 'riolering.jpg', 'Asbestsanering': 'asbestsanering.jpg',
  'Dakwerk': 'dakwerk.jpg', 'Dakkapel & Dakraam': 'dakkapel.jpg',
  'Isolatie': 'isolatie.jpg', 'Gevelrenovatie': 'gevelrenovatie.jpg',
  'Kozijnen & Deuren': 'kozijnen.jpg', 'Stucwerk & Plafonds': 'stucwerk.jpg',
  'Tegelwerk': 'tegelwerk.jpg', 'Vloerwerk': 'vloerwerk.jpg',
  'Schilderwerk': 'schilderwerk.jpg', 'Timmerwerk': 'timmerwerk.jpg',
  'Elektra': 'elektra.jpg', 'Loodgieterij': 'loodgieterij.jpg',
  'CV-installatie': 'cv-installatie.jpg', 'Ventilatie & WTW': 'ventilatie.jpg',
  'Zonnepanelen': 'zonnepanelen.jpg', 'Badkamer compleet': 'badkamer.jpg',
  'Keukenplaatsing': 'keuken.jpg', 'Trap & Balustrade': 'trap.jpg',
  'Bestrating & Terras': 'bestrating.jpg', 'Tuinafscheiding': 'tuinafscheiding.jpg',
}

function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[²³¹]/g, '').replace(/ø/g, 'o').replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Parse page.tsx: per combi de regel-omschrijvingen (element-slugs).
function parseElementen() {
  const t = readFileSync(PAGE, 'utf8')
  const block = t.slice(t.indexOf('const COMBIS'), t.indexOf('// ─── Combi-groepen'))
  const result = {} // combiNaam -> [slug, ...]
  let huidig = null
  for (const line of block.split('\n')) {
    const combiMatch = line.match(/^\s{2}(?:'([^']+)'|([A-Za-z][\w-]*)):\s*\[/)
    if (combiMatch) { huidig = combiMatch[1] || combiMatch[2]; result[huidig] = []; continue }
    if (huidig && line.includes('omschrijving:') && !line.includes('soort:')) {
      const m = line.match(/omschrijving:\s*'([^']*)'/)
      if (m) result[huidig].push(slug(m[1]))
    }
  }
  return result
}

async function download(url, dest) {
  if (existsSync(dest)) { console.log('  skip (bestaat)', dest.split('/').pop()); return false }
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`HTTP ${res.status} voor ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(dest, buf)
  console.log('  ok  ', dest.split('/').pop(), `(${(buf.length / 1024).toFixed(0)} kB)`)
  return true
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  mkdirSync(COMBI_DIR, { recursive: true })
  mkdirSync(ELEM_DIR, { recursive: true })
  const elementen = parseElementen()
  let gedownload = 0, fouten = 0

  for (const [combi, kw] of Object.entries(KEYWORDS)) {
    console.log(`\n${combi}  [${kw}]`)
    // combi-foto
    try {
      if (await download(BASE.replace('{kw}', encodeURIComponent(kw)), join(COMBI_DIR, COMBI_FOTO[combi]))) {
        gedownload++; await sleep(400)
      }
    } catch (e) { console.error('  FOUT', e.message); fouten++ }
    // element-foto's (zelfde trefwoord, thematisch passend)
    for (const s of elementen[combi] || []) {
      try {
        if (await download(BASE.replace('{kw}', encodeURIComponent(kw)), join(ELEM_DIR, `${s}.jpg`))) {
          gedownload++; await sleep(400)
        }
      } catch (e) { console.error('  FOUT', s, e.message); fouten++ }
    }
  }

  console.log(`\nKlaar. ${gedownload} gedownload, ${fouten} fouten.`)
  if (fouten) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exit(1) })
