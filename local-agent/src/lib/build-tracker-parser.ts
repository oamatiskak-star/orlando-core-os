/**
 * BUILD_TRACKER.md parser — Hybride C, laag 2.
 *
 * Pure module, geen I/O. Zet de canonieke markdown om in gestructureerde items
 * per sectie A–E. De ingest-CLI (build-tracker-sync.ts) schrijft deze naar DB.
 *
 * Robuust + eerlijk: parst markdown-tabellen generiek (kolom-mapping op kop-naam)
 * en valt terug op bullets. Genereert GEEN match_pattern (sectie D) — dat wordt
 * bewust handmatig gecureerd zodat Hermes nooit fuzzy vals-blokkeert.
 */

export type ParsedItem = {
  section: 'A' | 'B' | 'C' | 'D' | 'E'
  item_rank: number
  title: string
  detail: string | null
  status_tag: string | null
  blocker_code: string | null
  owner: string | null
  repo: string | null
  route: string | null
  evidence: string | null
  deploy_allowed: boolean | null
  raw_line: string
}

const SECTION_RE = /^##\s+([A-E])\.\s/

/** Strip markdown-opmaak (**, `, links) en emoji-ruis voor een schone celwaarde. */
function clean(s: string): string {
  return s
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/⛔|✅|🔴|🟠|🟡|🟢|📌|⚠️/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitRow(line: string): string[] {
  const t = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return t.split('|').map((c) => c.trim())
}

function isSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}/.test(line.trim()) && line.includes('-')
}

/** Booleaans uit een NL/EN deploy-cel: JA/YES → true, NEE/NO → false, anders null. */
function parseDeploy(v: string): boolean | null {
  const c = clean(v).toUpperCase()
  if (!c) return null
  if (/\b(JA|YES|TRUE)\b/.test(c)) return true
  if (/\b(NEE|NO|FALSE)\b/.test(c)) return false
  return null
}

/** Vind de eerste kolom-index waarvan de kop één van de zoektermen bevat. */
function colIndex(headers: string[], ...needles: string[]): number {
  const lower = headers.map((h) => clean(h).toLowerCase())
  for (let i = 0; i < lower.length; i++) {
    if (needles.some((n) => lower[i].includes(n))) return i
  }
  return -1
}

export function parseBuildTracker(markdown: string): ParsedItem[] {
  const lines = markdown.split('\n')
  const items: ParsedItem[] = []
  let section: ParsedItem['section'] | null = null
  let rankBySection: Record<string, number> = {}

  // Buffer voor een lopend tabelblok
  let tableHeaders: string[] | null = null

  const pushItem = (partial: Omit<ParsedItem, 'section' | 'item_rank'>) => {
    if (!section) return
    rankBySection[section] = (rankBySection[section] ?? 0) + 1
    items.push({ section, item_rank: rankBySection[section], ...partial })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const secMatch = line.match(SECTION_RE)
    if (secMatch) {
      section = secMatch[1] as ParsedItem['section']
      tableHeaders = null
      continue
    }
    if (!section) continue

    const trimmed = line.trim()

    // Tabel-detectie
    if (trimmed.startsWith('|')) {
      if (isSeparator(trimmed)) continue
      const cells = splitRow(trimmed)
      if (!tableHeaders) {
        tableHeaders = cells
        continue
      }
      // Data-rij → item
      const h = tableHeaders
      const titleIdx = colIndex(h, 'item', 'actie', 'blocker', 'verbod') >= 0
        ? colIndex(h, 'item', 'actie', 'blocker', 'verbod')
        : (clean(h[0]).toLowerCase() === '#' ? 1 : 0)
      const rawTitle = cells[titleIdx] ?? cells[0] ?? ''
      const title = clean(rawTitle) || clean(cells.find((c) => clean(c)) ?? '(leeg)')
      if (!title) continue

      const ownerIdx = colIndex(h, 'eigenaar', 'owner')
      const repoIdx = colIndex(h, 'repo', 'project')
      const routeIdx = colIndex(h, 'route', 'bestand')
      const evidIdx = colIndex(h, 'bewijs', 'evidence')
      const statusIdx = colIndex(h, 'status')
      const deployIdx = colIndex(h, 'deploy')

      const detailParts = cells
        .map((c, idx) => (idx === titleIdx ? '' : `${clean(h[idx] ?? '')}: ${clean(c)}`))
        .filter((p) => p && !p.endsWith(': '))
      // Blocker-code (C1..C9) staat doorgaans in de '#'-kolom, niet in de titel → scan de hele rij.
      const blocker = section === 'C'
        ? (cells.map(clean).join(' | ').match(/\bC\d{1,2}\b/) || [])[0] ?? null
        : null

      pushItem({
        title,
        detail: detailParts.join(' · ') || null,
        status_tag: statusIdx >= 0 ? clean(cells[statusIdx] ?? '') || null : null,
        blocker_code: section === 'C' ? blocker : null,
        owner: ownerIdx >= 0 ? clean(cells[ownerIdx] ?? '') || null : null,
        repo: repoIdx >= 0 ? clean(cells[repoIdx] ?? '') || null : null,
        route: routeIdx >= 0 ? clean(cells[routeIdx] ?? '') || null : null,
        evidence: evidIdx >= 0 ? clean(cells[evidIdx] ?? '') || null : null,
        deploy_allowed: deployIdx >= 0 ? parseDeploy(cells[deployIdx] ?? '') : null,
        raw_line: trimmed,
      })
      continue
    }

    // Niet-tabel → tabelblok sluiten
    tableHeaders = null

    // Bullet-fallback (bv. sectie D ⛔-regels die als lijst staan)
    const bullet = trimmed.match(/^[-*]\s+(.*)$/)
    if (bullet) {
      const title = clean(bullet[1])
      if (title) {
        pushItem({
          title,
          detail: null,
          status_tag: null,
          blocker_code: null,
          owner: null,
          repo: null,
          route: null,
          evidence: null,
          deploy_allowed: null,
          raw_line: trimmed,
        })
      }
    }
  }

  return items
}
