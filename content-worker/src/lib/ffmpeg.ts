import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'

export interface ProcessOptions {
  inputPath: string
  outputPath: string
  targetDuration: number  // seconds
  loop?: boolean          // true = ping-pong (forward + reversed)
  startOffset?: number    // seconds from start (default 5 to skip boring intro)
}

export function processVideo(opts: ProcessOptions): Promise<void> {
  const { inputPath, outputPath, targetDuration, loop = false, startOffset = 5 } = opts

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })

  return new Promise((resolve, reject) => {
    if (loop) {
      // Ping-pong loop: trim source to half the target duration, then concat with reversed copy
      // Result: source_trim + reversed_trim = seamless infinite loop visual
      const halfDuration = Math.ceil(targetDuration / 2)

      ffmpeg(inputPath)
        .inputOptions([`-ss ${startOffset}`, `-t ${halfDuration}`])
        .complexFilter([
          // Scale source landscape to vertical 1080x1920 (center crop)
          '[0:v]scale=-2:1920,crop=1080:1920[scaled]',
          // Split into two copies
          '[scaled]split=2[v1][v2]',
          // Reverse second copy
          '[v2]reverse[vr]',
          // Concatenate forward + reversed
          '[v1][vr]concat=n=2:v=1:a=0[out]',
        ])
        .outputOptions([
          '-map [out]',
          '-an',               // no audio
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
          '-r 30',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`FFmpeg loop error: ${err.message}`)))
        .run()
    } else {
      // Standard: trim + crop to 9:16 portrait
      ffmpeg(inputPath)
        .inputOptions([`-ss ${startOffset}`, `-t ${targetDuration}`])
        .videoFilter([
          'scale=-2:1920',
          'crop=1080:1920',
        ])
        .outputOptions([
          '-an',
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-movflags +faststart',
          '-r 30',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
        .run()
    }
  })
}

export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) reject(err)
      else resolve(meta.format.duration ?? 0)
    })
  })
}
