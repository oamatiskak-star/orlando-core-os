#!/usr/bin/env node
// ingest-roadmaps.mjs — CLI-L (file-based). Leest meerdere roadmap-/businessplan-
// markdowns per entiteit en schrijft de gestructureerde staat naar
// build_tracker_documents (scope=<entity-slug>) + build_tracker_items.
// Markdown blijft canoniek (git); dit vult alleen de DB-spiegel voor de War Room.
// Vercel kan de checkout niet lezen → daarom draait dit lokaal (zoals mig 158).
//
// Gebruik:  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/ingest-roadmaps.mjs
//
// GEEN cron/worker — handmatig of via een geplande CLI-L-stap (Engine Planner indien
// het ooit op interval moet draaien). Idempotent op checksum per (scope, source_file).

import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HOME = process.env.HOME ?? ''

// (bestand, scope=entity-slug). Alleen bestaande bestanden worden geïngest.
const SOURCES = [
  { file: `${HOME}/BUILD_TRACKER.md`,                  scope: 'cross-project' },
  { file: `${ROOT}/MASTER_BUILD_PLAN.md`,              scope: 'osm' },
  { file: `${ROOT}/AUTONOMOUS_HOLDING_ECOSYSTEM.md`,   scope: 'osm' },
  { file: `${ROOT}/LAB_CHANNELS_PUBLISHING_PLAN.md`,   scope: 'modiwe-media' },
]

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY vereist'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false } })

// heading → sectie A–E (deterministisch, conform check-constraint)
function sectionFor(heading) {
  const h = (heading || '').toLowerCase()
  if (/(klaar|done|voltooid|gereed|live|bewezen)/.test(h)) return 'A'
  if (/(niet opnieuw|verbod|forbidden|superseded)/.test(h)) return 'D'
  if (/(blocker|open|risic|geblokkeerd)/.test(h)) return 'C'
  if (/(volgende|next|todo|te doen|actie)/.test(h)) return 'E'
  return 'B'
}

function parseItems(md) {
  const items = []
  let heading = ''
  let rank = 0
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    const hd = line.match(/^#{1,4}\s+(.*)$/)
    if (hd) { heading = hd[1].replace(/[#*`]/g, '').trim(); continue }
    const bullet = line.match(/^\s*(?:[-*+]|\d+[.)])\s+(.+)$/)
    if (!bullet) continue
    const text = bullet[1].replace(/\*\*/g, '').trim()
    if (text.length < 4) continue
    const prMatch = text.match(/#(\d+)/)
    items.push({
      section: sectionFor(heading),
      item_rank: rank++,
      title: text.slice(0, 200),
      detail: text.length > 200 ? text : null,
      status_tag: prMatch ? null : null,
      raw_line: line.slice(0, 500),
    })
  }
  return items
}

async function ingest({ file, scope }) {
  if (!existsSync(file)) { console.log(`– skip (niet gevonden): ${file}`); return }
  const md = readFileSync(file, 'utf8')
  const checksum = createHash('sha256').update(md).digest('hex')
  const source_file = file.split('/').pop()

  // al actueel met deze checksum? dan niets doen
  const { data: existing } = await sb.from('build_tracker_documents')
    .select('id,checksum').eq('scope', scope).eq('source_file', source_file).eq('is_current', true).maybeSingle()
  if (existing?.checksum === checksum) { console.log(`= ongewijzigd: ${source_file} (${scope})`); return }

  // oude current op false
  await sb.from('build_tracker_documents').update({ is_current: false })
    .eq('scope', scope).eq('source_file', source_file).eq('is_current', true)

  const { data: doc, error } = await sb.from('build_tracker_documents')
    .insert({ scope, source_file, raw_markdown: md, checksum, is_current: true, synced_by: 'ingest-roadmaps.mjs' })
    .select('id').single()
  if (error) { console.error(`✗ ${source_file}: ${error.message}`); return }

  const items = parseItems(md).map((it) => ({ ...it, document_id: doc.id }))
  if (items.length) {
    const { error: ie } = await sb.from('build_tracker_items').insert(items)
    if (ie) { console.error(`✗ items ${source_file}: ${ie.message}`); return }
  }
  console.log(`✓ ${source_file} (${scope}): ${items.length} items`)
}

for (const s of SOURCES) await ingest(s)
console.log('klaar.')
