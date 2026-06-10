'use client'

import { Play, ImageOff } from 'lucide-react'
import type { Preview } from '@/lib/war-room/preview'

const RATIO: Record<string, string> = {
  video: 'aspect-video',
  portrait: 'aspect-[4/5]',
  square: 'aspect-square',
}

// Echte media-preview. mode 'thumb' = poster/eerste frame + play-overlay (grid);
// mode 'full' = afspeelbare player (detail). Geen media → "Geen preview beschikbaar".
export default function CreativePreview({
  preview, ratio = 'portrait', mode = 'thumb', rounded = 'rounded-t-lg',
}: {
  preview: Preview
  ratio?: 'video' | 'portrait' | 'square'
  mode?: 'thumb' | 'full'
  rounded?: string
}) {
  const box = `relative w-full overflow-hidden ${RATIO[ratio]} ${rounded} bg-[#0b1120]`

  if (!preview) {
    return (
      <div className={`${box} flex flex-col items-center justify-center gap-1 border-b border-white/5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] text-white/30`}>
        <ImageOff size={20} />
        <span className="text-[10px]">Geen preview beschikbaar</span>
      </div>
    )
  }

  if (preview.kind === 'image') {
    return (
      <div className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt="" className="h-full w-full object-cover" loading="lazy" />
      </div>
    )
  }

  // video
  if (mode === 'full') {
    return (
      <div className={box}>
        <video src={preview.url} poster={preview.poster ?? undefined} controls playsInline preload="metadata" className="h-full w-full object-contain bg-black" />
      </div>
    )
  }
  return (
    <div className={`${box} group`}>
      <video src={preview.url} poster={preview.poster ?? undefined} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25">
        <span className="rounded-full bg-black/55 p-2 backdrop-blur-sm">
          <Play size={16} className="text-white" fill="white" />
        </span>
      </div>
    </div>
  )
}
