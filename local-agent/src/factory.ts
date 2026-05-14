import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const FACTORY_INTERVAL_MS = 20 * 60 * 1000
const BUFFER_DAYS         = 2
const RECENT_TOPIC_WINDOW = 30  // avoid repeating last N topics per channel

type ChannelConfig = {
  id:                string
  naam:              string
  language:          'nl' | 'en'
  voice:             string
  bg_color:          string
  style:             string
  target_seconds:    number
  videos_per_day:    number
  publish_hours_utc: number[]
  topics: {
    longform: string[]
    short:    string[]
  }
}

const CHANNELS: ChannelConfig[] = [
  {
    id:                '810cdef3-e074-4c68-ace1-77afc5876b08',
    naam:              'VermogenTv',
    language:          'nl',
    voice:             'nl-NL-ColetteNeural',
    bg_color:          '#1a1a2e',
    style:             'energiek, motiverend, financieel bewust',
    target_seconds:    480,
    videos_per_day:    3,
    publish_hours_utc: [7, 13, 18],
    topics: {
      longform: [
        'Passief inkomen opbouwen met ETFs — hoe begin je in 2026?',
        'Hoe bouw je €100.000 vermogen op met €300 per maand?',
        'Dividendaandelen voor beginners — stap voor stap uitgelegd',
        'De kracht van rente op rente — 30 jaar compound interest',
        'FIRE beweging Nederland — financieel onafhankelijk voor je 50ste',
        'Index fondsen vs actief beleggen — welke wint op lange termijn?',
        'Vermogensbelasting 2026 — alles wat je moet weten over box 3',
        'Beleggen met €50 per maand — is het zinvol?',
        'De beste beleggingsstrategie voor elke leeftijd uitgelegd',
        'Hoe stel je een beleggingsportefeuille samen als beginner?',
        'Warren Buffett strategie — wat kunnen Nederlanders hiervan leren?',
        'Aandelen vs vastgoed vs crypto — welke geeft het beste rendement?',
        'Belastingoptimalisatie voor beleggers in Nederland 2026',
        'Risicospreiding bij beleggen — hoe diversifieer je slim?',
        'Pensioen opbouwen naast je AOW — de beste opties in 2026',
        'Inflatie verslaan met je beleggingen — concrete strategie',
        'De psychologie van beleggen — waarom nemen we slechte beslissingen?',
        'Automatisch vermogen opbouwen — set it and forget it strategie',
        'Small cap aandelen — hoger rendement of hoger risico?',
        'Sector rotatie — wanneer schakel je tussen sectoren?',
        'Obligaties als aanvulling op je aandelenportefeuille',
        'ESG beleggen — groen en toch rendabel in 2026?',
        'Hoe overleef je een beurscrash — lessen uit 2020 en 2022',
        'DCA vs lump sum — maandelijks inleggen of alles tegelijk?',
        'Vermogen beschermen in onzekere tijden — 5 strategieën',
        'Van salarisslaf naar financieel vrij — 5 concrete stappen',
        'Hoe lees je een jaarverslag? Aandelen analyseren voor beginners',
        'Valutarisico bij internationaal beleggen — hoe beheers je dit?',
        'Groeiaandelen vs waardeaandelen — welke kies je in 2026?',
        'Hoeveel geld heb je nodig om te stoppen met werken? Berekening',
      ],
      short: [
        '1 tip: zo bespaar je €100 per maand zonder pijn',
        'Rente op rente in 30 seconden uitgelegd',
        'ETF kopen in 3 stappen — zo doe je het vandaag',
        '€100 belegd 10 jaar geleden — wat is het nu waard?',
        'De #1 reden waarom mensen nooit rijk worden',
        'Zo verdien je geld terwijl je slaapt — passief inkomen',
        'Passief inkomen: 3 manieren die écht werken',
        'Dit maakt het verschil tussen rijk en niet rijk worden',
        'Index beleggen in 60 seconden uitgelegd',
        'Je eerste aandeel kopen — zo simpel is het',
        'Dividendaandelen — geld ontvangen zonder te verkopen',
        'Inflatiebestendig beleggen — 3 opties die werken',
        'Beleggen vs sparen — de harde cijfers vergeleken',
        'Compound interest — de 8e wereldwonder uitgelegd',
        'Hoe rijke mensen anders denken over geld',
        'Het probleem met een spaarrekening in 2026',
        '3 fouten die beginners maken bij beleggen',
        'Dollar cost averaging in 45 seconden uitgelegd',
        'Waarom €50 per maand meer waard is dan je denkt',
        'Box 3 belasting 2026 — wat verandert er voor jou?',
      ],
    },
  },
  {
    id:                '518ad29c-300f-4cad-9332-a32bb4736758',
    naam:              'VastgoedTv',
    language:          'nl',
    voice:             'nl-NL-ColetteNeural',
    bg_color:          '#16213e',
    style:             'zakelijk, informatief, praktisch',
    target_seconds:    480,
    videos_per_day:    2,
    publish_hours_utc: [9, 15],
    topics: {
      longform: [
        'Vastgoed rendement berekenen — bruto vs netto yield uitgelegd',
        'Je eerste huurwoning kopen in Nederland — stappenplan 2026',
        'Splitsing van een pand — vergunning, kosten en rendement',
        'Verduurzamen en verhuren — rendement vs investering berekend',
        'Kopen om te verhuren — is buy-to-let nog interessant in 2026?',
        'Vastgoed financieren zonder eigen geld — is het mogelijk?',
        'BOG aankoopstrategie — zo koop je bedrijfspanden slim',
        'Box 3 en vastgoed — belasting optimaliseren in 2026',
        'BRRRR strategie voor de Nederlandse markt — stap voor stap',
        'Kamerverhuur — vergunning, huurprijzen en rendement 2026',
        'Hoe vind je vastgoed onder de marktwaarde in Nederland?',
        'Vastgoed via een BV — wanneer loont het fiscaal?',
        'VvE beheer en kosten — wat elke verhuurder moet weten',
        'Hypotheek voor beleggingspand — voorwaarden en rente 2026',
        'Overdrachtsbelasting 2026 — alles voor vastgoedbeleggers',
        'Middenhuur regulering — impact op jouw beleggingspanden',
        'Leegstaand pand kopen en omzetten — zo pak je het aan',
        'Onderhoud en beheer uitbesteden vs zelf doen — de cijfers',
        'Vastgoed in het buitenland — kansen en risico\'s voor Nederlanders',
        'Huurprijsverhoging 2026 — wat mag je als verhuurder vragen?',
        'Anti-speculatiebeding en zelfbewoningsplicht — wat zijn de regels?',
        'Erfpacht vs eigendomsgrond — impact op vastgoedinvestering',
        'Woningsplitsing in Utrecht, Amsterdam, Rotterdam — kansen per stad',
        'Studentenverhuur vs gezinsverhuur — rendement vergeleken',
        'Duurzaam vastgoed — energielabels en subsidies in 2026',
        'Vastgoed crowdfunding — alternatief voor direct beleggen?',
        'Huurder niet betaalt — wat zijn je rechten als verhuurder?',
        'Vastgoedportefeuille opschalen van 1 naar 5 panden',
        'NVM-makelaar vs zonder makelaar kopen — voor- en nadelen',
        'Aankoopbegeleiding vastgoed — wanneer huur je een specialist?',
      ],
      short: [
        'Huurrendement in 60 seconden berekend',
        'BRRRR strategie in 45 seconden uitgelegd',
        '3 redenen waarom vastgoed nog steeds loont in 2026',
        'Kamerverhuur — zo verdien je €1500 extra per maand',
        'Dit is waarom huurprijzen blijven stijgen in Nederland',
        'Splitsing van een pand — zo verdubbel je je rendement',
        'Vastgoed vs aandelen — wie wint op 20 jaar?',
        'Hoe ik mijn eerste huurwoning kocht met weinig eigen geld',
        'Middenhuur regulering uitgelegd in 1 minuut',
        '5 fouten die vastgoedbeleggers maken',
        'Zo vind je vastgoed onder marktwaarde',
        'Box 3 en verhuurpanden — wat verandert er in 2026?',
        'Netto huurrendement berekenen — stap voor stap',
        'Leegstand omzetten naar huurinkomsten — zo doe je dat',
        'Verduurzamen loont — zonnepanelen op je huurpand',
        'Wat is een goede huurprijs voor jouw woning?',
        'Anti-speculatiebeding uitgelegd in 30 seconden',
        'Vastgoed in een BV of privé — snel uitgelegd',
        'Studentenverhuur — zo haal je maximaal rendement',
        'De 3 beste steden voor vastgoedinvestering in 2026',
      ],
    },
  },
  {
    id:                '41a8a5fb-d0f6-41c1-b474-f220a5650584',
    naam:              'BeleggingsTv',
    language:          'nl',
    voice:             'nl-NL-ColetteNeural',
    bg_color:          '#0f3460',
    style:             'educatief, toegankelijk, data-gedreven',
    target_seconds:    420,
    videos_per_day:    2,
    publish_hours_utc: [8, 14],
    topics: {
      longform: [
        'ETF beleggen voor beginners — maandelijks inleggen uitgelegd',
        'De beste ETFs op de Amsterdamse beurs in 2026 — analyse',
        'Hoe kies je een broker? DeGiro vs IBKR vs Bux vergeleken',
        'Aandelen selecteren — 5 criteria die elke belegger moet kennen',
        'Obligaties uitgelegd — wanneer zijn ze interessant in 2026?',
        'Groeiaandelen vs waardeaandelen — welke strategie is beter?',
        'Beleggingsfondsen vs ETFs — het verschil voor beginners',
        'Technische analyse voor beginners — RSI, MACD en trendlijnen',
        'Dollar cost averaging — werkt het écht op lange termijn?',
        'Koers-winstverhouding uitgelegd — zo waardeer je aandelen',
        'Dividend beleggen — zo bouw je een inkomensstroom op',
        'S&P 500 ETF kopen vanuit Nederland — zo doe je het',
        'Emerging markets beleggen — kansen en risico\'s in 2026',
        'Sector ETFs vs brede index — wanneer kies je wat?',
        'Rebalancing van je portefeuille — wanneer en hoe?',
        'Beleggingsrisico meten — volatiliteit, beta en sharpe ratio',
        'Hoe werkt een aandelenkoers — vraag en aanbod uitgelegd',
        'IPO beleggen — kansen en valkuilen bij beursintroducties',
        'Short selling uitgelegd — speculeren op koersdalingen',
        'Opties voor beginners — calls, puts en basisstrategieën',
        'Rendement na belasting berekenen — box 3 vs box 1',
        'Cryptocurrency als deel van je beleggingsportefeuille',
        'Factor beleggen — waarde, momentum en kwaliteit uitgelegd',
        'MSCI World vs All World — welke ETF is beter voor jou?',
        'Automatisch herbalanceren — tools en strategieën',
        'Hoe lees je een ETF factsheet? Alle termen uitgelegd',
        'Beleggen voor je kind — spaarrekening vs junior beleggingsrekening',
        'Impact van kosten op je rendement — TER en verborgen fees',
        'Wat is een dividendbelasting en hoe krijg je het terug?',
        'Portefeuille optimaliseren voor pensioen — glide path strategie',
      ],
      short: [
        'ETF kopen in 3 stappen — zo doe je het vandaag',
        'S&P 500 of MSCI World — welke kies jij?',
        'Dit is waarom de meeste beleggers verliezen van een index',
        'DeGiro vs IBKR — snel vergeleken in 60 seconden',
        'Dividend — passief inkomen uit aandelen uitgelegd',
        'De P/E ratio in 30 seconden uitgelegd',
        'Obligaties zijn terug — hier is waarom',
        'Zo beleg je €100 per maand slim',
        '3 ETFs waarmee je de markt niet kunt missen',
        'Rebalancing in 45 seconden uitgelegd',
        'Wat is een TER en waarom maakt het uit?',
        'Technische analyse — dit moet je weten als beginner',
        'RSI indicator in 60 seconden uitgelegd',
        'Emerging markets — risico of kans in 2026?',
        'Zo bescherm je je portefeuille tegen een crash',
        'Dollar cost averaging — waarom het werkt',
        'Dit is het beste moment om te beginnen met beleggen',
        'Hoe werkt een aandelenkoers?',
        'Groeiaandelen vs waardeaandelen — snel uitgelegd',
        'Beleggen voor je kind — zo begin je vandaag',
      ],
    },
  },
  {
    id:                '014e2bdf-f547-4587-b42d-15d4415747d9',
    naam:              'SpaarTv',
    language:          'nl',
    voice:             'nl-NL-MaartjeNeural',
    bg_color:          '#065143',
    style:             'vriendelijk, praktisch, huishoudelijk financieel',
    target_seconds:    360,
    videos_per_day:    2,
    publish_hours_utc: [10, 16],
    topics: {
      longform: [
        'Spaarrente vergelijken — de beste rekening in Nederland 2026',
        'Hoe je €1000 extra spaart per jaar zonder het te merken',
        'Inflatie en sparen — verlies je geld op een spaarrekening?',
        'Budgetteren voor beginners — de 50/30/20 methode uitgelegd',
        'Noodfonds opbouwen — hoeveel heb je nodig en hoe bouw je het?',
        'Spaarrekening vs beleggingsrekening — wat kies je?',
        'Automatisch sparen instellen — zo begin je vandaag',
        'Energiekosten besparen in 2026 — 10 praktische tips',
        'Schulden afbetalen en toch kunnen sparen — strategie',
        'Kinderspaarrekening — de beste opties in Nederland vergeleken',
        'Hoe werkt een depositorekening en wanneer is het slim?',
        'Groen sparen — spaarrekeningen met maatschappelijk rendement',
        'Boodschappen besparen — zo snijd je €200 per maand',
        'Hypotheek aflossen of beleggen — wat is slimmer?',
        'Abonnementen opruimen — zo bespaar je direct €100 per maand',
        'De beste spaarapps voor Nederland in 2026 vergeleken',
        'Spaardoelen stellen — zo werkt het echt',
        'Belasting over je spaargeld in 2026 — wat betaal je?',
        'Hoe zorg je dat je spaargeld niet wegrot door inflatie?',
        'Gezamenlijk sparen als stel — praktische tips en afspraken',
        'Zakgeld vs spaarrente voor kinderen — de beste aanpak',
        'Maandbudget maken — template en tools uitgelegd',
        'Cashback en spaaracties — echt de moeite waard?',
        'High yield spaarrekening in het buitenland — legaal en slim?',
        'Pensioen aanvullen via sparen — hoeveel heb je tekort?',
        'Besparen op auto — verzekering, lease vs kopen uitgelegd',
        'Vakantiesparen — slimme manieren om vooruit te betalen',
        'Hoe herstel je van financiële tegenslagen — stappenplan',
        'Spaargeld veilig houden — depositogarantiestelsel uitgelegd',
        'Zelfstandigen en sparen — pensioen en buffers als zzp\'er',
      ],
      short: [
        'Zo spaar je €100 per maand zonder het te merken',
        'Beste spaarrente 2026 — welke bank wint?',
        'Inflatie vreet je spaargeld — dit doe je eraan',
        'Noodfonds — hoeveel heb je écht nodig?',
        '50/30/20 budgetregel in 45 seconden uitgelegd',
        'Zo bespaar je direct €50 per maand op boodschappen',
        'Automatisch sparen instellen — 2 minuten werk',
        '3 abonnementen die je nu kunt opzeggen',
        'Spaargeld in 2026 — belasting betaal je hierover',
        'Depositorekening vs spaarrekening — snel vergeleken',
        'Waarom een noodfonds je leven verandert',
        'Hoe je €1000 spaart in 3 maanden',
        'Gezamenlijke rekening als stel — wel of niet?',
        'Cashback apps die écht geld opleveren',
        'Je budget bijhouden in 5 minuten per week',
        'Zo herstel je snel van een financiële tegenvaller',
        'Kinderspaarrekening — start vandaag',
        'Hypotheek extra aflossen vs sparen — het antwoord',
        'Groen sparen — goed voor planeet én portemonnee',
        'Zo spaart een zzp\'er voor zijn pensioen',
      ],
    },
  },
  {
    id:                '7a749f49-6b58-46c7-a867-fece37bc6743',
    naam:              'CryptoVermogen',
    language:          'nl',
    voice:             'nl-NL-ColetteNeural',
    bg_color:          '#2d132c',
    style:             'dynamisch, actueel, risicobewust',
    target_seconds:    420,
    videos_per_day:    3,
    publish_hours_utc: [7, 13, 19],
    topics: {
      longform: [
        'Bitcoin kopen in 2026 — risico\'s en kansen voor beginners',
        'Ethereum vs Bitcoin — welke crypto koop je in 2026?',
        'DCA strategie voor crypto — zo bouw je slim een positie op',
        'Crypto belasting Nederland 2026 — aangifte, box 3 en regels',
        'Top altcoins 2026 — 5 projecten om in de gaten te houden',
        'Stablecoins uitgelegd — USDT vs USDC vs DAI vergeleken',
        'Crypto wallet setup — hardware vs software wallet',
        'DeFi voor beginners — rente verdienen op crypto',
        'Bitcoin halving 2024 — langetermijneffect op de prijs',
        'Crypto scams vermijden — 7 rode vlaggen die je moet kennen',
        'NFTs in 2026 — hype voorbij of nog kansen?',
        'Layer 2 oplossingen — Polygon, Arbitrum en Optimism uitgelegd',
        'Crypto portfolio samenstellen — hoeveel per munt?',
        'Bitcoin maximalist vs altcoin belegger — wie heeft gelijk?',
        'Crypto exchanges vergelijken — Bitvavo vs Kraken vs Binance',
        'Proof of Stake vs Proof of Work — het verschil uitgelegd',
        'Staking uitgelegd — passief inkomen met crypto',
        'Crypto marktcycli — bull, bear en accumulation fase',
        'On-chain analyse voor beginners — tools en metrics',
        'Gedecentraliseerde exchanges — hoe werkt een DEX?',
        'Web3 uitgelegd — de toekomst van het internet?',
        'Blockchain technologie — toepassingen buiten crypto',
        'Crypto opslaan — koude opslag best practices',
        'Belasting op crypto trading winst — dit moet je weten',
        'Regulering van crypto in Europa — MiCA wetgeving uitgelegd',
        'Crypto in een pensioenportefeuille — hoeveel is verstandig?',
        'Hoe analyseer ik een crypto whitepaper?',
        'Flash crashes in crypto — oorzaken en hoe te overleven',
        'Tokenomics uitgelegd — waarom supply en demand cruciaal zijn',
        'Van €500 naar crypto portfolio — stappenplan voor beginners',
      ],
      short: [
        'Bitcoin kopen in 3 stappen — zo doe je het',
        'Crypto belasting 2026 — dit moet je weten',
        'DCA in crypto — waarom het werkt',
        'Hardware wallet — heb je die echt nodig?',
        '5 crypto scams die je moet kennen',
        'Ethereum of Bitcoin — welke kies je?',
        'Staking uitgelegd in 60 seconden',
        'Wat is DeFi en waarom is het revolutionair?',
        'Bitcoin halving — effect op prijs uitgelegd',
        'De 3 beste crypto exchanges voor Nederlanders',
        'Altcoins — hoe selecteer je de winnaars?',
        'Crypto portfolio — zo verdeel je slim',
        'Layer 2 in 45 seconden uitgelegd',
        'On-chain data — dit zegt het over de markt',
        'Stablecoins — veilig of niet?',
        'NFTs in 2026 — nog relevant?',
        'Crypto bear market overleven — 3 tips',
        'Wat is tokenomics en waarom maakt het uit?',
        'Web3 uitgelegd voor beginners',
        'MiCA wetgeving — wat betekent dit voor jou?',
      ],
    },
  },
  {
    id:                'dcf1b56e-3e06-404d-b508-1b747a4431dc',
    naam:              'PropertyInvestorTv',
    language:          'en',
    voice:             'en-GB-RyanNeural',
    bg_color:          '#1b1f3b',
    style:             'professional, analytical, UK/EU property focused',
    target_seconds:    480,
    videos_per_day:    2,
    publish_hours_utc: [8, 16],
    topics: {
      longform: [
        'Buy-to-let property investment strategy UK — complete guide 2026',
        'How to calculate rental yield on any property — step by step',
        'HMO vs single let — which strategy generates more income in 2026?',
        'Finding below market value properties — sourcing deals in the UK',
        'Bridging finance explained — how to use it for property investment',
        'Limited company vs personal name for buy-to-let — tax comparison',
        'BRRRR strategy UK property — step by step with real numbers',
        'Commercial to residential conversion — opportunities in 2026',
        'Property due diligence checklist — 10 checks before you buy',
        'How to scale from 1 to 10 properties systematically',
        'Section 24 tax relief changes — impact on UK landlords 2026',
        'Planning permission for property conversions — beginners guide',
        'Lease options explained — control property without buying it',
        'Property auction buying guide — risks and opportunities',
        'Stamp duty land tax 2026 — rates and exemptions for investors',
        'Rent to rent strategy — is it still viable in 2026?',
        'Social housing investment — guaranteed rent explained',
        'Houses of multiple occupation — licensing and management guide',
        'Property portfolio financing — how to keep getting mortgages',
        'Capital gains tax on property UK 2026 — what investors must know',
        'Serviced accommodation vs long term lets — profitability compared',
        'Property joint ventures — how to structure deals with investors',
        'Ground rent and leasehold — what every investor must know',
        'Remortgaging to fund next property — strategy explained',
        'Property management — self manage vs letting agency',
        'EPC ratings and energy efficiency requirements for landlords 2026',
        'Off-plan property investment — risks and rewards',
        'Permitted development rights — convert office to residential',
        'Building a property business — from investor to developer',
        'Property investment in continental Europe — Netherlands, Germany, Spain',
      ],
      short: [
        'How to calculate rental yield in 60 seconds',
        'BRRRR strategy explained simply',
        'HMO vs single let — which makes more money?',
        'Section 24 — why landlords are selling up',
        '3 mistakes new property investors make',
        'How to find below market value deals',
        'Bridging finance in 45 seconds explained',
        'Buy-to-let in a limited company — yes or no?',
        'Rent to rent — still worth it in 2026?',
        'Stamp duty — how much will you pay?',
        'Property due diligence — 3 must-check items',
        'How to scale your property portfolio fast',
        'Lease option — own property without buying it',
        'HMO licensing — what you must know',
        'Capital gains tax on property — quick guide',
        'Serviced accommodation vs buy-to-let compared',
        'EPC rating — new rules for landlords in 2026',
        'Joint venture property deal — how it works',
        'Permitted development — convert offices to flats',
        'Social housing investment — guaranteed income explained',
      ],
    },
  },
]

