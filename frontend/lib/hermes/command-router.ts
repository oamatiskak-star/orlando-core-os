// Hermes Command Center — pure command parser.
//
// Dependency-free op doel: dit bestand importeert niets, zodat het 1-op-1
// unit-getest kan worden onder kale Node (zie command-router.test.ts).
// De DB-uitvoering (lezen/schrijven) leeft in app/api/hermes/chat/route.ts;
// hier zit uitsluitend intent-herkenning.

export type CommandKind =
  | 'resume' // "ga verder" / "hervat Claude Code sessies"
  | 'host_status' // "wat is de status van CLI L?"
  | 'revenue_blockers' // "wat blokkeert omzet vandaag?"
  | 'build_tracker' // "controleer build tracker"
  | 'open_tasks' // "welke taken staan open?"
  | 'create_task' // "maak een taak aan voor CLI L: ..."
  | 'start_phase' // "start Fase A" / "start COPY_UX_FINAL_GATE"
  | 'audit_mode' // "zet CLI R in auditmodus"
  | 'remember' // "onthoud dat ..."
  | 'uploads' // "hoe staan de uploads?"
  | 'upload_problems' // "wat is er mis met de uploads?"
  | 'retry_upload' // "retry upload <id>"
  | 'web_research' // "research: ..." / "zoek online naar ..." (Perplexity)
  | 'help' // "help" / "welke commando's"
  | 'unknown'

export type HostId = 'cli-l' | 'cli-r'

export interface ParsedCommand {
  kind: CommandKind
  /** Doelhosts. Leeg = afhankelijk van kind (resume → beide, create/start → 'any'). */
  hosts: HostId[]
  /** Titel voor create_task / start_phase. */
  title?: string
  /** Te onthouden tekst voor remember. */
  memory?: string
  /** Upload-queue id voor retry_upload. */
  uploadId?: string
  /** Zoekvraag voor web_research (Perplexity). */
  query?: string
  /** De ruwe input, getrimd. */
  raw: string
  /** NL-omschrijving van wat Hermes begreep (voor echo + fallback). */
  understood: string
}

export interface CommandHelpItem {
  label: string
  example: string
}

/** Canonieke commandolijst — hergebruikt door de help-handler en de fallback. */
export const COMMAND_HELP: CommandHelpItem[] = [
  { label: 'Hervatten', example: 'Ga verder op CLI L en CLI R' },
  { label: 'Host-status', example: 'Wat is de status van CLI L?' },
  { label: 'Omzet-blockers', example: 'Wat blokkeert omzet vandaag?' },
  { label: 'Build Tracker', example: 'Controleer Build Tracker' },
  { label: 'Open taken', example: 'Welke taken staan open?' },
  { label: 'Taak aanmaken', example: 'Maak een taak aan voor CLI L: checkout end-to-end testen' },
  { label: 'Fase/gate starten', example: 'Start COPY_UX_FINAL_GATE' },
  { label: 'Auditmodus', example: 'Zet CLI R in auditmodus' },
  { label: 'Onthouden', example: 'Onthoud dat de NL-launch op 3 juni is' },
  { label: 'Uploads', example: 'Hoe staan de uploads?' },
  { label: 'Upload-problemen', example: 'Wat is er mis met de uploads?' },
  { label: 'Upload opnieuw', example: 'Retry upload <id>' },
  { label: 'Web-research', example: 'Research: laatste NL-hypotheekrente juni 2026' },
]

const BOTH: HostId[] = ['cli-l', 'cli-r']

