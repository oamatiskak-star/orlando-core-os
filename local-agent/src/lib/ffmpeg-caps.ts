import { execSync } from 'child_process'

/**
 * FFmpeg capability-detectie (gecached). Sommige builds (bv. Homebrew zonder
 * libfreetype) missen `drawtext` → "Filter not found". De render/thumbnail
 * degraderen dan netjes (zonder caption-overlay) i.p.v. hard te falen.
 */
let _drawtext: boolean | null = null
export function hasDrawtext(): boolean {
  if (_drawtext === null) {
    try {
      const out = execSync('ffmpeg -hide_banner -filters', { encoding: 'utf8', timeout: 8000 })
      _drawtext = /\bdrawtext\b/.test(out)
    } catch { _drawtext = false }
    if (!_drawtext) console.warn('ffmpeg mist drawtext (geen libfreetype) → render/thumbnail zonder tekst-overlay. Installeer een ffmpeg mét libfreetype voor captions.')
  }
  return _drawtext
}