// ─────────────────────────────────────────────────────────────────────────────

function log(msg: string, ...args: unknown[]) {
  console.log(`[${new Date().toLocaleTimeString('nl-NL')}] [factory] ${msg}`, ...args)
}

function weekStart(d: Date): string {
  const day = d.getUTCDay()
  const mon = new Date(d)
  mon.setUTCDate(d.getUTCDate() - ((day + 6) % 7))
  return mon.toISOString().split('T')[0]
}

async function getRecentTopics(channelId: string): Promise<Set<string>> {
  const { data } = await db
    .from('agent_tasks')
    .select('payload')
    .eq('task_type', 'generate_content')
    .contains('payload', { channel_id: channelId })
    .order('created_at', { ascending: false })
    .limit(RECENT_TOPIC_WINDOW)

  const topics = new Set<string>()
  for (const row of data ?? []) {
    const t = (row.payload as { topic?: string })?.topic
    if (t) topics.add(t)
  }
  return topics
}

function pickFreshTopic(pool: string[], recent: Set<string>): string {
  const fresh = pool.filter(t => !recent.has(t))
  const source = fresh.length > 0 ? fresh : pool   // reset if all used
  return source[Math.floor(Math.random() * source.length)]
}

async function countPipeline(channelId: string): Promise<number> {
  const [{ count: taskCount }, { count: videoCount }] = await Promise.all([
    db.from('agent_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('task_type', 'generate_content')
      .contains('payload', { channel_id: channelId })
      .in('status', ['pending', 'claimed', 'running']),

    db.from('youtube_videos')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId)
      .eq('status', 'queued'),
  ])
  return (taskCount ?? 0) + (videoCount ?? 0)
}

