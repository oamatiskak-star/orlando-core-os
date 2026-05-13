import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface VideoOptions {
  audioPath:  string
  outputPath: string
  title:      string
  bgColor:    string
  isShort:    boolean  // true = 1080x1920, false = 1920x1080
}

function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 300_000 }, (err, _out, stderr) => {
      if (err) reject(new Error(`${cmd} error: ${stderr?.slice(0, 500) || err.message}`))
      else resolve()
    })
  })
}

// Generate a title image via Python + PIL
function makeTitleImage(imagePath: string, title: string, bgColor: string, width: number, height: number): Promise<void> {
  const [r, g, b] = hex2rgb(bgColor)
  const r2 = Math.max(0, r - 40)
  const g2 = Math.max(0, g - 40)
  const b2 = Math.max(0, b - 40)
  const fontSize = width >= 1920 ? 80 : 64

  const pyScript = `
import sys
from PIL import Image, ImageDraw, ImageFont

w, h = ${width}, ${height}
img = Image.new('RGB', (w, h), (${r}, ${g}, ${b}))
draw = ImageDraw.Draw(img)

# Gradient band at bottom
for y in range(int(h*0.55), h):
  alpha = (y - int(h*0.55)) / (h * 0.45)
  cr = int(${r} + (${r2} - ${r}) * alpha)
  cg = int(${g} + (${g2} - ${g}) * alpha)
  cb = int(${b} + (${b2} - ${b}) * alpha)
  draw.line([(0, y), (w, y)], fill=(cr, cg, cb))

# Title text
title = """${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"""

# Try system fonts, fall back to default
font = None
for fp in ['/System/Library/Fonts/Helvetica.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf']:
  try:
    font = ImageFont.truetype(fp, ${fontSize})
    break
  except Exception:
    pass
if font is None:
  font = ImageFont.load_default()

# Wrap title
words = title.split()
lines, line = [], ''
for word in words:
  test = (line + ' ' + word).strip()
  bbox = draw.textbbox((0, 0), test, font=font)
  if bbox[2] - bbox[0] > w * 0.85 and line:
    lines.append(line)
    line = word
  else:
    line = test
if line: lines.append(line)

full = '\\n'.join(lines)
bbox = draw.multiline_textbbox((0, 0), full, font=font, spacing=12)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
x = (w - tw) / 2
y = (h - th) / 2

# Shadow
draw.multiline_text((x+4, y+4), full, font=font, fill=(0, 0, 0, 180), spacing=12, align='center')
# Main text
draw.multiline_text((x, y), full, font=font, fill=(255, 255, 255), spacing=12, align='center')

img.save('${imagePath.replace(/\\/g, '\\\\')}')
`

  return new Promise((resolve, reject) => {
    execFile('python3', ['-c', pyScript], { timeout: 30_000 }, (err, _out, stderr) => {
      if (err) reject(new Error(`PIL error: ${stderr?.slice(0, 300) || err.message}`))
      else resolve()
    })
  })
}

export async function buildVideo(opts: VideoOptions): Promise<void> {
  const { audioPath, outputPath, title, bgColor, isShort } = opts
  const width  = isShort ? 1080 : 1920
  const height = isShort ? 1920 : 1080

  const tmpDir  = path.dirname(outputPath)
  const imgPath = path.join(tmpDir, 'bg.png')

  // Step 1: Create title image with PIL
  await makeTitleImage(imgPath, title, bgColor, width, height)

  // Step 2: Combine image + audio with FFmpeg
  await run('ffmpeg', [
    '-loop', '1',
    '-i', imgPath,
    '-i', audioPath,
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
  ])

  // Cleanup temp image
  try { fs.unlinkSync(imgPath) } catch {}
}
