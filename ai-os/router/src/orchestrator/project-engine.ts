import { PROJECTS, type ProjectName, type RoutingContext, hermesDb, localJson, tokenize } from './shared.js'

// ── Projectwoordenboeken (FASE A) ──────────────────────────────────────────
// STRONG = autoritatief (overrulet de LLM). WEAK = licht signaal. NEGATIVE =
// straf (voorkomt dat een project wint op een toevallige match).
const STRONG: Record<ProjectName, string[]> = {
  Aquier: ['aquier', 'kansenradar', 'taxatie', 'breskens', 'makelaar'],
  SterkCalc: ['sterkcalc', 'stabu', 'calculatie', 'begroting', 'bouwkosten', 'calculator'],
  'Vastgoed Core OS': ['core os', 'hermes', 'orchestrator', 'dispatch', 'deployment', 'database', 'webhook', 'endpoint'],
  STRKBOUW: ['strkbouw', 'bouwproject', 'aanneming', 'onderaannemer', 'bouwplaats', 'bouwteam'],
  STRKBEHEER: ['strkbeheer', 'huurder', 'huurdersmelding', 'verhuur', 'vastgoedbeheer'],
  'YouTube Engine': ['youtube', 'kanaal', 'thumbnail', 'oauth', 'shorts', 'vermogentv', 'spaartv', 'vastgoedtv'],
  'Affiliate Engine': ['affiliate', 'payout', 'partnerlink', 'commissie'],
  'Trading Engine': ['trading', 'crypto', 'portfolio', 'datafeed', 'backtest', 'drawdown'],
  Administratie: ['moneybird', 'boekhouding', 'boeking', 'factuur', 'btw', 'belasting', 'crediteur', 'debiteur', 'grootboek', 'aangifte'],
  Marketing: ['marketing', 'campagne', 'seo', 'ads', 'roas'],
}
const WEAK: Record<ProjectName, string[]> = {
  Aquier: ['listing', 'woning', 'vastgoeddeal', 'conversie', 'checkout', 'betalen', 'betaling', 'klant', 'klanten', 'afrekenen'],
  SterkCalc: ['offerte', 'raming', 'verbouwkosten', 'casco', 'turnkey', 'hoofdstuk', 'post', 'mapping'],
  'Vastgoed Core OS': ['dashboard', 'route', 'deploy', 'homepage', 'frontend', 'backend', 'server', 'query', 'migratie', 'api', 'build tracker', 'voortgang', 'audit'],
  STRKBOUW: ['bouwplanning', 'vertraging', 'leverancier', 'inkoop', 'materiaal', 'subcontractor', 'procurement', 'planning'],
  STRKBEHEER: ['onderhoud', 'pand', 'beheer', 'asset', 'cashflow', 'reparatie'],
  'YouTube Engine': ['video', 'abonnees', 'subscribers', 'retentie', 'viral', 'upload', 'ctr'],
  'Affiliate Engine': ['uitbetaling', 'tracking', 'programma', 'partner', 'netwerk'],
  'Trading Engine': ['koers', 'signaal', 'strategie', 'belegg', 'positie', 'exposure', 'marge'],
  Administratie: ['administratie', 'fiscaal', 'deadline', 'termijn', 'kosten', 'abonnement'],
  Marketing: ['social', 'content', 'distributie', 'bereik', 'doelgroep', 'advertentie'],
}
const NEGATIVE: Record<ProjectName, string[]> = {
  Aquier: ['stabu', 'youtube', 'trading', 'moneybird', 'huurder', 'affiliate'],
  SterkCalc: ['youtube', 'trading', 'moneybird', 'huurder', 'affiliate', 'betalen'],
  'Vastgoed Core OS': ['stabu', 'moneybird', 'youtube', 'affiliate', 'trading', 'huurder', 'btw'],
  STRKBOUW: ['youtube', 'trading', 'moneybird', 'huurder', 'affiliate', 'stabu'],
  STRKBEHEER: ['youtube', 'trading', 'stabu', 'affiliate', 'bouwproject'],
  'YouTube Engine': ['stabu', 'moneybird', 'huurder', 'trading', 'affiliate', 'betalen'],
  'Affiliate Engine': ['youtube', 'stabu', 'huurder', 'trading', 'moneybird', 'betalen', 'seo'],
  'Trading Engine': ['youtube', 'stabu', 'huurder', 'moneybird', 'affiliate'],
  Administratie: ['youtube', 'stabu', 'huurder', 'trading', 'affiliate', 'aquier'],
  Marketing: ['youtube', 'stabu', 'huurder', 'trading', 'moneybird', 'affiliate'],
}

export interface ProjectResult {
  active_project: ProjectName
  confidence: number
}

