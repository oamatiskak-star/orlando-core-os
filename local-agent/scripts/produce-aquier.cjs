/* eslint-disable */
/** Eenmalige Aquier-promo render via de echte keten (runShadowTopic, format_profile=aquier_promo).
 *  GEEN upload. Gebruik: node scripts/produce-aquier.cjs ["topic"] [yt_channel_id] [lang] */
require('dotenv/config')
const { runShadowTopic } = require('../dist/shadow-core')

const TOPIC = process.argv[2] || 'How real estate developers find off-market deals faster with AI'
const CH = process.argv[3] || '0b924f5b-f23f-4e5a-bb00-fe3d5911c925' // AquierTv
const LANG = process.argv[4] || 'en'

;(async () => {
  console.log('AQUIER-PROMO — topic:', TOPIC, '| lang:', LANG)
  const t0 = Date.now()
  const r = await runShadowTopic({
    channelId: CH, niche: LANG === 'es' ? 'real_estate_aquier_es' : 'real_estate_aquier_en',
    topic: TOPIC, language: LANG, format: '16:9', voice: 'default', targetSeconds: 90,
    lmStudioModel: process.env.LM_STUDIO_MODEL || 'default', ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
    formatProfile: 'aquier_promo', dataSymbols: [],
  })
  console.log(`KLAAR in ${Math.round((Date.now() - t0) / 1000)}s`)
  console.log(JSON.stringify({ projectId: r.projectId, title: r.title, scenes: r.sceneCount, voice: r.voiceProvider,
    visuals: r.visualsSelected, thumbnails: r.thumbnailVariants, renderUrl: r.renderUrl, cqi: r.cqi,
    gatePassed: r.gatePassed, status: r.status, reasons: r.reasons }, null, 2))
})().catch((e) => { console.error('FAIL:', e && e.stack ? e.stack : e); process.exit(1) })