function truncate(s: string, n = 80): string {
  const t = s.trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

/** Detecteer expliciet genoemde hosts in de tekst. */
export function detectHosts(text: string): HostId[] {
  const t = text.toLowerCase()
  if (/\b(beide|allebei|alle\s+(hosts|sessies|machines)|elke\s+host)\b/.test(t)) return [...BOTH]
  const l = /\bcli[\s\-_]*l\b/.test(t) || /\bcli\s*links\b/.test(t)
  const r = /\bcli[\s\-_]*r\b/.test(t) || /\bcli\s*rechts\b/.test(t)
  const out: HostId[] = []
  if (l) out.push('cli-l')
  if (r) out.push('cli-r')
  return out
}

function extractTaskTitle(text: string): string | undefined {
  const colon = text.indexOf(':')
  if (colon >= 0) {
    const after = text.slice(colon + 1).trim()
    if (after) return after
  }
  // "... taak aan om <iets>" / "... voor het <iets>"
  const m = text.match(/\b(?:om|voor het|met als doel|to)\s+(.{4,})$/i)
  if (m) return m[1].trim()
  return undefined
}

/**
 * Parseer een vrije-tekst opdracht naar een gestructureerd commando.
 * Volgorde is bewust: specifieke patronen vóór generieke.
 */
export function parseCommand(raw: string): ParsedCommand {
  const text = (raw ?? '').trim()
  const t = text.toLowerCase()
  const hosts = detectHosts(t)

  if (!text) {
    return { kind: 'unknown', hosts: [], raw: text, understood: 'Lege invoer' }
  }

  // 1. Onthouden
  const rem = text.match(/\b(?:onthoud|onthou|remember)\b[:,]?\s*(?:dat\s+|even\s+)?(.+)/i)
  if (rem && rem[1]?.trim()) {
    const memory = rem[1].trim()
    return { kind: 'remember', hosts: [], memory, raw: text, understood: `Onthouden: "${truncate(memory)}"` }
  }

  // 2. Auditmodus
  if (/\baudit(modus|mode|stand)?\b/.test(t) && (hosts.length > 0 || /\bcli\b/.test(t))) {
    const h = hosts.length ? hosts : (['cli-r'] as HostId[])
    return { kind: 'audit_mode', hosts: h, raw: text, understood: `Auditmodus voor ${h.join(' + ')}` }
  }

  // 3. Taak aanmaken
  if (/\b(maak|nieuwe?|voeg)\b.*\b(taak|task|todo)\b/.test(t) || /\btaak\s+aan(maken|maak)?\b/.test(t)) {
    const title = extractTaskTitle(text)
    return {
      kind: 'create_task',
      hosts,
      title,
      raw: text,
      understood: title
        ? `Nieuwe taak${hosts.length ? ` voor ${hosts.join(' + ')}` : ''}: "${truncate(title)}"`
        : `Nieuwe taak${hosts.length ? ` voor ${hosts.join(' + ')}` : ''} (titel ontbreekt)`,
    }
  }

  // 4. Fase / gate starten
  const startM = text.match(/^\s*(?:start|begin|kickoff|trigger)\s+(.+)$/i)
  if (startM && startM[1]?.trim()) {
    const title = startM[1].trim().replace(/^(de|het|met)\s+/i, '')
    return { kind: 'start_phase', hosts, title, raw: text, understood: `Start: "${truncate(title)}"` }
  }

  // 5. Hervatten
  if (/\b(ga\s+verder|verder\s*gaan|verdergaan|hervat(ten)?|resume|continue|doorgaan|pak\s+.*\bop\b)\b/.test(t)) {
    const h = hosts.length ? hosts : [...BOTH]
    return { kind: 'resume', hosts: h, raw: text, understood: `Hervatten op ${h.join(' + ')}` }
  }

  // 5b. Uploads (status / problemen / opnieuw proberen) — vóór host-status & blockers
  if (/\bupload/.test(t)) {
    const uuid = (text.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) || [])[0]
    if (/\b(retry|opnieuw|herstart|nogmaals|herstel)\b/.test(t)) {
      return {
        kind: 'retry_upload',
        hosts: [],
        uploadId: uuid,
        raw: text,
        understood: uuid ? `Upload ${uuid.slice(0, 8)}… opnieuw in de wachtrij` : 'Upload opnieuw proberen (id ontbreekt)',
      }
    }
    if (/\b(mis|fout\w*|gefaald\w*|faal\w*|vast\w*|stuck|probleem|problemen|error\w*|hangt|hangen|blokk\w*)\b/.test(t)) {
      return { kind: 'upload_problems', hosts: [], raw: text, understood: 'Upload-problemen (gefaald/vastgelopen)' }
    }
    return { kind: 'uploads', hosts: [], raw: text, understood: 'Upload-status' }
  }

  // 6. Host-status
  const bareStatus = /^(status|stand)\??$/.test(t)
  if (
    (/\b(status|stand|hoe\s+staat|gezond|heartbeat|draait|actief)\b/.test(t) && (hosts.length > 0 || /\b(cli|host|machine)\b/.test(t))) ||
    bareStatus
  ) {
    return { kind: 'host_status', hosts, raw: text, understood: hosts.length ? `Status van ${hosts.join(' + ')}` : 'Status van alle hosts' }
  }

  // 7. Omzet-blockers
  if (/\b(blokk\w*)\b/.test(t) && /\b(omzet|revenue|verkoop|cash|inkomsten|geld|vandaag|launch|lancering)\b/.test(t)) {
    return { kind: 'revenue_blockers', hosts: [], raw: text, understood: 'Wat blokkeert omzet' }
  }
  if (/\bwat\s+blokkeert\b/.test(t)) {
    return { kind: 'revenue_blockers', hosts: [], raw: text, understood: 'Wat blokkeert omzet' }
  }

  // 8. Open taken
  if (/\b(open(staande)?\s+taken|welke\s+taken|taken\s+(staan|open)|todo'?s?|wachtrij|queue|dispatch)\b/.test(t)) {
    return { kind: 'open_tasks', hosts, raw: text, understood: 'Open taken / wachtrij' }
  }

  // 9. Build Tracker
  if (/\b(build[\s\-]?tracker|controleer\s+build|build\s+status|voortgang|fabrieken|projecten?\s*(status|overzicht)?)\b/.test(t)) {
    return { kind: 'build_tracker', hosts: [], raw: text, understood: 'Build Tracker-status' }
  }

  // 9b. Web-research (Perplexity) — expliciete onderzoeks-/zoekfrasering
  if (
    /\b(perplexity|research|zoek\s+(?:online|op\s+internet|op\s+het\s+web|even\s+op|uit)|online\s+(?:zoeken|opzoeken)|web\s*search|recent\s+nieuws|wat\s+is\s+het\s+laatste(?:\s+nieuws)?\s+over)\b/.test(t)
  ) {
    let q = text
      .replace(
        /^\s*(?:hermes[,:]?\s*)?(?:perplexity|research|zoek(?:\s+(?:online|op\s+internet|op\s+het\s+web|even\s+op|even|uit))?|online\s+(?:zoeken|opzoeken)|web\s*search)\b[:,\s]*(?:naar\s+|over\s+)?/i,
        '',
      )
      .trim()
    if (!q) q = text
    return { kind: 'web_research', hosts: [], query: q, raw: text, understood: `Web-research: "${truncate(q)}"` }
  }

  // 10. Help
  if (/\b(help|commando'?s?|wat\s+kun\s+je|wat\s+kan\s+je|wat\s+begrijp|menu|opties)\b/.test(t)) {
    return { kind: 'help', hosts: [], raw: text, understood: 'Hulp / commando-overzicht' }
  }

  // 11. Onbekend
  return { kind: 'unknown', hosts, raw: text, understood: 'Niet herkend als commando' }
}

/**
 * Incident-patronen (single source of truth). Houd de woording identiek aan de
 * orchestrator-kopie in ai-os/router/src/orchestrator/incident.ts — die kan deze
 * frontend-module niet importeren.
 */
export const INCIDENT_PATTERNS: RegExp[] = [
  /betaling(en)?.*(werkt? niet|werken niet|mislukt|mislukken|kan niet|faalt|falen)/i,
  /(kan|kunnen).*niet.*betal/i,
  /login.*(werkt niet|mislukt|kan niet)/i,
  /(kan|kunnen).*niet.*inlogg/i,
  /checkout.*(werkt niet|mislukt|hangt|kan niet)/i,
  /(website|site|pagina|homepage).*(offline|plat|down|onbereikbaar|laadt? niet|laden niet|werkt niet|werken niet)/i,
  /deployment.*(fout|mislukt|faalt|gefaald)/i,
  /deploy.*(mislukt|faalt|gefaald)/i,
  /data.*(kwijt|weg|verloren|gewist)/i,
  /pdf.*(fout|mislukt|niet gegenereerd|kapot|werkt niet|lukt niet)/i,
  /\b(laadt|laden|werkt|werken|reageert)\s+niet\b/i,
]

export function detectIncident(message: string): boolean {
  return INCIDENT_PATTERNS.some((re) => re.test(message))
}
