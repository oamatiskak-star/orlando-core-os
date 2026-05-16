/**
 * plan-ahead.ts — Eenmalig uitvoeren om specifieke dagen vol te plannen.
 * Maakt agent_tasks (claimed) + upload-slots aan per kanaal per dag.
 * Sla bestaande slots over om dubbelen te voorkomen.
 *
 * Gebruik: ts-node src/plan-ahead.ts 2026-05-15 2026-05-16 2026-05-17 2026-05-18
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── Kanaaldefinities ──────────────────────────────────────────────────────────
const CHANNELS = [
  {
    id: '810cdef3-e074-4c68-ace1-77afc5876b08', naam: 'VermogenTv',
    language: 'nl', voice: 'nl-NL-ColetteNeural', bg_color: '#1a1a2e',
    style: 'energiek, motiverend, financieel bewust', target_seconds: 480,
    slots: [
      { hour: 7,  type: 'longform' },
      { hour: 13, type: 'longform' },
      { hour: 18, type: 'short'    },
    ],
    topics: {
      longform: ['Passief inkomen opbouwen met ETFs — hoe begin je in 2026?','Hoe bouw je €100.000 vermogen op met €300 per maand?','Dividendaandelen voor beginners — stap voor stap uitgelegd','De kracht van rente op rente — 30 jaar compound interest','FIRE beweging Nederland — financieel onafhankelijk voor je 50ste','Index fondsen vs actief beleggen — welke wint op lange termijn?','Vermogensbelasting 2026 — alles wat je moet weten over box 3','Beleggen met €50 per maand — is het zinvol?','De beste beleggingsstrategie voor elke leeftijd uitgelegd','Hoe stel je een beleggingsportefeuille samen als beginner?','Groeiaandelen vs waardeaandelen — welke kies je in 2026?','Hoeveel geld heb je nodig om te stoppen met werken? Berekening','Van salarisslaf naar financieel vrij — 5 concrete stappen','DCA vs lump sum — maandelijks inleggen of alles tegelijk?','Vermogen beschermen in onzekere tijden — 5 strategieën'],
      short: ['1 tip: zo bespaar je €100 per maand zonder pijn','Rente op rente in 30 seconden uitgelegd','ETF kopen in 3 stappen — zo doe je het vandaag','De #1 reden waarom mensen nooit rijk worden','Passief inkomen: 3 manieren die écht werken','Index beleggen in 60 seconden uitgelegd','Compound interest — de 8e wereldwonder uitgelegd','3 fouten die beginners maken bij beleggen','Box 3 belasting 2026 — wat verandert er voor jou?','Dollar cost averaging in 45 seconden uitgelegd'],
    },
  },
  {
    id: '518ad29c-300f-4cad-9332-a32bb4736758', naam: 'VastgoedTv',
    language: 'nl', voice: 'nl-NL-ColetteNeural', bg_color: '#16213e',
    style: 'zakelijk, informatief, praktisch', target_seconds: 480,
    slots: [
      { hour: 9,  type: 'longform' },
      { hour: 15, type: 'short'    },
    ],
    topics: {
      longform: ['Vastgoed rendement berekenen — bruto vs netto yield uitgelegd','Je eerste huurwoning kopen in Nederland — stappenplan 2026','Splitsing van een pand — vergunning, kosten en rendement','BRRRR strategie voor de Nederlandse markt — stap voor stap','Kamerverhuur — vergunning, huurprijzen en rendement 2026','Hoe vind je vastgoed onder de marktwaarde in Nederland?','Vastgoed via een BV — wanneer loont het fiscaal?','Middenhuur regulering — impact op jouw beleggingspanden','Vastgoedportefeuille opschalen van 1 naar 5 panden','Kopen om te verhuren — is buy-to-let nog interessant in 2026?'],
      short: ['Huurrendement in 60 seconden berekend','BRRRR strategie in 45 seconden uitgelegd','3 redenen waarom vastgoed nog steeds loont in 2026','Kamerverhuur — zo verdien je €1500 extra per maand','5 fouten die vastgoedbeleggers maken','Zo vind je vastgoed onder marktwaarde','Middenhuur regulering uitgelegd in 1 minuut','Netto huurrendement berekenen — stap voor stap','Vastgoed in een BV of privé — snel uitgelegd','De 3 beste steden voor vastgoedinvestering in 2026'],
    },
  },
  {
    id: '41a8a5fb-d0f6-41c1-b474-f220a5650584', naam: 'BeleggingsTv',
    language: 'nl', voice: 'nl-NL-ColetteNeural', bg_color: '#0f3460',
    style: 'educatief, toegankelijk, data-gedreven', target_seconds: 420,
    slots: [
      { hour: 8,  type: 'longform' },
      { hour: 14, type: 'short'    },
    ],
    topics: {
      longform: ['ETF beleggen voor beginners — maandelijks inleggen uitgelegd','De beste ETFs op de Amsterdamse beurs in 2026 — analyse','Hoe kies je een broker? DeGiro vs IBKR vs Bux vergeleken','Aandelen selecteren — 5 criteria die elke belegger moet kennen','Obligaties uitgelegd — wanneer zijn ze interessant in 2026?','Dollar cost averaging — werkt het écht op lange termijn?','Koers-winstverhouding uitgelegd — zo waardeer je aandelen','Dividend beleggen — zo bouw je een inkomensstroom op','S&P 500 ETF kopen vanuit Nederland — zo doe je het','MSCI World vs All World — welke ETF is beter voor jou?'],
      short: ['ETF kopen in 3 stappen — zo doe je het vandaag','S&P 500 of MSCI World — welke kies jij?','DeGiro vs IBKR — snel vergeleken in 60 seconden','Dividend — passief inkomen uit aandelen uitgelegd','Rebalancing in 45 seconden uitgelegd','3 ETFs waarmee je de markt niet kunt missen','Technische analyse — dit moet je weten als beginner','Dollar cost averaging — waarom het werkt','Dit is het beste moment om te beginnen met beleggen','Groeiaandelen vs waardeaandelen — snel uitgelegd'],
    },
  },
  {
    id: '014e2bdf-f547-4587-b42d-15d4415747d9', naam: 'SpaarTv',
    language: 'nl', voice: 'nl-NL-MaartjeNeural', bg_color: '#065143',
    style: 'vriendelijk, praktisch, huishoudelijk financieel', target_seconds: 360,
    slots: [
      { hour: 10, type: 'longform' },
      { hour: 16, type: 'short'    },
    ],
    topics: {
      longform: ['Spaarrente vergelijken — de beste rekening in Nederland 2026','Hoe je €1000 extra spaart per jaar zonder het te merken','Inflatie en sparen — verlies je geld op een spaarrekening?','Budgetteren voor beginners — de 50/30/20 methode uitgelegd','Noodfonds opbouwen — hoeveel heb je nodig en hoe bouw je het?','Automatisch sparen instellen — zo begin je vandaag','Schulden afbetalen en toch kunnen sparen — strategie','Hypotheek aflossen of beleggen — wat is slimmer?','Belasting over je spaargeld in 2026 — wat betaal je?','Hoe zorg je dat je spaargeld niet wegrot door inflatie?'],
      short: ['Zo spaar je €100 per maand zonder het te merken','Beste spaarrente 2026 — welke bank wint?','Inflatie vreet je spaargeld — dit doe je eraan','Noodfonds — hoeveel heb je écht nodig?','50/30/20 budgetregel in 45 seconden uitgelegd','Automatisch sparen instellen — 2 minuten werk','Spaargeld in 2026 — belasting betaal je hierover','Depositorekening vs spaarrekening — snel vergeleken','Je budget bijhouden in 5 minuten per week','Zo herstel je snel van een financiële tegenvaller'],
    },
  },
  {
    id: '7a749f49-6b58-46c7-a867-fece37bc6743', naam: 'CryptoVermogen',
    language: 'nl', voice: 'nl-NL-ColetteNeural', bg_color: '#2d132c',
    style: 'dynamisch, actueel, risicobewust', target_seconds: 420,
    slots: [
      { hour: 7,  type: 'longform' },
      { hour: 13, type: 'longform' },
      { hour: 19, type: 'short'    },
    ],
    topics: {
      longform: ['Bitcoin kopen in 2026 — risico\'s en kansen voor beginners','Ethereum vs Bitcoin — welke crypto koop je in 2026?','DCA strategie voor crypto — zo bouw je slim een positie op','Crypto belasting Nederland 2026 — aangifte, box 3 en regels','Stablecoins uitgelegd — USDT vs USDC vs DAI vergeleken','DeFi voor beginners — rente verdienen op crypto','Bitcoin halving 2024 — langetermijneffect op de prijs','Crypto scams vermijden — 7 rode vlaggen die je moet kennen','Crypto portfolio samenstellen — hoeveel per munt?','Crypto exchanges vergelijken — Bitvavo vs Kraken vs Binance','Staking uitgelegd — passief inkomen met crypto','On-chain analyse voor beginners — tools en metrics','Crypto marktcycli — bull, bear en accumulation fase','Layer 2 oplossingen — Polygon, Arbitrum en Optimism uitgelegd','Regulering van crypto in Europa — MiCA wetgeving uitgelegd'],
      short: ['Bitcoin kopen in 3 stappen — zo doe je het','Crypto belasting 2026 — dit moet je weten','DCA in crypto — waarom het werkt','5 crypto scams die je moet kennen','Staking uitgelegd in 60 seconden','Wat is DeFi en waarom is het revolutionair?','De 3 beste crypto exchanges voor Nederlanders','Altcoins — hoe selecteer je de winnaars?','Layer 2 in 45 seconden uitgelegd','MiCA wetgeving — wat betekent dit voor jou?'],
    },
  },
  {
    id: 'dcf1b56e-3e06-404d-b508-1b747a4431dc', naam: 'PropertyInvestorTv',
    language: 'en', voice: 'en-GB-RyanNeural', bg_color: '#1b1f3b',
    style: 'professional, analytical, UK/EU property focused', target_seconds: 480,
    slots: [
      { hour: 8,  type: 'longform' },
      { hour: 16, type: 'short'    },
    ],
    topics: {
      longform: ['Buy-to-let property investment strategy UK — complete guide 2026','How to calculate rental yield on any property — step by step','HMO vs single let — which strategy generates more income in 2026?','Finding below market value properties — sourcing deals in the UK','Bridging finance explained — how to use it for property investment','Limited company vs personal name for buy-to-let — tax comparison','BRRRR strategy UK property — step by step with real numbers','Commercial to residential conversion — opportunities in 2026','Property due diligence checklist — 10 checks before you buy','How to scale from 1 to 10 properties systematically','Off-plan property investment — risks and rewards','Building a property business — from investor to developer','Property joint ventures — how to structure deals with investors','EPC ratings and energy efficiency requirements for landlords 2026','Permitted development rights — convert office to residential'],
      short: ['How to calculate rental yield in 60 seconds','BRRRR strategy explained simply','HMO vs single let — which makes more money?','3 mistakes new property investors make','How to find below market value deals','Bridging finance in 45 seconds explained','Buy-to-let in a limited company — yes or no?','Stamp duty — how much will you pay?','EPC rating — new rules for landlords in 2026','Social housing investment — guaranteed income explained'],
    },
  },
  {
    id: '0b924f5b-f23f-4e5a-bb00-fe3d5911c925', naam: 'AquierTv',
    language: 'nl', voice: 'nl-NL-MaartenNeural', bg_color: '#0d3347',
    style: 'zakelijk, strategisch, gericht op vastgoedacquisitie en dealflow', target_seconds: 480,
    slots: [
      { hour: 9,  type: 'longform' },
      { hour: 13, type: 'longform' },
      { hour: 17, type: 'short'    },
    ],
    topics: {
      longform: ['Vastgoed aankopen in Nederland — complete gids voor 2026','Off-market vastgoed vinden — zo doe je het zonder makelaar','De Aquier methode — slim aankopen zonder overbieden','Bieden onder vraagprijs — bewezen onderhandelingsstrategie','Vastgoed due diligence — 10 checks voor je bod uitbrengt','Bouwtechnische keuring — wat moet je weten voor aankoop?','Splitsingsvergunning aanvragen — zo vergroot je de waarde','Appartement vs eengezinswoning — welke investering wint in 2026?','Aankoopmakelaar vs zelf kopen — kosten en risico vergeleken','Hoe vind je een goede deal op Funda in een overboden markt?','Verhuurde woning aankopen — rendement en risico berekend','Veiling kopen in Nederland — kansen en valkuilen 2026','Financieringsvoorbehoud slim inzetten — bescherm je bod','Van bezichtiging tot sleuteloverdracht — het volledige koopproces','Erfpacht vs eigendom — wat koop je eigenlijk?'],
      short: ['Off-market deal vinden in 60 seconden — zo doe je het','3 fouten die kopers maken bij overbieden','Bieden onder vraagprijs — dit werkt écht','Bouwtechnische keuring — waarom het altijd loont','Splitsing aanvragen — zo verdien je €50.000 extra','Aquier — slim aankopen uitgelegd','Due diligence checklist voor vastgoedkopers','Funda alert instellen — zo mis je niks','Verhuurde woning kopen — rendement berekenen','Veiling kopen — dit moet je weten'],
    },
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7))
  return d.toISOString().split('T')[0]
}

function pickTopic(pool: string[], usedThisRun: Set<string>): string {
  const fresh = pool.filter(t => !usedThisRun.has(t))
  const src = fresh.length > 0 ? fresh : pool
  return src[Math.floor(Math.random() * src.length)]
}

async function slotExists(channelId: string, publishAt: Date): Promise<boolean> {
  const { count } = await db
    .from('youtube_upload_queue')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .eq('scheduled_publish_at', publishAt.toISOString())
    .not('status', 'in', '("failed")')
  return (count ?? 0) > 0
}

async function taskExistsForSlot(channelId: string, dateStr: string, hour: number): Promise<boolean> {
  // rough check: any claimed/running task created for this channel on this date
  const dayStart = `${dateStr}T00:00:00Z`
  const dayEnd   = `${dateStr}T23:59:59Z`
  const { count } = await db
    .from('youtube_upload_queue')
    .select('*', { count: 'exact', head: true })
    .eq('channel_id', channelId)
    .gte('scheduled_publish_at', dayStart)
    .lte('scheduled_publish_at', dayEnd)
    .eq('scheduled_publish_at', new Date(`${dateStr}T${String(hour).padStart(2,'0')}:00:00Z`).toISOString())
    .not('status', 'in', '("failed")')
  return (count ?? 0) > 0
}

// ── Core: plan één kanaal op één dag ─────────────────────────────────────────
async function planChannelDay(
  ch: typeof CHANNELS[0],
  dateStr: string,
  usedTopics: Set<string>,
): Promise<number> {
  let created = 0

  for (const slot of ch.slots) {
    const publishAt = new Date(`${dateStr}T${String(slot.hour).padStart(2,'0')}:00:00Z`)

    // Skip als slot al bestaat
    if (await slotExists(ch.id, publishAt)) {
      console.log(`  ✓ bestaand: ${ch.naam} @ ${publishAt.toUTCString()}`)
      continue
    }

    const videoType  = slot.type as 'longform' | 'short'
    const topic      = pickTopic(ch.topics[videoType], usedTopics)
    usedTopics.add(topic)

    const calendarId = randomUUID()
    const taskId     = randomUUID()

    // Calendar entry
    await db.from('yt_content_calendar').insert({
      id:           calendarId,
      channel_id:   ch.id,
      week_start:   weekStart(dateStr),
      publish_date: dateStr,
      video_type:   videoType,
      status:       'planned',
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    })

    // Agent task — status 'claimed' zodat Python executor het overslaat
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
        ollama_model:    process.env.OLLAMA_MODEL    ?? 'llama3:latest',
        lm_studio_model: process.env.LM_STUDIO_MODEL ?? 'default',
        voice:           ch.voice,
        bg_color:        ch.bg_color,
        publish_date:    dateStr,
      },
      created_at: new Date().toISOString(),
    })

    // Upload slot — direct in de queue, wacht op video
    await db.from('youtube_upload_queue').insert({
      channel_id:           ch.id,
      status:               'planned',
      scheduled_publish_at: publishAt.toISOString(),
      priority:             5,
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    })

    console.log(`  + ${ch.naam} [${videoType}] ${publishAt.toUTCString()} — "${topic.slice(0, 55)}"`)
    created++
  }

  return created
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const dates = process.argv.slice(2)
  if (!dates.length) {
    console.error('Gebruik: ts-node src/plan-ahead.ts YYYY-MM-DD [YYYY-MM-DD ...]')
    process.exit(1)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Orlando — Plan Ahead')
  console.log(`  Dagen: ${dates.join(', ')}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  let totalCreated = 0

  for (const dateStr of dates) {
    console.log(`\n📅 ${dateStr}`)
    const usedTopics = new Set<string>()

    for (const ch of CHANNELS) {
      const n = await planChannelDay(ch, dateStr, usedTopics)
      totalCreated += n
    }
  }

  console.log(`\n✓ Klaar — ${totalCreated} nieuwe taken + slots aangemaakt`)
}

main().catch(err => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