// ── Learned boost (FASE D) — succesvolle keuzes uit routing_learning ────────
// 100 successen voor een project → +2 (gecapt zodat het STRONG=10 nooit overruled).
let learnedCache: Partial<Record<ProjectName, number>> | null = null
async function learnedBoosts(): Promise<Partial<Record<ProjectName, number>>> {
  if (learnedCache) return learnedCache
  const out: Partial<Record<ProjectName, number>> = {}
  try {
    const { data } = await hermesDb().from('routing_learning').select('active_project, success')
    const succ: Record<string, number> = {}
    for (const r of (data ?? []) as Array<{ active_project: string | null; success: boolean | null }>) {
      if (r.success === true && r.active_project) succ[r.active_project] = (succ[r.active_project] ?? 0) + 1
    }
    for (const p of PROJECTS) if (succ[p]) out[p] = Math.min(2, succ[p]! * 0.02)
  } catch {
    /* leeg → geen boost */
  }
  learnedCache = out
  return out
}

interface Scored {
  scores: Record<ProjectName, number>
  best: ProjectName
  bestScore: number
  secondScore: number
  strongHitsBest: number
  anyStrong: boolean
  weakBest: ProjectName | null
  weakBestHits: number
}

function hit(message: string, toks: Set<string>, word: string): boolean {
  return word.includes(' ') ? message.includes(word) : toks.has(word)
}

function scoreProjects(message: string, boosts: Partial<Record<ProjectName, number>>): Scored {
  const lower = message.toLowerCase()
  const toks = tokenize(message)
  const scores = {} as Record<ProjectName, number>
  let best: ProjectName = 'Vastgoed Core OS'
  let bestScore = -Infinity
  let secondScore = -Infinity
  let strongHitsBest = 0
  let anyStrong = false
  let weakBest: ProjectName | null = null
  let weakBestHits = 0

  for (const p of PROJECTS) {
    const strong = STRONG[p].filter(w => hit(lower, toks, w)).length
    const weak = WEAK[p].filter(w => hit(lower, toks, w)).length
    const neg = NEGATIVE[p].filter(w => hit(lower, toks, w)).length
    const score = strong * 10 + weak * 1 - neg * 5 + (boosts[p] ?? 0)
    scores[p] = score
    if (strong > 0) anyStrong = true
    if (weak > weakBestHits) {
      weakBestHits = weak
      weakBest = p
    }
    if (score > bestScore) {
      secondScore = bestScore
      bestScore = score
      best = p
      strongHitsBest = strong
    } else if (score > secondScore) {
      secondScore = score
    }
  }
  return { scores, best, bestScore, secondScore, strongHitsBest, anyStrong, weakBest, weakBestHits }
}

/**
 * LAAG 1 — classificatie (≥95%-doel, lokaal-only).
 *   1. STRONG-autoriteit: heeft een project ≥1 sterk woord → hoogste score wint,
 *      LLM wordt OVERGESLAGEN (deterministisch + bespaart tokens).
 *   2. Geen sterk signaal → lokale mistral, met WEAK-tiebreak + negative penalty.
 */
export async function classifyProject(ctx: RoutingContext): Promise<ProjectResult> {
  const message = ctx.request.raw_message
  const boosts = await learnedBoosts()
  const s = scoreProjects(message, boosts)

  // 1. STRONG-autoriteit — overrulet de LLM, geen model-call nodig.
  if (s.anyStrong && s.strongHitsBest >= 1) {
    const margin = s.bestScore - s.secondScore
    const conf = Math.min(0.99, 0.9 + 0.02 * s.strongHitsBest + (margin >= 10 ? 0.05 : 0))
    return { active_project: s.best, confidence: conf }
  }

  // 2. Geen sterk signaal → lokale LLM (mistral) + weak-tiebreak.
  const parsed = await localJson<{ active_project: string; confidence: number }>({
    layer: 'L1',
    ctx,
    system:
      'Je bent een classifier. Kies exact één project uit de lijst dat het beste past bij het bericht. ' +
      'Antwoord UITSLUITEND met JSON: {"active_project": "<exacte projectnaam>", "confidence": <0-1>}.',
    prompt: `Projecten: ${PROJECTS.join(', ')}.\nBericht: """${message}"""\nWelk project? Geef alleen de JSON.`,
    maxTokens: 120,
  })
  const llm = parsed && typeof parsed.active_project === 'string'
    ? PROJECTS.find(p => p.toLowerCase() === parsed.active_project.toLowerCase()) ?? null
    : null

  // Weak heeft een duidelijke winnaar → vertrouw die boven de LLM (negative-safe).
  if (s.weakBest && s.weakBestHits >= 1 && s.scores[s.weakBest] >= 1) {
    if (llm === s.weakBest) return { active_project: s.weakBest, confidence: 0.92 }
    // LLM oneens, maar het weak-project heeft een net signaal én geen negatief → vertrouw weak.
    if (s.weakBestHits >= 2 || (llm && WEAK[llm].filter(w => hit(message.toLowerCase(), tokenize(message), w)).length === 0)) {
      return { active_project: s.weakBest, confidence: 0.8 }
    }
  }
  if (llm) {
    const conf = typeof parsed!.confidence === 'number' ? Math.max(0, Math.min(1, parsed!.confidence)) : 0.6
    return { active_project: llm, confidence: Math.min(0.8, conf) }
  }
  return { active_project: s.best, confidence: 0.45 }
}
