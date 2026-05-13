import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const CHANNELS = [
  {
    id: '810cdef3-e074-4c68-ace1-77afc5876b08', naam: 'VermogenTv',
    language: 'nl', voice: 'nl-NL-ColetteNeural', bg_color: '#1a1a2e',
    style: 'energiek, motiverend, financieel bewust', target_seconds: 480,
    topics: [
      'passief inkomen opbouwen met ETFs in 2026',
      'hoe je vermogen opbouwt met €200 per maand',
      'dividendaandelen voor beginners — stap voor stap',
      'de kracht van rente op rente — uitgelegd in 5 minuten',
      'FIRE beweging — financieel onafhankelijk worden in Nederland',
      'index fondsen vs actief beleggen — wat werkt beter?',
      'hoe ik mijn eerste €10.000 heb gespaard en belegd',
      'vermogensbelasting 2026 — wat verandert er?',
      'beleggen met weinig geld — is het zinvol?',
      'de beste beleggingsstrategie voor jouw leeftijd',
    ],
  },
  {
    id: '518ad29c-300f-4cad-9332-a32bb4736758', naam: 'VastgoedTv',
    language: 'nl', voice: 'nl-NL-ColetteNeural', bg_color: '#16213e',
    style: 'zakelijk, informatief, praktisch', target_seconds: 480,
    topics: [
      'vastgoed rendement berekenen voor beginners',
      'hoe je je eerste huurwoning koopt in Nederland 2026',
      'splitsing van een pand — stappenplan en kosten',
      'verduurzamen en verhuren — rendement vs investering',
      'kopen om te verhuren — is het nog interessant in 2026?',
      'vastgoed financieren zonder eigen geld — is het mogelijk?',
      'hoe werkt een BOG aankoopstrategie?',
      'box 3 en vastgoed — belasting optimaliseren 2026',
      'BRRRR strategie uitgelegd voor Nederlandse markt',
      'leegstand omzetten naar kamerverhuur — zo doe je dat',
    ],
  },
  {
    id: '41a8a5fb-d0f6-41c1-b474-f220a5650584', naam: 'BeleggingsTv',
    language: 'nl', voice: 'nl-NL-ColetteNeural', bg_color: '#0f3460',
    style: 'educatief, toegankelijk, data-gedreven', target_seconds: 420,
    topics: [
      'ETF beleggen voor beginners — maandelijks inleggen',
      'de beste ETFs op de Amsterdam beurs in 2026',
      'hoe werkt een broker — vergelijking DeGiro vs IBKR',
      'aandelen kiezen — 5 criteria voor beginners',
      'obligaties uitgelegd — wanneer zijn ze interessant?',
      'groei vs waarde beleggen — wat is beter?',
      'beleggingsfondsen vs ETFs — het verschil uitgelegd',
      'technische analyse voor beginners — RSI en MACD',
      'dollar cost averaging — werkt het écht?',
      'wat is een koers-winstverhouding en hoe gebruik je die?',
    ],
  },
  {
    id: '014e2bdf-f547-4587-b42d-15d4415747d9', naam: 'SpaarTv',
    language: 'nl', voice: 'nl-NL-MaartjeNeural', bg_color: '#065143',
    style: 'vriendelijk, praktisch, huishoudelijk financieel', target_seconds: 360,
    topics: [
      'spaarrente vergelijken — beste rekening 2026',
      'hoe je €1000 extra spaart per jaar zonder het te merken',
      'inflatie en sparen — verlies je geld op een spaarrekening?',
      'budgetteren voor beginners — de 50/30/20 regel',
      'noodfonds opbouwen — hoeveel heb je nodig?',
      'spaarrekening vs beleggen — wat kies je?',
      'automatisch sparen instellen — zo begin je vandaag',
      'energiekosten besparen in 2026 — praktische tips',
      'hoe je schulden aflost en toch kunt sparen',
      'kinderspaarrekening — de beste opties in Nederland',
    ],
  },
  {
    id: '7a749f49-6b58-46c7-a867-fece37bc6743', naam: 'CryptoVermogen',
    language: 'nl', voice: 'nl-NL-ColetteNeural', bg_color: '#2d132c',
    style: 'dynamisch, actueel, risicobewust', target_seconds: 420,
    topics: [
      'bitcoin kopen in 2026 — risico en kansen',
      'ethereum vs bitcoin — welke koop je in 2026?',
      'DCA strategie voor crypto — zo bouw je positie op',
      'crypto belasting Nederland 2026 — wat je moet weten',
      'altcoins — top 5 projecten om in de gaten te houden',
      'stablecoins uitgelegd — USDT vs USDC vs DAI',
      'crypto wallet setup — hardware vs software',
      'DeFi voor beginners — rente verdienen op crypto',
      'bitcoin halving effect — wat betekent het voor prijs?',
      'crypto scams vermijden — 7 rode vlaggen',
    ],
  },
  {
    id: 'dcf1b56e-3e06-404d-b508-1b747a4431dc', naam: 'PropertyInvestorTv',
    language: 'en', voice: 'en-GB-RyanNeural', bg_color: '#1b1f3b',
    style: 'professional, analytical, UK/EU property focused', target_seconds: 480,
    topics: [
      'buy-to-let property investment strategy 2026',
      'how to calculate rental yield on any property',
      'HMO vs single let — which strategy wins in 2026',
      'property sourcing deals — finding below market value',
      'bridging finance explained for property investors',
      'limited company vs personal name for buy-to-let',
      'BRRRR strategy step by step — UK property edition',
      'commercial to residential conversion opportunities',
      'property due diligence checklist — 10 critical checks',
      'how to scale from 1 to 10 properties systematically',
    ],
  },
]

