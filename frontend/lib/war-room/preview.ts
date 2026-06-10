// Media War Room — echte preview-resolutie voor creatives.
// Gebruikt uitsluitend bestaande velden; geen mock. Ontbreekt media → null → UI toont
// "Geen preview beschikbaar". Rapporteert dus impliciet welke koppeling ontbreekt.
//
// Bronnen (geverifieerd in shaunum):
//  - media_holding_content_items.output_url  → echte video (bv. replicate.delivery .mp4) [3/72]
//  - media_holding_uploads.platform_video_id (platform='youtube') → YouTube-thumbnail   [1/72]
//  - thumbnail_variants / video_projects / visual_assets = LEEG (CF2 media niet geseed)

export type Preview =
  | { kind: 'video'; url: string; poster: string | null }
  | { kind: 'image'; url: string }
  | null

export function youtubeThumb(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i

// thumbnailUrl = expliciet opgeslagen thumbnail (youtube_videos.thumbnail_url, i.ytimg.com).
export function resolvePreview(
  outputUrl: string | null | undefined,
  youtubeId: string | null | undefined,
  thumbnailUrl?: string | null,
): Preview {
  const yt = youtubeId ? youtubeThumb(youtubeId) : null
  const thumb = thumbnailUrl && /^https?:\/\//i.test(thumbnailUrl) ? thumbnailUrl : null
  if (outputUrl && (VIDEO_RE.test(outputUrl) || outputUrl.includes('replicate.delivery'))) {
    return { kind: 'video', url: outputUrl, poster: thumb ?? yt }
  }
  if (thumb) return { kind: 'image', url: thumb }
  if (yt) return { kind: 'image', url: yt }
  if (outputUrl && /^https?:\/\//i.test(outputUrl)) return { kind: 'image', url: outputUrl }
  return null
}
