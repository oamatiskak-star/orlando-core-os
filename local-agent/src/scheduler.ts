import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

interface ChannelConfig {
  id:           string
  naam:         string
  language:     string
  voice:        string
  bg_color:     string
  style:        string
  target_seconds: number
  topics:       string[]
}

const CHANNELS: ChannelConfig[] = [
  {
    id:             '810cdef3-e074-4c68-ace1-77afc5876b08',
    naam:           'VermogenTv',
    language:       'nl',
    voice:          'nl-NL-ColetteNeural',
    bg_color:       '#1a1a2e',
    style:          'energiek, motiverend, financieel bewust',
    target_seconds: 480,
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
    id:             '518ad29c-300f-4cad-9332-a32bb4736758',
    naam:           'VastgoedTv',
    language:       'nl',
    voice:          'nl-NL-ColetteNeural',
    bg_color:       '#16213e',
    style:          'zakelijk, informatief, praktisch',
    target_seconds: 480,
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
    id:             '41a8a5fb-d0f6-41c1-b474-f220a5650584',
    naam:           'BeleggingsTv',
    language:       'nl',
    voice:          'nl-NL-ColetteNeural',
    bg_color:       '#0f3460',
    style:          'educatief, toegankelijk, data-gedreven',
    target_seconds: 420,
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
    id:             '014e2bdf-f547-4587-b42d-15d4415747d9',
    naam:           'SpaarTv',
    language:       'nl',
    voice:          'nl-NL-MaartjeNeural',
    bg_color:       '#065143',
    style:          'vriendelijk, praktisch, huishoudelijk financieel',
    target_seconds: 360,
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
    id:             '7a749f49-6b58-46c7-a867-fece37bc6743',
    naam:           'CryptoVermogen',
    language:       'nl',
    voice:          'nl-NL-ColetteNeural',
    bg_color:       '#2d132c',
    style:          'dynamisch, actueel, risicobewust',
    target_seconds: 420,
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
    id:             'dcf1b56e-3e06-404d-b508-1b747a4431dc',
    naam:           'PropertyInvestorTv',
    language:       'en',
    voice:          'en-GB-RyanNeural',
    bg_color:       '#1b1f3b',
    style:          'professional, analytical, UK/EU property focused',
    target_seconds: 480,
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
  {
    id:             '0b924f5b-f23f-4e5a-bb00-fe3d5911c925',
    naam:           'AquierTv',
    language:       'nl',
    voice:          'nl-NL-MaartenNeural',
    bg_color:       '#0d3347',
    style:          'zakelijk, strategisch, gericht op vastgoedacquisitie en dealflow',
    target_seconds: 480,
    topics: [
      'vastgoed aankopen in Nederland — stap voor stap als beginner',
      'off-market vastgoed vinden — zo doe je het in 2026',
      'de Aquier methode — slim aankopen zonder overbieden',
      'bieden onder vraagprijs — onderhandelingsstrategie voor kopers',
      'vastgoed due diligence checklist — 10 punten voor je bod',
      'bouwtechnische keuring — wat moet je weten voor aankoop?',
      'NVM aankoopmakelaar vs zelf aankopen — wat is slimmer?',
      'appartement vs eengezinswoning als investering in 2026',
      'hoe scoor je een goede deal op Funda in een overboden markt?',
      'splitsingsvergunning aanvragen — zo vergroot je de waarde',
    ],
  },
]

function pickTopic(topics: string[], date: Date): string {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86_400_000
  )
  return topics[dayOfYear % topics.length]
}

async function scheduleDay(targetDate: Date): Promise<void> {
  const dateStr = targetDate.toISOString().split('T')[0]
  console.log(`\nScheduling content for ${dateStr}...`)

  for (const ch of CHANNELS) {
    // Check if tasks already exist for this channel + date
    const { data: existing } = await db
      .from('agent_tasks')
      .select('id')
      .eq('task_type', 'generate_content')
      .contains('payload', { channel_id: ch.id })
      .gte('created_at', `${dateStr}T00:00:00Z`)
      .lte('created_at', `${dateStr}T23:59:59Z`)

    if (existing && existing.length >= 2) {
      console.log(`  ✓ ${ch.naam}: al gepland`)
      continue
    }

    const topic = pickTopic(ch.topics, targetDate)

    for (const videoType of ['longform', 'short'] as const) {
      const calendarId = randomUUID()
      const taskId     = randomUUID()

      // Create calendar entry
      await db.from('yt_content_calendar').insert({
        id:          calendarId,
        channel_id:  ch.id,
        publish_date: dateStr,
        video_type:  videoType,
        status:      'planned',
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      })

      // Create agent task
      await db.from('agent_tasks').insert({
        id:        taskId,
        task_type: 'generate_content',
        status:    'claimed',
        priority:  videoType === 'longform' ? 5 : 4,
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
          publish_date:    dateStr,
        },
        created_at:  new Date().toISOString(),
      })

      console.log(`  + ${ch.naam} ${videoType}: "${topic}"`)
    }
  }

  console.log(`\nKlaar! ${CHANNELS.length * 2} taken aangemaakt voor ${dateStr}`)
}

async function main() {
  const args = process.argv.slice(2)
  const targetDate = args[0] ? new Date(args[0]) : new Date()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Orlando Daily Content Scheduler')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await scheduleDay(targetDate)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