async function findNextSlot(
  channelId: string,
  publishHours: number[],
  afterMs: number = Date.now() + 60 * 60 * 1000,   // at least 1h from now
): Promise<Date> {
  const { data: taken } = await db
    .from('youtube_upload_queue')
    .select('scheduled_publish_at')
    .eq('channel_id', channelId)
    .gte('scheduled_publish_at', new Date(afterMs).toISOString())
    .not('status', 'in', '("failed","verified_live")')
    .order('scheduled_publish_at', { ascending: true })

  const takenSet = new Set(
    (taken ?? []).map(r => new Date(r.scheduled_publish_at).toISOString())
  )

  // Walk forward day by day, trying each publish hour
  const cursor = new Date(afterMs)
  for (let day = 0; day < 14; day++) {
    const date = new Date(cursor)
    date.setUTCDate(cursor.getUTCDate() + day)
    for (const hour of publishHours) {
      date.setUTCHours(hour, 0, 0, 0)
      if (date.getTime() > afterMs && !takenSet.has(date.toISOString())) {
        return date
      }
    }
  }
  // Fallback: first hour of tomorrow + 1 day
  const fallback = new Date(afterMs)
  fallback.setUTCDate(fallback.getUTCDate() + 1)
  fallback.setUTCHours(publishHours[0], 0, 0, 0)
  return fallback
}

