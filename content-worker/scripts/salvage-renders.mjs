// Salvage-job — DRAAI OP DE WORKER-HOST (waar /tmp/orlando-videos staat).
// Tilt nog-bestaande gerenderde .mp4's naar persistente Supabase Storage en zet
// storage_path, zodat de backlog overleeft en de upload-worker ze kan publiceren.
//
// Run: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/salvage-renders.mjs
// (of binnen de content-worker container waar de env + de upload_files-volume zijn)
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = process.env.RENDER_BUCKET ?? 'video-renders'
if (!URL || !KEY) { console.error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY vereist'); process.exit(1) }

const db = createClient(URL, KEY, { auth: { persistSession: false } })
const PAGE = 200
let salvaged = 0, missing = 0, failed = 0, scanned = 0, iterations = 0
const perChannelMissing = {}

console.log('[salvage] Start — zoek backlog zonder persistente opslag…')
// Elke verwerkte rij verlaat de filter (storage_path gezet of status=draft),
// dus haal steeds vooraan op i.p.v. offset-paginatie (voorkomt overslaan).
for (;;) {
  if (++iterations > 1000) { console.warn('[salvage] max iteraties bereikt — stop'); break }
  const { data: rows, error } = await db
    .from('youtube_videos')
    .select('id, channel_id, file_path')
    .in('status', ['queued', 'scheduled'])
    .is('storage_path', null)
    .like('file_path', '/tmp/%')
    .range(0, PAGE - 1)
  if (error) { console.error('[salvage] query-fout:', error.message); break }
  if (!rows?.length) break

  for (const v of rows) {
    scanned++
    if (!v.file_path || !fs.existsSync(v.file_path)) {
      // Bestand weg + geen storage → haal uit de actieve pipeline (status=draft,
      // upload_status=deleted) zodat het de backlog-throttle niet blokkeert en
      // de content-worker verse content kan genereren.
      await db.from('youtube_videos')
        .update({ status: 'draft', upload_status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', v.id)
      missing++
      perChannelMissing[v.channel_id] = (perChannelMissing[v.channel_id] ?? 0) + 1
      continue
    }
    try {
      const buffer = fs.readFileSync(v.file_path)
      const key = `${v.channel_id}/${v.id}.mp4`
      const { error: upErr } = await db.storage.from(BUCKET).upload(key, buffer, { contentType: 'video/mp4', upsert: true })
      if (upErr) { console.error(`[salvage] upload-fout ${v.id}: ${upErr.message}`); failed++; continue }
      const url = db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
      const { error: updErr } = await db.from('youtube_videos').update({ storage_path: url, updated_at: new Date().toISOString() }).eq('id', v.id)
      if (updErr) { console.error(`[salvage] db-update fout ${v.id}: ${updErr.message}`); failed++; continue }
      salvaged++
      if (salvaged % 25 === 0) console.log(`[salvage] ${salvaged} gered…`)
    } catch (e) {
      console.error(`[salvage] exception ${v.id}: ${e.message}`); failed++
    }
  }
}

console.log('\n=== SALVAGE RESULTAAT ===')
console.log(`Gescand: ${scanned}`)
console.log(`✓ Gered naar Storage: ${salvaged}`)
console.log(`✗ Bestand weg (niet te redden): ${missing}`)
console.log(`⚠ Upload/DB-fout: ${failed}`)
console.log('\nTip: video\'s met "bestand weg" moeten opnieuw gerenderd worden (content-worker draait dat vanzelf zodra de backlog-throttle onder de cap zakt).')
