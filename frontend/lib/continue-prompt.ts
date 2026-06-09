// Shared builder voor de "Ga verder"-prompt die in een Claude Code sessie geplakt wordt.
// Puur, zonder dependencies — bruikbaar in elke build tracker (client of server).

export type ContinuePromptExtra = { label: string; value: string }

export type ContinuePromptContext = {
  tracker: string                 // bv. "Build Tracker", "Media Holding", "Aquier USA Domination", "Holding Milestones"
  itemType: string                // "build" | "module" | "sectie" | "milestone"
  name: string
  status?: string | null          // ruwe statuscode
  statusLabel?: string | null     // leesbare status (voorkeur boven status)
  progressPct?: number | null
  milestone?: string | null
  description?: string | null
  owner?: string | null
  company?: string | null
  route?: string | null           // app-route van het onderdeel, handig voor Claude
  extra?: ContinuePromptExtra[]    // extra context-regels per tracker
}

/**
 * Bouwt een complete, plak-klare opdracht voor een nieuwe Claude Code sessie.
 * De prompt verwijst naar het SESSIE PROTOCOL (PROJECT_STATUS.md) en de
 * productieregels uit CLAUDE.md, zodat de sessie meteen op de juiste manier verdergaat.
 */
export function buildContinuePrompt(ctx: ContinuePromptContext): string {
  const lines: string[] = []

  lines.push(`Ga verder met: ${ctx.name}`)
  lines.push('')
  lines.push(`Bron: ${ctx.tracker} (dashboard) — ${ctx.itemType}`)
  if (ctx.company) lines.push(`Bedrijf: ${ctx.company}`)

  const statusTxt = ctx.statusLabel || ctx.status
  if (statusTxt) lines.push(`Status: ${statusTxt}`)
  if (ctx.progressPct != null) lines.push(`Voortgang: ${ctx.progressPct}%`)
  if (ctx.milestone) lines.push(`Huidige milestone: ${ctx.milestone}`)
  if (ctx.owner) lines.push(`Owner: ${ctx.owner}`)
  if (ctx.route) lines.push(`Route: ${ctx.route}`)

  if (ctx.extra?.length) {
    for (const e of ctx.extra) {
      if (e.value?.trim()) lines.push(`${e.label}: ${e.value}`)
    }
  }

  if (ctx.description?.trim()) {
    lines.push('')
    lines.push('Omschrijving:')
    lines.push(ctx.description.trim())
  }

  lines.push('')
  lines.push('Opdracht:')
  lines.push('1. Lees PROJECT_STATUS.md (operationele context) én BUILD_TRACKER.md (canonieke beslisbron) in de projectroot; volg het SESSIE PROTOCOL uit CLAUDE.md. Bij conflict prevaleert BUILD_TRACKER.md. Voer NOOIT iets uit dat in sectie D (niet-opnieuw-doen) staat.')
  lines.push('2. Meld waar we gebleven zijn op dit onderdeel en pak de eerstvolgende openstaande taak op (zie BUILD_TRACKER.md sectie E).')
  lines.push('3. Lever alleen productieklare, volledige bestanden — geen placeholders, mockups of snippets.')
  lines.push('4. Update PROJECT_STATUS.md na elke voltooide stap en houd het 🔴 HERSTEL HIER NA CRASH-blok actueel.')
  lines.push('')
  lines.push('Begin met een korte statusmelding van dit onderdeel en je voorgestelde volgende stap.')

  return lines.join('\n')
}