// ─────────────────────────────────────────────────────────────────────────────

async function createTask(
  ch: ChannelConfig,
  videoType: 'longform' | 'short',
  topic: string,
): Promise<void> {
  const publishDate = new Date().toISOString().split('T')[0]
  const calendarId  = randomUUID()
  const taskId      = randomUUID()

  await db.from('yt_content_calendar').insert({
    id:           calendarId,
    channel_id:   ch.id,
    week_start:   weekStart(new Date()),
    publish_date: publishDate,
    video_type:   videoType,
    status:       'planned',
    created_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  })

  await db.from('agent_tasks').insert({
    id:        taskId,
    task_type: 'generate_content',
    status:    'pending',
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
      publish_date:    publishDate,
    },
    created_at: new Date().toISOString(),
  })

  log(`+ taak aangemaakt: ${ch.naam} [${videoType}] "${topic.slice(0, 50)}"`)
}

async function assignPendingSlots(ch: ChannelConfig): Promise<void> {
  const { data: unslotted } = await db
    .from('youtube_videos')
    .select('id')
    .eq('channel_id', ch.id)
    .eq('status', 'queued')

  if (!unslotted?.length) return

  const { data: inQueue } = await db
    .from('youtube_upload_queue')
    .select('video_id')
    .eq('channel_id', ch.id)
    .not('video_id', 'is', null)

  const inQueueIds = new Set((inQueue ?? []).map(r => r.video_id))
  const needsSlot  = unslotted.filter(v => !inQueueIds.has(v.id))

  for (const video of needsSlot) {
    const slot = await findNextSlot(ch.id, ch.publish_hours_utc)
    await db.from('youtube_upload_queue').insert({
      channel_id:           ch.id,
      video_id:             video.id,
      status:               'queued',
      scheduled_publish_at: slot.toISOString(),
      priority:             5,
      created_at:           new Date().toISOString(),
      updated_at:           new Date().toISOString(),
    })
    log(`→ upload slot: ${ch.naam} @ ${slot.toUTCString()}`)
  }
}

