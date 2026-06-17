/* eslint-disable */
/**
 * Test-runner (eenmalig): her-rendert een bestaand video_project met de news-desk
 * overlay. Her-schoont eerst de caption_text van elke scene naar WAT DE STEM ZEGT
 * (captionFromText op de bestaande voice_text), hergebruikt de al-gesynthetiseerde
 * voicetrack en de bestaande scene-assets. Verandert GEEN status, UPLOADT NIET.
 *
 * Gebruik: node scripts/rerender-news-desk.cjs <projectId> <voiceMp3Path>
 */
require('dotenv/config')
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const path = require('path')
const os = require('os')
const { captionFromText, cleanForSpeech } = require('../dist/lib/script-clean')
const { renderProject } = require('../dist/lib/render')
const { generateSubtitles } = require('../dist/lib/subtitles')

async function main() {
  const projectId = process.argv[2]
  const voicePath = process.argv[3]
  if (!projectId || !voicePath) { console.error('usage: node rerender-news-desk.cjs <projectId> <voiceMp3>'); process.exit(2) }
  if (!fs.existsSync(voicePath)) { console.error('voice-bestand bestaat niet:', voicePath); process.exit(2) }

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const { data: proj } = await db.from('video_projects').select('title, format').eq('id', projectId).single()
  console.log('project:', proj && proj.title, '| format:', proj && proj.format)

  // Captions her-schonen naar gesproken tekst (news-presentator).
  const { data: scenes } = await db.from('video_scenes').select('id, idx, voice_text, caption_text').eq('project_id', projectId).order('idx')
  let updated = 0
  for (const s of (scenes || [])) {
    const src = cleanForSpeech(s.voice_text || '') || (s.caption_text || '')
    const cap = captionFromText(src)
    if (cap && cap !== s.caption_text) {
      await db.from('video_scenes').update({ caption_text: cap }).eq('id', s.id)
      updated++
    }
  }
  console.log(`captions her-schoond: ${updated}/${(scenes || []).length} scenes`)

  // Synchrone ondertiteling uit de echte voicetrack (whisper).
  const subBase = path.join(os.tmpdir(), `cf2-subs-${projectId}`)
  const sub = await generateSubtitles(voicePath, subBase, { language: 'en' })
  console.log('subtitles:', sub.srtPath ? ('OK ' + sub.srtPath) : ('FALLBACK (' + sub.reason + ')'))

  const format = (proj && proj.format) || '16:9'
  const r = await renderProject({ projectId, format, voicePath, musicPath: null, pacing: true, subtitlePath: sub.srtPath })
  const size = fs.existsSync(r.outputPath) ? (fs.statSync(r.outputPath).size / 1e6).toFixed(1) + ' MB' : 'ONTBREEKT'
  console.log('RENDER_OK:', r.outputPath, '|', r.renderedScenes + '/' + r.sceneCount, 'scenes |', size)
}
main().catch((e) => { console.error('RENDER_FAIL:', e && e.message ? e.message : e); process.exit(1) })
