/**
 * BUILD_TRACKER.md sync — Hybride C, laag 2 (ingest).
 *
 * Draait op de host (CLI-L/CLI-R) — handmatig getriggerd:
 *   npm run sync:tracker            (gebruikt repo-root BUILD_TRACKER.md)
 *   npm run sync:tracker -- <pad>   (expliciet bestand)
 *
 * Leest de canonieke markdown + git-metadata, parst secties A–E en schrijft
 * naar public.build_tracker_documents (+ _items). Idempotent op checksum:
 * onveranderde inhoud → geen nieuwe rij. Raakt public.build_tracker NIET aan.
 *
 * Degradeert netjes: ontbreekt de tabel (migratie 155 niet toegepast), dan logt
 * het dat één keer en stopt zonder te crashen.
 */

import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import { parseBuildTracker } from './lib/build-tracker-parser'

const SUPABASE_URL              = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SYNCED_BY                 = process.env.DISPATCH_HOST_ID ?? process.env.WATCHDOG_HOST_ID ?? 'cli-l'

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('tracker-sync: SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.')
  process.exit(1)
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toISOString()}] [tracker-sync] ${msg}`, ...args)
}

// Schrijft een audittrail-rij naar hermes.tracker_sync_log (migratie 158).
// Degradeert netjes: ontbreekt de tabel, dan stil overslaan (geen crash).
async function writeSyncLog(row: {
  document_id?: string | null
  documents_count: number
  items_count: number
  updated_count: number
  conflicts_count: number
  status: string
  detail?: Record<string, unknown>
}): Promise<void> {
  const trigger = process.env.DISPATCH_TRIGGER ?? 'dispatch'
  try {
    const { error } = await db.schema('hermes').from('tracker_sync_log').insert({
      trigger: ['manual', 'cron', 'dispatch', 'planner'].includes(trigger) ? trigger : 'dispatch',
      document_id: row.document_id ?? null,
      documents_count: row.documents_count,
      items_count: row.items_count,
      updated_count: row.updated_count,
      conflicts_count: row.conflicts_count,
      status: row.status,
      detail: row.detail ?? {},
    })
    if (error) log('sync-log overgeslagen (tabel mist? mig 158):', error.message)
  } catch (e) {
    log('sync-log overgeslagen:', e instanceof Error ? e.message : e)
  }
}

function gitInfo(dir: string): { branch: string | null; commit: string | null; repo: string | null } {
  const run = (cmd: string): string | null => {
    try { return execSync(cmd, { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() }
    catch { return null }
  }
  const branch = run('git rev-parse --abbrev-ref HEAD')
  const commit = run('git rev-parse --short HEAD')
  const remote = run('git remote get-url origin')
  const repo = remote ? remote.replace(/\.git$/, '').split(/[/:]/).slice(-2).join('/') : null
  return { branch, commit, repo }
}

async function main(): Promise<void> {
  const argPath = process.argv[2]
  let filePath = argPath
    ? path.resolve(argPath)
    : process.env.BUILD_TRACKER_PATH
      ? path.resolve(process.env.BUILD_TRACKER_PATH)
      : ''

  if (!filePath) {
    // Default: repo-root van de checkout waarin dit script draait.
    try {
      const top = execSync('git rev-parse --show-toplevel', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
      filePath = path.join(top, 'BUILD_TRACKER.md')
    } catch {
      filePath = path.resolve(process.cwd(), 'BUILD_TRACKER.md')
    }
  }

  if (!fs.existsSync(filePath)) {
    log(`bestand niet gevonden: ${filePath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(filePath, 'utf8')
  const checksum = crypto.createHash('sha256').update(raw).digest('hex')
  const { branch, commit, repo } = gitInfo(path.dirname(filePath))

  // Idempotent: bestaat er al een current document met deze checksum?
  const existing = await db
    .from('build_tracker_documents')
    .select('id, checksum')
    .eq('is_current', true)
    .eq('scope', 'cross-project')
    .maybeSingle()

  if (existing.error) {
    log('tabel build_tracker_documents niet bereikbaar — migratie 155 toegepast?', existing.error.message)
    process.exit(1)
  }
  if (existing.data?.checksum === checksum) {
    log(`ongewijzigd (checksum ${checksum.slice(0, 12)}…) — niets te doen.`)
    await writeSyncLog({
      document_id: existing.data.id,
      documents_count: 1, items_count: 0, updated_count: 0, conflicts_count: 0,
      status: 'unchanged', detail: { checksum: checksum.slice(0, 12) },
    })
    return
  }

  const items = parseBuildTracker(raw)
  const perSection = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.section] = (acc[it.section] ?? 0) + 1
    return acc
  }, {})

  // Markeer vorige current af.
  await db.from('build_tracker_documents')
    .update({ is_current: false })
    .eq('scope', 'cross-project')
    .eq('is_current', true)

  const doc = await db.from('build_tracker_documents')
    .insert({
      scope: 'cross-project',
      source_file: path.basename(filePath),
      source_repo: repo,
      source_branch: branch,
      source_commit: commit,
      raw_markdown: raw,
      checksum,
      is_current: true,
      synced_by: SYNCED_BY,
    })
    .select('id')
    .single()

  if (doc.error || !doc.data) {
    log('document-insert mislukt:', doc.error?.message)
    process.exit(1)
  }

  const rows = items.map((it) => ({ document_id: doc.data!.id, ...it }))
  if (rows.length) {
    const ins = await db.from('build_tracker_items').insert(rows)
    if (ins.error) {
      log('items-insert mislukt:', ins.error.message)
      process.exit(1)
    }
  }

  // Parser emit GEEN match_pattern (hand-gecureerd in DB); tel hier de sectie-D
  // ("niet opnieuw doen") regels als conflict-indicatie voor de audittrail.
  const conflictsCount = items.filter((it) => it.section === 'D').length
  await writeSyncLog({
    document_id: doc.data.id,
    documents_count: 1,
    items_count: items.length,
    updated_count: items.length,
    conflicts_count: conflictsCount,
    status: 'synced',
    detail: { commit, branch, per_section: perSection },
  })

  log(`gesynct: doc ${doc.data.id} · commit ${commit ?? '?'} (${branch ?? '?'}) · ${items.length} items ` +
      `[A:${perSection.A ?? 0} B:${perSection.B ?? 0} C:${perSection.C ?? 0} D:${perSection.D ?? 0} E:${perSection.E ?? 0}]`)
}

void main().catch((err) => {
  log('fout:', err instanceof Error ? err.message : err)
  process.exit(1)
})
