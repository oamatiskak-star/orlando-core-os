import { PROJECTS, type ProjectName, type RoutingContext, localJson, tokenize } from './shared.js'

// Keyword hints per project for the deterministic fallback (local, no LLM).
const PROJECT_HINTS: Record<ProjectName, string[]> = {
  Aquier: ['aquier', 'vastgoed', 'kansenradar', 'taxatie', 'listing', 'makelaar', 'checkout', 'breskens'],
  SterkCalc: ['sterkcalc', 'stabu', 'calculatie', 'begroting', 'offerte', 'bouwkosten'],
  'Vastgoed Core OS': ['core os', 'dashboard', 'hermes', 'dispatch', 'orchestrator', 'engine'],
  'YouTube Engine': ['youtube', 'kanaal', 'video', 'short', 'upload', 'thumbnail', 'vermogentv', 'spaartv'],
  'Trading Engine': ['trading', 'crypto', 'belegg', 'portfolio', 'koers', 'markt'],
  Administratie: ['factuur', 'btw', 'boekhoud', 'moneybird', 'administratie', 'mail'],
  Marketing: ['marketing', 'campagne', 'ads', 'social', 'seo', 'content', 'distributie'],
  Bouwcalculator: ['bouwcalculator', 'calculator', 'm2 prijs', 'verbouwkosten', 'renovatie'],
}

export interface ProjectResult {
  active_project: ProjectName
  confidence: number
}

function heuristic(message: string): ProjectResult {
  const toks = tokenize(message)
  let best: ProjectName = 'Vastgoed Core OS'
  let bestScore = 0
  for (const project of PROJECTS) {
    let score = 0
    for (const hint of PROJECT_HINTS[project]) {
      if (hint.includes(' ') ? message.toLowerCase().includes(hint) : toks.has(hint)) score += 1
    }
    if (score > bestScore) {
      bestScore = score
      best = project
    }
  }
  return { active_project: best, confidence: bestScore === 0 ? 0.3 : Math.min(0.5 + bestScore * 0.15, 0.95) }
}

/** LAAG 1 — classify the request into exactly one project (local mistral, JSON). */
export async function classifyProject(ctx: RoutingContext): Promise<ProjectResult> {
  const message = ctx.request.raw_message
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

  if (parsed && typeof parsed.active_project === 'string') {
    const match = PROJECTS.find(p => p.toLowerCase() === parsed.active_project.toLowerCase())
    if (match) {
      const conf = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7
      return { active_project: match, confidence: conf }
    }
  }
  // Local model unreachable or off-list → deterministic keyword fallback.
  return heuristic(message)
}
