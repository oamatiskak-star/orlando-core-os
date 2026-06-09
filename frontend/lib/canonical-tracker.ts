import type { SupabaseClient } from '@supabase/supabase-js'

// ───────────────────────────────────────────────────────────────────────────
// Canonieke tracker = BUILD_TRACKER.md → public.build_tracker_documents/_items.
// Items hebben GEEN entity/module-kolom; per-BV/module views worden AFGELEID via
// deze scope-map (repo + keyword-match). Geen schemawijziging, geen re-sync nodig.
// ───────────────────────────────────────────────────────────────────────────

export type CanonicalScope = {
  key: string
  label: string
  repos: string[]      // matcht op item.repo (case-insensitive, substring)
  keywords: string[]   // matcht op item.title / route / owner (case-insensitive)
}

// Heuristische scopes (Orlando kan repos/keywords verfijnen op echte item.repo-waarden).
export const CANONICAL_SCOPES: CanonicalScope[] = [
  {
    key: 'aquier',
    label: 'Aquier',
    repos: ['aquire', 'vastgoed-core', 'vastgoed_core', 'vastgoed-core-front', 'vastgoed-core-back', 'vastgoed-core-executor'],
    keywords: ['aquier'],
  },
  {
    key: 'orlando-core-os',
    label: 'Orlando Core OS',
    repos: ['orlando-core-os'],
    keywords: ['orlando core os', 'hermes', 'core os'],
  },
  {
    key: 'sterkcalc',
    label: 'SterkCalc / SterkBouw SaaS',
    repos: ['sterkcalc', 'sterkbouw-saas', 'sterkbouw'],
    keywords: ['sterkcalc', 'sterkbouw', 'calculatie'],
  },
]

// Welke scopes horen bij welk actief bedrijf (company id uit lib/companies.ts).
export const COMPANY_SCOPE_KEYS: Record<string, string[]> = {
  osm: ['orlando-core-os', 'aquier', 'sterkcalc'], // eigenaar: ziet alles
  modiwerijo: ['orlando-core-os'],
  'modiwe-media': [],
  'modiwe-software': ['aquier', 'orlando-core-os', 'sterkcalc'],
  strkbeheer: ['aquier'],
  strkbouw: ['sterkcalc'],
  bouwproffs: ['sterkcalc'],
}

export function getScope(key: string): CanonicalScope | undefined {
  return CANONICAL_SCOPES.find((s) => s.key === key)
}

export type CanonicalItem = {
  id: string
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
  match_kind?: string | null
  match_pattern?: string | null
}

export type CanonicalDocument = {
  id: string
  source_file: string | null
  source_repo: string | null
  source_branch: string | null
  source_commit: string | null
  synced_by: string | null
  synced_at: string | null
} | null

function itemMatchesScope(item: CanonicalItem, scope: CanonicalScope): boolean {
  const repo = (item.repo ?? '').toLowerCase()
  if (scope.repos.some((r) => repo.includes(r.toLowerCase()))) return true
  const hay = `${item.title ?? ''} ${item.route ?? ''} ${item.owner ?? ''}`.toLowerCase()
  return scope.keywords.some((k) => hay.includes(k.toLowerCase()))
}

/** Filtert canonieke items op een unie van scope-keys. Lege keys → alle items. */
export function filterCanonicalItems(items: CanonicalItem[], scopeKeys: string[]): CanonicalItem[] {
  if (!scopeKeys.length) return items
  const scopes = scopeKeys.map(getScope).filter(Boolean) as CanonicalScope[]
  if (!scopes.length) return []
  return items.filter((it) => scopes.some((s) => itemMatchesScope(it, s)))
}

export type CanonicalCounts = {
  documents_count: number
  items_count: number
  conflicts_count: number
  perSection: Record<'A' | 'B' | 'C' | 'D' | 'E', number>
}

export type CanonicalSnapshot = {
  document: CanonicalDocument
  items: CanonicalItem[]      // gefilterd (of alles als scopeKeys leeg)
  allItems: CanonicalItem[]   // ongefilterd (huidige document)
  counts: CanonicalCounts
  scopeKeys: string[]
  scoped: boolean
}

const EMPTY_COUNTS: CanonicalCounts = {
  documents_count: 0, items_count: 0, conflicts_count: 0,
  perSection: { A: 0, B: 0, C: 0, D: 0, E: 0 },
}

/**
 * Leest de huidige canonieke staat (document + items) en levert optioneel een
 * gescopete weergave + tellingen. Read-only. `scopeKeys` leeg = cross-project.
 */
export async function getCanonicalSnapshot(
  client: SupabaseClient,
  scopeKeys: string[] = [],
): Promise<CanonicalSnapshot> {
  const { data: doc } = await client
    .from('build_tracker_documents')
    .select('id, source_file, source_repo, source_branch, source_commit, synced_by, synced_at')
    .eq('is_current', true)
    .eq('scope', 'cross-project')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!doc) {
    return { document: null, items: [], allItems: [], counts: EMPTY_COUNTS, scopeKeys, scoped: scopeKeys.length > 0 }
  }

  const { data } = await client
    .from('build_tracker_items')
    .select('id, section, item_rank, title, detail, status_tag, blocker_code, owner, repo, route, evidence, deploy_allowed, match_kind, match_pattern')
    .eq('document_id', (doc as { id: string }).id)
    .order('section', { ascending: true })
    .order('item_rank', { ascending: true })

  const allItems = (data ?? []) as unknown as CanonicalItem[]
  const items = filterCanonicalItems(allItems, scopeKeys)

  const perSection = { A: 0, B: 0, C: 0, D: 0, E: 0 } as CanonicalCounts['perSection']
  let conflicts = 0
  for (const it of items) {
    perSection[it.section] = (perSection[it.section] ?? 0) + 1
    if (it.section === 'D' && it.match_pattern) conflicts += 1
  }

  return {
    document: doc as CanonicalDocument,
    items,
    allItems,
    counts: { documents_count: 1, items_count: items.length, conflicts_count: conflicts, perSection },
    scopeKeys,
    scoped: scopeKeys.length > 0,
  }
}
