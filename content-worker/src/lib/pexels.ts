import axios from 'axios'
import fs from 'fs'
import path from 'path'

const PEXELS_API_URL = 'https://api.pexels.com/videos/search'

export interface PexelsVideo {
  id: number
  duration: number
  video_files: Array<{
    id: number
    quality: string
    file_type: string
    width: number | null
    height: number | null
    link: string
  }>
}

export interface PexelsSearchResult {
  videos: PexelsVideo[]
  total_results: number
}

export async function searchPexels(
  query: string,
  perPage = 15,
  orientation: 'landscape' | 'portrait' | 'square' = 'landscape',
): Promise<PexelsVideo[]> {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) throw new Error('PEXELS_API_KEY not set')

  const page = Math.floor(Math.random() * 5) + 1

  const res = await axios.get<PexelsSearchResult>(PEXELS_API_URL, {
    headers: { Authorization: apiKey },
    params: { query, per_page: perPage, orientation, page },
    timeout: 15000,
  })

  return res.data.videos ?? []
}

export function pickBestFile(video: PexelsVideo): string | null {
  const files = video.video_files
    .filter(f => f.link && f.file_type === 'video/mp4')
    .sort((a, b) => {
      const scoreA = qualityScore(a.quality, a.width)
      const scoreB = qualityScore(b.quality, b.width)
      return scoreB - scoreA
    })

  return files[0]?.link ?? null
}

function qualityScore(quality: string, width: number | null): number {
  if (quality === 'hd' && width && width >= 1280) return 100
  if (quality === 'hd') return 70
  if (quality === 'sd') return 40
  return 20
}

export async function downloadVideo(url: string, destPath: string): Promise<void> {
  const dir = path.dirname(destPath)
  fs.mkdirSync(dir, { recursive: true })

  const response = await axios.get<NodeJS.ReadableStream>(url, {
    responseType: 'stream',
    timeout: 120000,
  })

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath)
    ;(response.data as NodeJS.ReadableStream).pipe(writer)
    writer.on('finish', () => writer.close((err) => (err ? reject(err) : resolve())))
    writer.on('error', (err) => {
      try { fs.unlinkSync(destPath) } catch (_) { /* ignore */ }
      reject(err)
    })
  })
}
