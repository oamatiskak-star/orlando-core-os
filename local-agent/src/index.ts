import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { generateContent } from './lib/ai'
import { generateTTS } from './lib/tts'
import { buildVideo } from './lib/video'
import { uploadVideoToStorage } from './lib/storage'

const SUPABASE_URL             = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY= process.env.SUPABASE_SERVICE_ROLE_KEY!
const POLL_INTERVAL            = parseInt(process.env.POLL_INTERVAL_SECONDS ?? '30') * 1000
const OUTPUT_DIR               = process.env.VIDEO_OUTPUT_DIR ?? '/tmp/orlando-videos'

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

function log(msg: string, ...args: any[]) {
  console.log(`[${new Date().toLocaleTimeString('nl-NL')}] ${msg}`, ...args)
}

async function processTask(task: any): Promise<void> {
  const p = task.payload
  log(`Taak oppakken: ${p.channel_name} | ${p.video_type} | "${p.topic}"`)

  // Markeer als in behandeling
  await db.from('agent_tasks').update({
    status:     'running',
    started_at: new Date().toISOString(),
  }).eq('id', task.id)

  const tmpDir = path.join(OUTPUT_DIR, task.id)
  fs.mkdirSync(tmpDir, { recursive: true })

  try {
    // ── Stap 1: Genereer content via lokale AI ──────────────────
    log('Stap 1/4: Script genereren via AI...')
    const content = await generateContent({
      channel_name:    p.channel_name,
      topic:           p.topic,
      video_type:      p.video_type,
      language:        p.language ?? 'nl',
      style:           p.style ?? 'energiek, informatief',
      target_seconds:  p.target_seconds ?? 300,
      ollama_model:    p.ollama_model ?? 'llama3.2',
      lm_studio_model: p.lm_studio_model ?? 'default',
    })

    // Sla content op in calendar
    await db.from('yt_content_calendar').update({
      title:             content.title,
      description:       content.description,
      seo_title:         content.title,
      seo_description:   content.description,
      seo_tags:          content.tags,
      full_script:       content.full_script,
      hook_script:       content.hook,
      thumbnail_concept: content.thumbnail_concept,
      cta:               content.cta,
      status:            'script_ready',
      updated_at:        new Date().toISOString(),
    }).eq('id', p.calendar_id)

    // ── Stap 2: Genereer TTS audio ──────────────────────────────
    log('Stap 2/4: TTS audio genereren...')
    const audioPath = path.join(tmpDir, 'audio.mp3')
    await generateTTS(content.full_script, audioPath, p.voice ?? 'nl-NL-ColetteNeural')

    // ── Stap 3: Assembleer video ─────────────────────────────────
    log('Stap 3/4: Video assembleren met FFmpeg...')
    const videoFilename = `${p.channel_name}_${p.video_type}_${Date.now()}.mp4`
    const videoPath     = path.join(tmpDir, videoFilename)

    await buildVideo({
      audioPath,
      outputPath: videoPath,
      title:      content.title,
      bgColor:    p.bg_color ?? '#1a1a2e',
      isShort:    p.video_type === 'short',
    })

    // ── Stap 4: Upload naar Supabase Storage ─────────────────────
    log('Stap 4/4: Uploaden naar Supabase Storage...')
    const storagePath = `${p.channel_name}/${p.publish_date}/${videoFilename}`
    const signedUrl   = await uploadVideoToStorage(videoPath, storagePath)

    // Registreer video in youtube_videos
    const { data: video, error: videoInsertError } = await db.from('youtube_videos').insert({
      channel_id:       p.channel_id,
      video_id:         `pending_${Date.now()}`,
      title:            content.title,
      description:      content.description,
      tags:             content.tags,
      category_id:      '22',
      privacy_status:   'private',
      file_path:        signedUrl,
      storage_bucket:   'yt-videos',
      storage_path:     storagePath,
      status:           'queued',
      upload_status:    'pending',
      is_short:         p.video_type === 'short',
    }).select('id').single()

    if (!video?.id) throw new Error(`youtube_videos insert mislukt: ${videoInsertError?.message ?? 'geen data'}`)

    // Koppel aan calendar
    await db.from('yt_content_calendar').update({
      youtube_video_id: video.id,
      storage_path:     storagePath,
      status:           'video_ready',
      updated_at:       new Date().toISOString(),
    }).eq('id', p.calendar_id)

    // Taak afronden
    await db.from('agent_tasks').update({
      status:       'completed',
      completed_at: new Date().toISOString(),
      result: {
        video_id:     video.id,
        storage_path: storagePath,
        title:        content.title,
      },
    }).eq('id', task.id)

    log(`✓ Klaar: "${content.title}" → ${storagePath}`)

    // Lokale bestanden opruimen (video al in storage)
    fs.rmSync(tmpDir, { recursive: true, force: true })

  } catch (err: any) {
    log(`✗ Fout bij taak ${task.id}:`, err.message)

    await db.from('agent_tasks').update({
      status:       'failed',
      completed_at: new Date().toISOString(),
      error:        err.message,
    }).eq('id', task.id)

    await db.from('yt_content_calendar').update({
      status:        'failed',
      error_message: err.message,
      updated_at:    new Date().toISOString(),
    }).eq('id', task.payload?.calendar_id)

    // Opruimen bij fout
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
}

async function claimTask(): Promise<any | null> {
  // Pick up tasks pre-claimed by factory (status='claimed') or newly pending
  const { data: claimed } = await db
    .from('agent_tasks')
    .select('*')
    .eq('task_type', 'generate_content')
    .eq('status', 'claimed')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)

  if (claimed?.length) return claimed[0]

  // Fallback: pick up pending and claim atomically (optimistic lock)
  const { data: candidates } = await db
    .from('agent_tasks')
    .select('id')
    .eq('task_type', 'generate_content')
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(5)

  if (!candidates?.length) return null

  for (const c of candidates) {
    const { data: locked } = await db
      .from('agent_tasks')
      .update({ status: 'claimed', started_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('status', 'pending')
      .select('*')
      .single()

    if (locked) return locked
  }
  return null
}

async function poll(): Promise<void> {
  const task = await claimTask()
  if (!task) return
  await processTask(task)
}

async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('  Orlando Local AI Agent v1.0')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log(`Poll interval: ${POLL_INTERVAL / 1000}s`)
  log(`Output dir: ${OUTPUT_DIR}`)
  log(`AI: ${process.env.USE_LM_STUDIO !== 'false' ? 'LM Studio' : 'Ollama'}`)
  log('Wacht op taken in agent_tasks...\n')

  while (true) {
    try {
      await poll()
    } catch (err: any) {
      log('Poll fout:', err.message)
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL))
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
