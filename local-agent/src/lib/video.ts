import { execFile } from 'child_process'
import fs from 'fs'

export interface VideoOptions {
  audioPath:  string
  outputPath: string
  title:      string
  bgColor:    string
  isShort:    boolean  // true = 1080x1920, false = 1920x1080
}

export function buildVideo(opts: VideoOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const { audioPath, outputPath, title, bgColor, isShort } = opts
    const width  = isShort ? 1080 : 1920
    const height = isShort ? 1920 : 1080

    const hex = bgColor.replace('#', '')
    const r   = parseInt(hex.slice(0, 2), 16)
    const g   = parseInt(hex.slice(2, 4), 16)
    const b   = parseInt(hex.slice(4, 6), 16)
    const r2  = Math.max(0, r - 40).toString(16).padStart(2, '0')
    const g2  = Math.max(0, g - 40).toString(16).padStart(2, '0')
    const b2  = Math.max(0, b - 40).toString(16).padStart(2, '0')

    const fontsize = isShort ? 72 : 60
    const yGrad    = Math.round(height * 0.55)
    const hGrad    = Math.round(height * 0.45)

    // Wrap title at 28 chars per line and escape for drawtext
    const wrapped = title
      .split(' ')
      .reduce((lines: string[], word) => {
        const last = lines[lines.length - 1] ?? ''
        if ((last + ' ' + word).trim().length <= 28) {
          lines[lines.length - 1] = (last + ' ' + word).trim()
        } else {
          lines.push(word)
        }
        return lines
      }, [''])
      .join('\n')

    const safeTitle = wrapped.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/:/g, '\\:')

    const filterComplex = [
      `[0:v]drawbox=x=0:y=${yGrad}:w=${width}:h=${hGrad}:color=0x${r2}${g2}${b2}@0.7:t=fill[bg]`,
      `[bg]drawtext=text='${safeTitle}':fontsize=${fontsize}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:borderw=4:bordercolor=black@0.6:line_spacing=12[vout]`,
    ].join(';')

    const args = [
      '-f', 'lavfi',
      '-i', `color=c=0x${hex}:s=${width}x${height}:r=25`,
      '-i', audioPath,
      '-filter_complex', filterComplex,
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
      '-y',
      outputPath,
    ]

    execFile('ffmpeg', args, { timeout: 600_000 }, (err, _stdout, stderr) => {
      if (err) {
        reject(new Error(`FFmpeg error: ${stderr?.slice(-400) || err.message}`))
      } else {
        resolve()
      }
    })
  })
}
