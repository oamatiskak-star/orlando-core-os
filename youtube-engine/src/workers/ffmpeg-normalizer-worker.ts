import { Worker, Job } from 'bullmq'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import { getRedis, QUEUE_NAMES, NormalizeJobData, enqueueUpload } from '../lib/redis-queue'
import { getSupabase, updateQueueStatus, addLog } from '../lib/supabase'
import { notifyUploadFailure } from '../lib/notifications'
import { workerLogger } from '../lib/logger'

const log = workerLogger('ffmpeg-normalizer')

const THREADS    = parseInt(process.env.FFMPEG_THREADS ?? '2')
const MUSIC_DIR  = process.env.MUSIC_ASSETS_DIR ?? '/opt/orlando-videos/music'

function pickMusicFile(): string | null {
  try {
    if (!fs.existsSync(MUSIC_DIR)) return null
    const files = fs.readdirSync(MUSIC_DIR).filter(f => /\.(mp3|aac|wav|ogg)$/i.test(f))
    if (files.length === 0) return null
    return path.join(MUSIC_DIR, files[Math.floor(Math.random() * files.length)])
  } catch {
    return null
  }
}

function addBackgroundMusic(inputPath: string, outputPath: string, musicPath: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg(inputPath)

    if (musicPath) {
      cmd.input(musicPath).inputOptions(['-stream_loop', '-1'])
    } else {
      // Ambient drone fallback: low layered sine tones
      cmd
        .input('aevalsrc=0.03*sin(60*2*PI*t)+0.015*sin(120*2*PI*t)|0.03*sin(60*2*PI*t)+0.015*sin(120*2*PI*t):c=stereo:s=44100:d=3600')
        .inputOptions(['-f', 'lavfi'])
    }

    cmd
      .outputOptions([
        '-map 0:v:0',
        '-map 1:a:0',
        '-c:v libx264',
        '-preset slow',
        '-crf 18',
        '-c:a aac',
        '-b:a 192k',
        '-ar 44100',
        '-ac 2',
        '-shortest',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        `-threads ${THREADS}`,
        '-profile:v high',
        '-level 4.0',
        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2',
      ])
      .output(outputPath)
      .on('start', (cmd) => log.debug('ffmpeg addBackgroundMusic started', { cmd }))
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

function normalizeVideo(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset slow',
        '-crf 18',
        '-c:a aac',
        '-b:a 192k',
        '-ar 44100',
        '-ac 2',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        `-threads ${THREADS}`,
        '-profile:v high',
        '-level 4.0',
        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2',
      ])
      .output(outputPath)
      .on('start', (cmd) => log.debug('ffmpeg started', { cmd }))
      .on('progress', (progress) => {
        if (progress.percent) log.debug(`Encoding ${Math.round(progress.percent)}%`)
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

function probeVideo(inputPath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}

function isYouTubeSafe(probeData: ffmpeg.FfprobeData): boolean {
  const videoStream = probeData.streams.find(s => s.codec_type === 'video')
  const audioStream = probeData.streams.find(s => s.codec_type === 'audio')
  if (!videoStream || !audioStream) return false
  const validVideoCodecs = ['h264', 'hevc', 'vp9', 'av1']
  const validAudioCodecs = ['aac', 'mp3', 'opus']
  return (
    validVideoCodecs.includes(videoStream.codec_name ?? '') &&
    validAudioCodecs.includes(audioStream.codec_name ?? '')
  )
}

export function startFfmpegNormalizerWorker(): Worker {
  const worker = new Worker<NormalizeJobData>(
    QUEUE_NAMES.NORMALIZE,
    async (job: Job<NormalizeJobData>) => {
      const { queueId, videoId, inputPath, outputPath } = job.data
      log.info('Starting normalization', { queueId, inputPath })

      await updateQueueStatus(queueId, 'normalizing')
      await addLog(queueId, videoId, 'info', 'ffmpeg normalization started', { inputPath, outputPath })

      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`)
      }

      const probeData = await probeVideo(inputPath)
      const videoStream = probeData.streams.find(s => s.codec_type === 'video')
      const audioStream = probeData.streams.find(s => s.codec_type === 'audio')
      const duration    = probeData.format.duration ? Math.round(Number(probeData.format.duration)) : null

      await addLog(queueId, videoId, 'info', 'Video probed', {
        codec:    videoStream?.codec_name,
        width:    videoStream?.width,
        height:   videoStream?.height,
        hasAudio: !!audioStream,
        duration,
      })

      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

      const db = getSupabase()

      // No audio stream → add background music
      if (!audioStream) {
        const musicFile = pickMusicFile()
        const source = musicFile ? path.basename(musicFile) : 'ambient tone (geen muziekbestand gevonden)'
        log.info(`No audio detected — adding background music: ${source}`, { queueId })
        await addLog(queueId, videoId, 'info', `Geen audio gevonden — achtergrondmuziek toevoegen: ${source}`)

        await addBackgroundMusic(inputPath, outputPath, musicFile)

        const outputStats = fs.statSync(outputPath)
        const outputProbe = await probeVideo(outputPath)
        const outputDuration = outputProbe.format.duration ? Math.round(Number(outputProbe.format.duration)) : duration

        await db.from('youtube_videos').update({
          normalized_path: outputPath,
          file_size_bytes:  outputStats.size,
          duration_seconds: outputDuration,
          updated_at:       new Date().toISOString(),
        }).eq('id', videoId)

        await addLog(queueId, videoId, 'success', 'Achtergrondmuziek toegevoegd', {
          outputPath,
          sizeBytes: outputStats.size,
          duration:  outputDuration,
        })

        await enqueueUpload({ queueId, videoId, channelId: job.data.channelId })
        return { outputPath, sizeBytes: outputStats.size, addedMusic: true }
      }

      // Has audio — check if already YouTube-safe (skip transcode)
      if (isYouTubeSafe(probeData) && fs.statSync(inputPath).size < 128 * 1024 * 1024) {
        log.info('Video already YouTube-safe, skipping transcode', { queueId })
        await addLog(queueId, videoId, 'info', 'Skipped transcode — already YouTube-safe')

        await db.from('youtube_videos').update({
          normalized_path: inputPath,
          duration_seconds: duration,
          updated_at: new Date().toISOString(),
        }).eq('id', videoId)

        await enqueueUpload({ queueId, videoId, channelId: job.data.channelId })
        return { skipped: true, path: inputPath }
      }

      // Has audio but needs re-encoding
      await normalizeVideo(inputPath, outputPath)
      log.info('Normalization complete', { queueId, outputPath })

      const outputStats = fs.statSync(outputPath)
      const outputProbe = await probeVideo(outputPath)
      const outputDuration = outputProbe.format.duration ? Math.round(Number(outputProbe.format.duration)) : duration

      await db.from('youtube_videos').update({
        normalized_path:  outputPath,
        file_size_bytes:  outputStats.size,
        duration_seconds: outputDuration,
        updated_at:       new Date().toISOString(),
      }).eq('id', videoId)

      await addLog(queueId, videoId, 'success', 'Normalization complete', {
        outputPath,
        sizeBytes: outputStats.size,
        duration:  outputDuration,
      })

      return { outputPath, sizeBytes: outputStats.size }
    },
    {
      connection:  getRedis(),
      concurrency: 1,
    }
  )

  worker.on('failed', async (job, err) => {
    if (!job) return
    const { queueId, videoId, channelId } = job.data
    log.error('ffmpeg normalization failed', { queueId, error: err.message })
    await updateQueueStatus(queueId, 'failed', { last_error: `ffmpeg: ${err.message}` })
    await addLog(queueId, videoId, 'error', `Normalization failed: ${err.message}`)
    const db = getSupabase()
    const { data: v } = await db.from('youtube_videos').select('title').eq('id', videoId).maybeSingle()
    const { data: c } = await db.from('youtube_channels').select('naam').eq('id', channelId).maybeSingle()
    await notifyUploadFailure(v?.title ?? videoId, c?.naam ?? channelId, `ffmpeg mislukt: ${err.message}`)
  })

  log.info('ffmpeg normalizer worker started')
  return worker
}