async function runFactory(): Promise<void> {
  log('── ronde start ──')
  for (const ch of CHANNELS) {
    try {
      const inPipeline = await countPipeline(ch.id)
      const target     = BUFFER_DAYS * ch.videos_per_day
      const deficit    = Math.max(0, target - inPipeline)

      log(`${ch.naam}: ${inPipeline}/${target} in pipeline, deficit: ${deficit}`)

      if (deficit > 0) {
        const recent = await getRecentTopics(ch.id)
        for (let i = 0; i < deficit; i++) {
          const videoType: 'longform' | 'short' = i % 3 === 2 ? 'short' : 'longform'
          const pool  = ch.topics[videoType]
          const topic = pickFreshTopic(pool, recent)
          recent.add(topic)
          await createTask(ch, videoType, topic)
        }
      }

      await assignPendingSlots(ch)
    } catch (err: any) {
      log(`✗ fout bij ${ch.naam}: ${err.message}`)
    }
  }
  log('── ronde klaar ──')
}

async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('  Orlando Content Factory 24/7')
  log(`  Buffer: ${BUFFER_DAYS} dagen | Interval: ${FACTORY_INTERVAL_MS / 60000}m`)
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await runFactory()
  setInterval(runFactory, FACTORY_INTERVAL_MS)
}

main().catch(err => {
  console.error('[factory] Fatal:', err.message)
  process.exit(1)
})