// Extra upload slots for channels that only have 1/day
const EXTRA_SLOTS: { channel_id: string; times: string[] }[] = [
  { channel_id: '518ad29c-300f-4cad-9332-a32bb4736758', times: ['2026-05-14 15:00:00+00', '2026-05-14 19:00:00+00', '2026-05-15 15:00:00+00', '2026-05-15 19:00:00+00'] },
  { channel_id: '41a8a5fb-d0f6-41c1-b474-f220a5650584', times: ['2026-05-14 09:00:00+00', '2026-05-14 19:00:00+00', '2026-05-15 09:00:00+00', '2026-05-15 19:00:00+00'] },
  { channel_id: '014e2bdf-f547-4587-b42d-15d4415747d9', times: ['2026-05-14 15:00:00+00', '2026-05-14 19:00:00+00', '2026-05-15 15:00:00+00', '2026-05-15 19:00:00+00'] },
  { channel_id: '7a749f49-6b58-46c7-a867-fece37bc6743', times: ['2026-05-14 08:00:00+00', '2026-05-14 19:00:00+00', '2026-05-15 08:00:00+00', '2026-05-15 19:00:00+00'] },
]

// 3 topics per channel per day: indices [0,1,2] for day1, [3,4,5] for day2
const DAYS = [
  { date: '2026-05-14', topicOffset: 0 },
  { date: '2026-05-15', topicOffset: 3 },
]

async function addExtraSlots() {
  console.log('\nExtra upload slots toevoegen...')
  for (const s of EXTRA_SLOTS) {
    for (const t of s.times) {
      const { error } = await db.from('youtube_upload_queue').insert({
        id: randomUUID(),
        channel_id: s.channel_id,
        scheduled_publish_at: t,
        status: 'planned',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      if (error) console.warn(`  Slot skip (${t}): ${error.message}`)
      else console.log(`  + slot ${t}`)
    }
  }
}

async function createTasks() {
  console.log('\nGeneratietaken aanmaken...')
  let total = 0

  for (const day of DAYS) {
    for (const ch of CHANNELS) {
      const topicsForDay = ch.topics.slice(day.topicOffset, day.topicOffset + 3)
      const types: Array<'longform' | 'short'> = ['longform', 'longform', 'short']

      for (let i = 0; i < topicsForDay.length; i++) {
        const topic = topicsForDay[i]
        const videoType = types[i]
        const calendarId = randomUUID()
        const taskId = randomUUID()

        await db.from('yt_content_calendar').insert({
          id: calendarId,
          channel_id: ch.id,
          publish_date: day.date,
          video_type: videoType,
          status: 'planned',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        await db.from('agent_tasks').insert({
          id: taskId,
          task_type: 'generate_content',
          status: 'pending',
          priority: videoType === 'longform' ? 5 : 4,
          payload: {
            channel_name:    ch.naam,
            channel_id:      ch.id,
            topic,
            video_type:      videoType,
            calendar_id:     calendarId,
            language:        ch.language,
            style:           ch.style,
            target_seconds:  videoType === 'short' ? 58 : ch.target_seconds,
            ollama_model:    'llama3:latest',
            lm_studio_model: 'default',
            voice:           ch.voice,
            bg_color:        ch.bg_color,
            publish_date:    day.date,
          },
          created_at: new Date().toISOString(),
        })

        console.log(`  [${day.date}] ${ch.naam} ${videoType}: "${topic}"`)
        total++
      }
    }
  }

  console.log(`\n✓ ${total} taken aangemaakt`)
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Orlando Batch Content Scheduler')
  console.log('  14 + 15 mei 2026 — 3 videos/kanaal/dag')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await addExtraSlots()
  await createTasks()

  console.log('\nKlaar! Local-agent verwerkt taken automatisch.')
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1) })
