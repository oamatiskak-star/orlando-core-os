import { PROJECTS, type ProjectName, type RoutingContext, localJson, tokenize } from './shared.js'

// Project-specifieke woordenboeken (FASE 3). Tokens zijn bewust onderscheidend
// per project; één sterke hit is meestal beslissend.
const PROJECT_HINTS: Record<ProjectName, string[]> = {
  Aquier: ['aquier', 'kansenradar', 'taxatie', 'listing', 'makelaar', 'breskens', 'vastgoeddeal', 'betalen', 'betaling', 'klanten', 'klant', 'afrekenen', 'checkout'],
  SterkCalc: ['sterkcalc', 'stabu', 'calculatie', 'begroting', 'offerte', 'bouwkosten', 'calculator', 'm2', 'verbouwkosten', 'raming'],
  'Vastgoed Core OS': ['core os', 'dashboard', 'hermes', 'dispatch', 'orchestrator', 'engine', 'route', 'deploy', 'database', 'api', 'webhook', 'homepage'],
  STRKBOUW: ['strkbouw', 'bouwproject', 'aanneming', 'bouwplaats', 'onderaannemer', 'leverancier', 'bouwteam', 'bouwplanning'],
  STRKBEHEER: ['strkbeheer', 'beheer', 'huurder', 'verhuur', 'onderhoud', 'vastgoedbeheer', 'pand', 'huurdersmelding'],
  'YouTube Engine': ['youtube', 'kanaal', 'video', 'short', 'upload', 'thumbnail', 'oauth', 'vermogentv', 'spaartv', 'vastgoedtv'],
  'Affiliate Engine': ['affiliate', 'payout', 'uitbetaling', 'commissie', 'partnerlink', 'tracking'],
  'Trading Engine': ['trading', 'crypto', 'belegg', 'portfolio', 'koers', 'datafeed', 'signaal', 'backtest', 'drawdown'],
  Administratie: ['factuur', 'btw', 'boekhoud', 'boeking', 'moneybird', 'administratie', 'belasting', 'grootboek', 'debiteur'],
  Marketing: ['marketing', 'campagne', 'ads', 'social', 'seo', 'content', 'distributie', 'roas'],
}

export interface ProjectResult {
  active_project: ProjectName
  confidence: number
}

interface HeuristicHit {
  project: ProjectName
  hits: number
  second: number
}

function heuristic(message: string): HeuristicHit {
  const lower = message.toLowerCase()
  const toks = tokenize(message)
  let best: ProjectName = 'Vastgoed Core OS'
  let bestScore = 0
  let second = 0
  for (const project of PROJECTS) {
    let score = 0
    for (const hint of PROJECT_HINTS[project]) {
      if (hint.includes(' ') ? lower.includes(hint) : toks.has(hint)) score += 1
    }
    if (score > bestScore) {
      second = bestScore
      bestScore = score
      best = project
    } else if (score > second) {
      second = score
    }
  }
  return { project: best, hits: bestScore, second }
}

/**
 * LAAG 1 — classificatie. FASE 3: heuristiek-eerst blending.
 *   - 1+ project-specifieke keyword-hit → heuristiek leidend (deterministisch,
 *     accuraat op vakjargon). LLM bevestigt → hogere confidence.
 *   - 0 hits → lokale mistral-LLM, met confidence-cap zodat onzekere terse
 *     commando's escaleren naar GPT/council i.p.v. fout-lokaal blijven.
 * Confidence weerspiegelt zekerheid → stuurt de escalatie (confidence.ts).
 */
export async function classifyProject(ctx: RoutingContext): Promise<ProjectResult> {
  const message = ctx.request.raw_message
  const h = heuristic(message)

  const parsed = await localJson<{ active_project: string; confidence: number }>({
    layer: 'L1',
    ctx,
    system:
      'Je bent een classifier. Kies exact één project uit de lijst dat het beste past bij het bericht. ' +
      'Antwoord UITSLUITEND met JSON: {"active_project": "<exacte projectnaam>", "confidence": <0-1>}.',
    prompt:
      `Projecten: ${PROJECTS.join(', ')}.\n` +
      `Bericht: """${message}"""\n` +
      'Welk project? Geef alleen de JSON.',
    maxTokens: 120,
  })
  const llm = parsed && typeof parsed.active_project === 'string'
    ? PROJECTS.find(p => p.toLowerCase() === parsed.active_project.toLowerCase()) ?? null
    : null

  // Heuristiek heeft een duidelijke winnaar (≥2, of 1 die uniek is).
  if (h.hits >= 2 && h.hits > h.second) {
    const agree = llm === h.project
    return { active_project: h.project, confidence: Math.min(0.98, (agree ? 0.85 : 0.78) + 0.05 * h.hits) }
  }
  if (h.hits === 1 && h.hits > h.second) {
    if (llm === h.project) return { active_project: h.project, confidence: 0.92 }
    // LLM oneens of leeg → vertrouw het project-specifieke keyword, lagere conf.
    return { active_project: h.project, confidence: 0.72 }
  }

  // Geen onderscheidende hit → LLM, maar cap de confidence (onzeker → escaleer).
  if (llm) {
    const conf = typeof parsed!.confidence === 'number' ? Math.max(0, Math.min(1, parsed!.confidence)) : 0.6
    return { active_project: llm, confidence: Math.min(0.8, conf) }
  }
  // Niets bruikbaar → heuristiek-default, lage confidence.
  return { active_project: h.project, confidence: 0.4 }
}
