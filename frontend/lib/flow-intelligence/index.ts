// Entrypoint: scan → detect → suggest → persist als orchestrator_events.

import path from 'node:path'
import type { SupabaseClient } from '@supabase/supabase-js'
import { buildGraph } from './graph'
import { detectIssues, type FlowIssue } from './detectIssues'
import { buildNavSuggestions, type NavSuggestion } from './suggest'
import { NAV_MODULES } from '@/lib/nav-config'

export interface ScanReport {
  scanned_at: string
  app_dir:    string
  route_count: number
  edge_count:  number
  issues:      FlowIssue[]
  suggestions: NavSuggestion[]
  inserted:    number   // aantal events opgeslagen
}

function navHrefs(): Set<string> {
  return new Set(Object.values(NAV_MODULES).map((m) => m.href))
}

function findAppDir(): string {
  // Bij Next.js prod build is cwd typisch de project root waar `app/` onder staat.
  // We zoeken `app/` op werkdir; in dev = frontend/, in build = frontend/.
  return path.resolve(process.cwd(), 'app')
}

async function persistFindings(
  supabase: SupabaseClient,
  issues: FlowIssue[],
  suggestions: NavSuggestion[],
): Promise<number> {
  if (issues.length === 0 && suggestions.length === 0) return 0

  const rows = [
    ...issues.map((i) => ({
      type:     `flow_${i.kind}`,
      severity: i.kind === 'broken_link' ? 'error' as const : 'info' as const,
      payload:  { route: i.route, detail: i.detail, ...i.payload },
      resolved: false,
    })),
    ...suggestions.map((s) => ({
      type:     'flow_suggestion',
      severity: 'info' as const,
      payload:  s as unknown as Record<string, unknown>,
      resolved: false,
    })),
  ]

  const { error } = await supabase.from('orchestrator_events').insert(rows)
  if (error) throw error
  return rows.length
}

/**
 * Verwijder eerder geschreven, nog onresolved flow-events. Voorkomt
 * dat dezelfde issue-rij elke scan duplicate inserts oplevert.
 */
async function clearPreviousOpenFlowEvents(supabase: SupabaseClient) {
  await supabase
    .from('orchestrator_events')
    .delete()
    .like('type', 'flow_%')
    .eq('resolved', false)
}

export async function scanAndPersist(supabase: SupabaseClient): Promise<ScanReport> {
  const appDir = findAppDir()
  const graph  = await buildGraph(appDir)
  const nav    = navHrefs()
  const issues = detectIssues(graph, nav)
  const suggestions = buildNavSuggestions(graph.nodes, nav)

  await clearPreviousOpenFlowEvents(supabase)
  const inserted = await persistFindings(supabase, issues, suggestions)

  return {
    scanned_at:  new Date().toISOString(),
    app_dir:     appDir,
    route_count: graph.nodes.length,
    edge_count:  graph.edges.length,
    issues,
    suggestions,
    inserted,
  }
}
