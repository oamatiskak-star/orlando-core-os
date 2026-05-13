import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { buildOAuthClient } from './lib/youtube-api'
import { google } from 'googleapis'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// The two Dutch-titled PropertyInvestorTv videos that must be set private
const TARGETS = [
  { queueId: '271feff8-9c0d-4945-8347-96e9cda2186b', title: 'Klaar Voor 2026? Het Beste Buy-To-Let...' },
  { queueId: 'dcab764f-6d1b-4a0a-9f08-96a2528484d8', title: 'Krijg 10% rendement met deze Buy-to-Let...' },
]

const CHANNEL_ID = 'dcf1b56e-3e06-404d-b508-1b747a4431dc' // PropertyInvestorTv

async function setPrivate(youtubeVideoId: string, auth: ReturnType<typeof buildOAuthClient>) {
  const yt = google.youtube({ version: 'v3', auth })
  await yt.videos.update({
    part: ['status'],
    requestBody: { id: youtubeVideoId, status: { privacyStatus: 'private' } },
  })
}

async function poll(): Promise<boolean> {
  const { data: channel } = await db.from('youtube_channels').select('*').eq('id', CHANNEL_ID).single()
  if (!channel?.refresh_token) throw new Error('PropertyInvestorTv has no OAuth tokens')
  const auth = buildOAuthClient(channel)

  let allDone = true

  for (const target of TARGETS) {
    const { data: entry } = await db.from('youtube_upload_queue')
      .select('status, youtube_video_id')
      .eq('id', target.queueId)
      .single()

    if (!entry) continue

    if (entry.youtube_video_id) {
      console.log(`✓ ${target.title.slice(0, 40)} → YT ID: ${entry.youtube_video_id}`)
      await setPrivate(entry.youtube_video_id, auth)
      await db.from('youtube_upload_queue').update({ status: 'failed', last_error: 'Privatized: Dutch content on English channel', updated_at: new Date().toISOString() }).eq('id', target.queueId)
      await db.from('youtube_videos').update({ privacy_status: 'private', status: 'draft', updated_at: new Date().toISOString() }).eq('youtube_video_id', entry.youtube_video_id)
      console.log(`  → Private gezet + status teruggezet naar draft`)
    } else if (['queued', 'preparing', 'uploading', 'uploaded_pending_processing'].includes(entry.status)) {
      console.log(`  Wacht op upload: ${target.title.slice(0, 40)} (${entry.status})`)
      allDone = false
    } else {
      console.log(`  Skip (${entry.status}): ${target.title.slice(0, 40)}`)
    }
  }

  return allDone
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Privatize Dutch PropertyInvestorTv Videos')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  let done = false
  while (!done) {
    try {
      done = await poll()
      if (!done) {
        process.stdout.write('.')
        await new Promise(r => setTimeout(r, 15_000))
      }
    } catch (err: any) {
      console.error('Fout:', err.message)
      await new Promise(r => setTimeout(r, 15_000))
    }
  }

  console.log('\n✓ Klaar — beide video\'s zijn private gezet')
  process.exit(0)
}

main()
