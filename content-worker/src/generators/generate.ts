import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { getSupabase } from '../lib/supabase'
import { searchPexels, pickBestFile, downloadVideo } from '../lib/pexels'
import { processVideo, getVideoDuration } from '../lib/ffmpeg'
import { ChannelConfig } from './channels'

const VIDEO_DIR = process.env.VIDEO_OUTPUT_DIR ?? '/tmp/orlando-videos'
const MIN_SOURCE_DURATION = 8  // reject Pexels clips shorter than this

interface ChannelRow {
  id: string
  name: string
  default_tags: string[] | null
}

export async function resolveChannels(names: string[]): Promise<Map<string, ChannelRow>> {
  const db = getSupabase()
  const { data, error } = await db
    .from('youtube_channels')
    .select('id, name, default_tags')
    .in('name', names)

  if (error) throw new Error(`Channel lookup failed: ${error.message}`)

  const map = new Map<string, ChannelRow>()
  for (const row of data ?? []) {
    map.set(row.name, row)
  }
  return map
}

export async function getQueueDepth(channelId: string): Promise<number> {
  const db = getSupabase()
  const { count } = await db
    .from('youtube_videos')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .eq('status', 'queued')

  return count ?? 0
}

export async function generateVideo(
  config: ChannelConfig,
  channel: ChannelRow,
  queryIndex: number,
): Promise<boolean> {
  const db = getSupabase()
  const query = config.pexelsQueries[queryIndex % config.pexelsQueries.length]

  console.log(`[${config.name}] Searching Pexels: "${query}"`)

  const videos = await searchPexels(query, 15)

  // Filter: must have sufficient duration and a good download URL
  const candidates = videos.filter(v => v.duration >= MIN_SOURCE_DURATION)

  if (!candidates.length) {
    console.log(`[${config.name}] No suitable Pexels results for "${query}"`)
    return false
  }

  // Pick a random candidate (vary content)
  const video = candidates[Math.floor(Math.random() * candidates.length)]
  const downloadUrl = pickBestFile(video)

  if (!downloadUrl) {
    console.log(`[${config.name}] No suitable file format found for video ${video.id}`)
    return false
  }

  const videoId = uuidv4()
  const rawPath = path.join(VIDEO_DIR, `raw_${videoId}.mp4`)
  const outputPath = path.join(VIDEO_DIR, `${videoId}.mp4`)

  try {
    // Download raw from Pexels
    console.log(`[${config.name}] Downloading Pexels video ${video.id}…`)
    await downloadVideo(downloadUrl, rawPath)

    // Verify source duration
    const sourceDuration = await getVideoDuration(rawPath)
    const targetDuration = randInt(config.durationRange[0], config.durationRange[1])
    const startOffset = Math.min(5, Math.floor(sourceDuration * 0.1))

    if (sourceDuration < MIN_SOURCE_DURATION) {
      console.log(`[${config.name}] Source too short (${sourceDuration}s), skipping`)
      fs.unlinkSync(rawPath)
      return false
    }

    // Process with FFmpeg
    console.log(`[${config.name}] Processing: ${targetDuration}s, loop=${config.loop}`)
    await processVideo({
      inputPath: rawPath,
      outputPath,
      targetDuration,
      loop: config.loop,
      startOffset,
    })

    // Clean up raw file
    try { fs.unlinkSync(rawPath) } catch (_) { /* ignore */ }

    // Pick title and build metadata
    const title = config.titleTemplates[Math.floor(Math.random() * config.titleTemplates.length)]
    const tags = [...config.tags, ...(channel.default_tags ?? [])]
    const uniqueTags = [...new Set(tags)].slice(0, 500)

    // Insert into youtube_videos — slot-filler picks this up within 2 minutes
    const { error: insertError } = await db.from('youtube_videos').insert({
      id: videoId,
      channel_id: channel.id,
      video_id: `pending_${videoId}`,   // placeholder, replaced by youtube upload worker
      title,
      description: config.description,
      tags: uniqueTags,
      status: 'queued',
      upload_status: 'pending',
      is_short: true,
      file_path: outputPath,
      category_id: config.category_id,
      privacy_status: 'private',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error(`[${config.name}] DB insert failed: ${insertError.message}`)
      try { fs.unlinkSync(outputPath) } catch (_) { /* ignore */ }
      return false
    }

    const fileSizeMb = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(1)
    console.log(`[${config.name}] ✓ Generated ${videoId} (${fileSizeMb} MB) → status=queued`)
    return true

  } catch (err) {
    // Clean up any partial files
    try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath) } catch (_) { /* ignore */ }
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath) } catch (_) { /* ignore */ }
    throw err
  }
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}
