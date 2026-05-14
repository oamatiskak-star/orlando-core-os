/**
 * Generate thumbnails for all queued videos.
 * FFmpeg reads directly from the Supabase Storage URL (no full download needed).
 * Uploads each 1280x720 JPEG to Storage and updates thumbnail_path in youtube_videos.
 *
 * Run: npx ts-node --transpile-only src/generate-thumbnails.ts
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

const TMP_DIR = '/tmp/orlando-thumbnails'
const THUMB_BUCKET = 'yt-thumbnails'
const SIGNED_URL_TTL = 7 * 24 * 60 * 60 // 7 days

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function extractFrameFromUrl(videoUrl: string, thumbPath: string, seekSecs = 4): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoUrl)
      .inputOptions([`-ss ${seekSecs}`])     // fast seek BEFORE input
      .inputOptions(['-t 1'])                  // read max 1s worth of data
      .frames(1)
      .size('1280x720')
      .outputOptions(['-q:v 2'])
      .output(thumbPath)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .run()
  })
}

async function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true })

  // Fetch all queued videos without a thumbnail
  const { data: rows, error } = await supabase
    .from('youtube_upload_queue')
    .select(`
      id,
      video_id,
      youtube_videos!inner(id, title, file_path, thumbnail_path),
      youtube_channels!inner(naam)
    `)
    .eq('status', 'queued')
    .order('scheduled_publish_at')

  if (error || !rows) { console.error('DB error:', error?.message); process.exit(1) }

  const todo = (rows as any[]).filter(r => !r.youtube_videos.thumbnail_path)
  console.log(`\n${todo.length} videos hebben nog geen thumbnail\n`)

  let done = 0
  let failed = 0

  for (const row of todo) {
    const videoId   = row.youtube_videos.id as string
    const title     = row.youtube_videos.title as string
    const fileUrl   = row.youtube_videos.file_path as string
    const channel   = row.youtube_channels.naam as string
    const n         = done + failed + 1

    console.log(`[${n}/${todo.length}] ${channel} — ${title.slice(0, 55)}`)

    if (!fileUrl?.startsWith('http')) {
      console.log('  ✗ Geen HTTP file_path — overgeslagen')
      failed++
      continue
    }

    const tmpThumb    = path.join(TMP_DIR, `thumb_${videoId}.jpg`)
    const storagePath = `${channel}/thumbnails/${videoId}.jpg`

    try {
      // 1. Extract frame at 4s directly from the URL (FFmpeg streams just enough)
      process.stdout.write('  Frame extraheren... ')
      try {
        await extractFrameFromUrl(fileUrl, tmpThumb, 4)
      } catch {
        // Fallback: try at 1s (very short video)
        await extractFrameFromUrl(fileUrl, tmpThumb, 1)
      }
      const kb = Math.round(fs.statSync(tmpThumb).size / 1024)
      console.log(`✓ (${kb}KB)`)

      // 2. Upload JPEG to Supabase Storage
      process.stdout.write('  Uploaden naar storage... ')
      const fileBuffer = fs.readFileSync(tmpThumb)
      const { error: uploadErr } = await supabase.storage
        .from(THUMB_BUCKET)
        .upload(storagePath, fileBuffer, { contentType: 'image/jpeg', upsert: true })
      if (uploadErr) throw new Error(`Storage: ${uploadErr.message}`)
      console.log('✓')

      // 3. Create signed URL valid for 7 days
      const { data: signed, error: signErr } = await supabase.storage
        .from(THUMB_BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL)
      if (signErr || !signed?.signedUrl) throw new Error(`Sign: ${signErr?.message}`)

      // 4. Write URL back to youtube_videos.thumbnail_path
      const { error: dbErr } = await supabase
        .from('youtube_videos')
        .update({ thumbnail_path: signed.signedUrl, updated_at: new Date().toISOString() })
        .eq('id', videoId)
      if (dbErr) throw new Error(`DB: ${dbErr.message}`)

      console.log(`  ✓ opgeslagen`)
      done++
    } catch (err) {
      console.error(`  ✗ ${(err as Error).message}`)
      failed++
    } finally {
      if (fs.existsSync(tmpThumb)) fs.unlinkSync(tmpThumb)
    }
  }

  console.log(`\n─────────────────────────────────────`)
  console.log(`Klaar: ${done} thumbnails gegenereerd, ${failed} mislukt`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => { console.error(e.message); process.exit(1) })
