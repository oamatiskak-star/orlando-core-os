/* eslint-disable */
/**
 * Remotion-render-invoker: maakt een high-end explainer-render (branded intro + kinetische
 * captions gesynct met de stem + outro) uit een voicetrack + whisper-SRT.
 * Gebruik: node scripts/render-remotion.cjs <voiceMp3> <srt> "<title>" <out.mp4> [brand] [accent] [outro]
 */
const fs = require('fs')
const path = require('path')
const { execFileSync, spawnSync } = require('child_process')

const REMO = path.join(__dirname, '..', 'remotion')

function srtToCaptions(srtPath) {
  const toSec = (t) => { const m = t.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000 : 0 }
  const raw = fs.readFileSync(srtPath, 'utf8').replace(/\r/g, '')
  const caps = []
  for (const block of raw.split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean)
    const tl = lines.find((l) => l.includes('-->'))
    if (!tl) continue
    const [a, b] = tl.split('-->')
    const text = lines.slice(lines.indexOf(tl) + 1).join(' ').trim()
    if (text) caps.push({ from: toSec(a), to: toSec(b), text })
  }
  return caps
}

function probeDur(f) {
  try { const o = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf8' }); const d = parseFloat(o.trim()); return Number.isFinite(d) ? d : 10 } catch { return 10 }
}

function main() {
  const [voice, srt, title, out, brand, accent, outro] = process.argv.slice(2)
  if (!voice || !srt || !title || !out) { console.error('usage: render-remotion.cjs <voice> <srt> "<title>" <out> [brand] [accent] [outro]'); process.exit(2) }
  if (!fs.existsSync(voice) || !fs.existsSync(srt)) { console.error('voice/srt ontbreekt'); process.exit(2) }

  fs.copyFileSync(voice, path.join(REMO, 'public', 'voice.mp3'))
  const props = {
    title, brand: brand || '#0b1f3a', accent: accent || '#C8102E',
    audioSrc: 'voice.mp3', audioDurationSec: probeDur(voice),
    outro: outro || '', captions: srtToCaptions(srt),
  }
  const propsPath = path.join(REMO, 'props.json')
  fs.writeFileSync(propsPath, JSON.stringify(props))
  console.log(`captions=${props.captions.length} · dur=${props.audioDurationSec.toFixed(1)}s → renderen…`)

  const r = spawnSync('npx', ['remotion', 'render', 'src/index.ts', 'Explainer', out, `--props=${propsPath}`, '--concurrency=4', '--log=error'],
    { cwd: REMO, encoding: 'utf8', stdio: 'inherit', timeout: 900_000 })
  if (r.status !== 0) { console.error('remotion render faalde status=' + r.status); process.exit(1) }
  console.log('RENDER_OK: ' + out)
}
main()
