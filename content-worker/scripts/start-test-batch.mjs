// Week-1 testbatch — plant 15 video's gespreid in voor publicatie (end-to-end test).
// Kiest ALLEEN video's met persistente storage_path (post-salvage of verse render),
// zodat de upload niet faalt op een verdwenen /tmp-bestand. Titels zijn al uniek.
//
// Run NA salvage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/start-test-batch.mjs
// Optioneel: PRIVACY=unlisted (default public), INTERVAL_MIN=75, START_DELAY_MIN=20
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) { console.error('SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY vereist'); process.exit(1) }
const PRIVACY = process.env.PRIVACY ?? 'public'
const INTERVAL_MIN = Number(process.env.INTERVAL_MIN ?? '75')
const START_DELAY_MIN = Number(process.env.START_DELAY_MIN ?? '20')

const db = createClient(URL, KEY, { auth: { persistSession: false } })
const BATCH = { 'LoopForge AI': 7, 'BrickPulse Lab': 5, 'SliceTheory': 3 }

// kanaal-ids resolven
const { data: chans } = await db.from('youtube_channels').select('id, naam').in('naam', Object.keys(BATCH))
const idByName = new Map((chans ?? []).map(c => [c.naam, c.id]))

let slot = Date.now() + START_DELAY_MIN * 60_000
const planned = []

for (const [naam, n] of Object.entries(BATCH)) {
  const channelId = idByName.get(naam)
  if (!channelId) { console.warn(`[testbatch] kanaal ${naam} niet gevonden — skip`); continue }

  // Kandidaten: backlog mét persistente opslag, niet al actief in queue
  const { data: vids } = await db
    .from('youtube_videos')
    .select('id, title')
    .eq('channel_id', channelId)
    .in('status', ['scheduled', 'queued'])
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: true })
    .limit(n * 3)

  if (!vids?.length) {
    console.warn(`[testbatch] ${naam}: GEEN video's met storage_path — draai eerst salvage of laat verse renders maken. (0/${n})`)
    continue
  }

  let placed = 0
  for (const v of vids) {
    if (placed >= n) break
    // bestaat er al een actieve queue-entry voor deze video?
    const { data: existing } = await db
      .from('youtube_upload_queue')
      .select('id, status')
      .eq('video_id', v.id)
      .not('status', 'in', '("failed","cancelled")')
      .maybeSingle()
    if (existing && ['verified_live', 'uploading', 'preparing'].includes(existing.status)) continue

    const publishAt = new Date(slot).toISOString()
    const payload = {
      video_id: v.id, channel_id: channelId, title: v.title,
      status: 'queued', privacy_status: PRIVACY, scheduled_publish_at: publishAt,
      priority: 10, channel_name: naam, updated_at: new Date().toISOString(),
    }
    let res
    if (existing) {
      res = await db.from('youtube_upload_queue').update(payload).eq('id', existing.id)
    } else {
      res = await db.from('youtube_upload_queue').insert({ ...payload, created_at: new Date().toISOString() })
    }
    if (res.error) { console.error(`[testbatch] ${naam} ${v.id}: ${res.error.message}`); continue }

    planned.push({ naam, title: v.title, publishAt })
    placed++
    slot += INTERVAL_MIN * 60_000
  }
  console.log(`[testbatch] ${naam}: ${placed}/${n} ingepland`)
}

console.log(`\n=== TESTBATCH INGEPLAND (${planned.length} video's, privacy=${PRIVACY}) ===`)
for (const p of planned) console.log(`  ${new Date(p.publishAt).toLocaleString('nl-NL')}  ${p.naam}  — ${p.title}`)
console.log('\nDe upload-orchestrator pikt elke entry op zodra scheduled_publish_at binnen 1u valt.')
console.log('Vereist: youtube-engine draait + OAuth geldig (gedaan voor deze 3 kanalen).')
