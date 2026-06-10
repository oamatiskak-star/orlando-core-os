/**
 * music:catalog — bouwt een MUSIC_CATALOG JSON-manifest uit een map met
 * echte audiobestanden. Het manifest is exact het formaat dat de echte engine
 * leest (music-intelligence.ts → loadCatalog): [{name, path, license, bpm?, mood?, energy?}].
 *
 * Gebruik:
 *   node scripts/build-music-catalog.mjs <music-map> [output.json]
 *   npm run music:catalog -- ~/cf2-music
 *
 * License-string MOET de safety-gate halen (music-intelligence.ts scoreTrack:
 *   /royalty|cc0|commercial|licensed|owned/i). Default = Pixabay royalty-free.
 *   Override via env MUSIC_LICENSE="...".
 *
 * Geen audiobestanden gevonden → schrijft NIETS en faalt (geen leeg/schijn-manifest).
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const C = { ok: '\x1b[32m', bad: '\x1b[31m', dim: '\x1b[2m', off: '\x1b[0m' }
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg|flac)$/i
const SAFE_LICENSE_RE = /royalty|cc0|commercial|licensed|owned/i

const srcDir = process.argv[2] || process.env.MUSIC_SOURCE_DIR
if (!srcDir) {
  console.error(`${C.bad}✖ Geef een music-map op: node scripts/build-music-catalog.mjs <map> [out.json]${C.off}`)
  process.exit(2)
}
const absDir = path.resolve(srcDir)
if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
  console.error(`${C.bad}✖ Map bestaat niet: ${absDir}${C.off}`)
  process.exit(2)
}

const license = process.env.MUSIC_LICENSE || 'Pixabay License (royalty-free, commercial use)'
if (!SAFE_LICENSE_RE.test(license)) {
  console.error(`${C.bad}✖ License "${license}" haalt de safety-gate niet (verwacht: royalty|cc0|commercial|licensed|owned).${C.off}`)
  console.error(`  De engine zou elke track afkeuren als license_unsafe. Pas MUSIC_LICENSE aan.`)
  process.exit(2)
}

const files = fs.readdirSync(absDir).filter((f) => AUDIO_RE.test(f)).sort()
if (files.length === 0) {
  console.error(`${C.bad}✖ Geen audiobestanden (mp3/wav/m4a/aac/ogg/flac) in ${absDir}.${C.off}`)
  console.error(`  Geen leeg manifest geschreven — los de bron op (download bv. Pixabay-muziek naar deze map).`)
  process.exit(1)
}

const tracks = files.map((f) => ({
  name: path.basename(f, path.extname(f)),
  path: path.join(absDir, f),   // absoluut pad → engine + preflight kunnen het verifiëren
  license,
}))

const outPath = path.resolve(process.argv[3] || path.join(absDir, 'catalog.json'))
fs.writeFileSync(outPath, JSON.stringify(tracks, null, 2) + '\n', 'utf8')

console.log(`${C.ok}✅ Manifest geschreven: ${outPath}${C.off}`)
console.log(`   ${tracks.length} track(s) · license="${license}"`)
console.log(`${C.dim}   Zet in local-agent/.env:  MUSIC_CATALOG=${outPath}${C.off}`)
console.log(`${C.dim}   Verifieer daarna:         npm run cf2:shadow  (B3 wordt groen)${C.off}`)
