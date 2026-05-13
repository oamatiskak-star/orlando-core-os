import ffmpeg from 'fluent-ffmpeg'
import fs from 'fs'
import path from 'path'

export interface VideoOptions {
  audioPath:   string
  outputPath:  string
  title:       string
  bgColor:     string
  isShort:     boolean   // true = 1080x1920 (vertical), false = 1920x1080
}

/**
 * Assembleert een video met FFmpeg:
 * - Achtergrond: vloeiend kleurverloop passend bij het kanaal
 * - Titel overlay (groot, bold, wit)
 * - TTS audio als geluidstrack
 * - Auto-duur op basis van audio
 */
export function buildVideo(opts: VideoOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const { audioPath, outputPath, title, bgColor, isShort } = opts
    const width  = isShort ? 1080 : 1920
    const height = isShort ? 1920 : 1080

    // Hex → rgb voor FFmpeg drawbox
    const hex  = bgColor.replace('#', '')
    const r    = parseInt(hex.slice(0, 2), 16)
    const g    = parseInt(hex.slice(2, 4), 16)
    const b    = parseInt(hex.slice(4, 6), 16)

    // Donkerdere variant voor gradient
    const r2 = Math.max(0, r - 40)
    const g2 = Math.max(0, g - 40)
    const b2 = Math.max(0, b - 40)

    // Wrap titel op max 30 tekens per regel
    const wrapTitle = (t: string, maxLen = 28): string =>
      t.split(' ').reduce((acc, word) => {
        const last = acc[acc.length - 1] ?? ''
        if ((last + ' ' + word).trim().length <= maxLen) {
          acc[acc.length - 1] = (last + ' ' + word).trim()
        } else {
          acc.push(word)
        }
        return acc
      }, [''])
      .join('\n')

    const wrappedTitle = wrapTitle(title)
    // Escape voor FFmpeg drawtext
    const safeTitle = wrappedTitle
      .replace(/[\\':]/g, match => '\\' + match)

    const fontsize = isShort ? 72 : 60
    const yPos     = isShort ? '(h-text_h)/2' : '(h-text_h)/2'

    // Gradient via twee overlappende gekleurde vakken
    const vf = [
      `color=c=0x${hex}:s=${width}x${height}:r=25[bg]`,
      `[bg]drawbox=x=0:y=0:w=${width}:h=${height}:color=0x${hex}@1:t=fill[bg2]`,
      `[bg2]drawbox=x=0:y=${Math.round(height * 0.6)}:w=${width}:h=${Math.round(height * 0.4)}:color=0x${r2.toString(16).padStart(2,'0')}${g2.toString(16).padStart(2,'0')}${b2.toString(16).padStart(2,'0')}@0.8:t=fill[bg3]`,
      `[bg3]drawtext=text='${safeTitle}':fontsize=${fontsize}:fontcolor=white:x=(w-text_w)/2:y=${yPos}:fontfile=/System/Library/Fonts/Helvetica.ttc:borderw=3:bordercolor=black@0.5:line_spacing=8[out]`,
    ].join(';')

    ffmpeg()
      .input(audioPath)
      .inputOptions(['-f', 'lavfi'])
      .input(`color=c=0x${hex}:s=${width}x${height}:r=25`)
      .complexFilter([
        `color=c=0x${hex}:s=${width}x${height}:r=25[bg]`,
        `[bg]drawbox=x=0:y=${Math.round(height * 0.55)}:w=${width}:h=${Math.round(height * 0.45)}:color=0x${r2.toString(16).padStart(2,'0')}${g2.toString(16).padStart(2,'0')}${b2.toString(16).padStart(2,'0')}@0.7:t=fill[bg2]`,
        `[bg2]drawtext=text='${safeTitle}':fontsize=${fontsize}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:borderw=4:bordercolor=black@0.6:line_spacing=12[vout]`,
      ])
      .input(audioPath)
      .outputOptions([
        '-map', '[vout]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
      .run()
  })
}
