// Issue detectors over een FlowGraph.

import type { FlowGraph } from './graph'

export type IssueKind =
  | 'dead_end'
  | 'unreachable'
  | 'broken_link'
  | 'deep_no_breadcrumb'
  | 'duplicate_route'
  | 'missing_in_nav'
  | 'orphan_dynamic'

export interface FlowIssue {
  kind:    IssueKind
  route:   string
  detail:  string
  payload: Record<string, unknown>
}

const ROOT_PATHS = new Set(['/', '/login', '/logout', '/dashboard', '/mobile'])
const MAX_DEPTH_NO_BREADCRUMB = 4

export function detectIssues(graph: FlowGraph, navHrefs: Set<string>): FlowIssue[] {
  const issues: FlowIssue[] = []
  const knownRoutes = new Set(graph.nodes.map((n) => n.route))

  for (const node of graph.nodes) {
    if (ROOT_PATHS.has(node.route)) continue

    const outs = graph.outgoing.get(node.route) ?? []
    const ins  = graph.incoming.get(node.route) ?? []

    // ── dead_end: blad-route zonder enige outgoing nav ─────────────────────
    if (outs.length === 0 && !node.dynamic) {
      issues.push({
        kind:    'dead_end',
        route:   node.route,
        detail:  'Geen outgoing <Link> of router.push gevonden — gebruiker kan niet verder navigeren.',
        payload: { depth: node.depth },
      })
    }

    // ── unreachable: geen incoming én niet in sidebar ──────────────────────
    if (ins.length === 0 && !navHrefs.has(node.route) && !node.dynamic) {
      issues.push({
        kind:    'unreachable',
        route:   node.route,
        detail:  'Geen inkomende links én niet in sidebar — onbereikbaar voor gebruikers.',
        payload: {},
      })
    }

    // ── deep_no_breadcrumb: depth > 4 ──────────────────────────────────────
    if (node.depth > MAX_DEPTH_NO_BREADCRUMB) {
      issues.push({
        kind:    'deep_no_breadcrumb',
        route:   node.route,
        detail:  `Depth ${node.depth} — overweeg breadcrumb-component te voegen.`,
        payload: { depth: node.depth },
      })
    }
  }

  // ── broken_link: link naar non-existing route ──────────────────────────
  const brokenSeen = new Set<string>()
  for (const e of graph.edges) {
    if (knownRoutes.has(e.to)) continue
    const key = `${e.from}→${e.to}`
    if (brokenSeen.has(key)) continue
    brokenSeen.add(key)
    issues.push({
      kind:    'broken_link',
      route:   e.from,
      detail:  `Link naar onbekende route: ${e.to}`,
      payload: { target: e.to, kind: e.kind },
    })
  }

  // ── missing_in_nav: top-level dashboard-route niet in sidebar ──────────
  for (const node of graph.nodes) {
    if (node.depth < 2) continue
    if (!node.route.startsWith('/dashboard/')) continue
    if (node.dynamic) continue
    if (navHrefs.has(node.route)) continue
    // Alleen depth=2 (direct dashboard child) — diepere routes hoeven niet
    if (node.route.split('/').filter(Boolean).length !== 2) continue
    issues.push({
      kind:    'missing_in_nav',
      route:   node.route,
      detail:  'Dashboard-route is niet zichtbaar in de sidebar.',
      payload: {},
    })
  }

  // ── duplicate_route: zelfde href via verschillende files (bv. group folders) ─
  const fileByRoute = new Map<string, string[]>()
  for (const n of graph.nodes) {
    if (!fileByRoute.has(n.route)) fileByRoute.set(n.route, [])
    fileByRoute.get(n.route)!.push(n.file)
  }
  for (const [route, files] of fileByRoute) {
    if (files.length > 1) {
      issues.push({
        kind:    'duplicate_route',
        route,
        detail:  `Route komt uit meerdere bestanden (route-group conflict).`,
        payload: { files },
      })
    }
  }

  return issues
}
