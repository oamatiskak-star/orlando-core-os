// Build Tracker War Room — gedeelde types, kleuren en dagre auto-layout.
// Spiegelt frontend/lib/war-room/graph.ts (Media War Room), maar voor het build-domein:
// entity -> program -> project -> milestone -> build_item -> pr -> revenue.
import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'

export type BuildNodeType =
  | 'entity' | 'program' | 'project' | 'milestone' | 'build_item' | 'pr' | 'revenue'

export type BuildRawNode = {
  node_id: string
  node_type: BuildNodeType
  label: string | null
  parent_id: string | null
  entity_slug: string | null
  status: string | null
  progress: number | null
  score: number | null
  created_at: string | null
  target_at: string | null
  payload: Record<string, unknown> | null
}

export type BuildEdgeType = 'spine' | 'dependency' | 'blocker' | 'revenue' | 'pr_link'

export type BuildRawEdge = {
  source_id: string
  target_id: string
  edge_type: BuildEdgeType
}

// node-type → afmeting (px) voor dagre + render
export const NODE_SIZE: Record<BuildNodeType, { w: number; h: number }> = {
  entity: { w: 220, h: 72 },
  program: { w: 220, h: 72 },
  project: { w: 250, h: 116 },
  milestone: { w: 210, h: 88 },
  build_item: { w: 240, h: 104 },
  pr: { w: 150, h: 60 },
  revenue: { w: 180, h: 78 },
}

export const NODE_ACCENT: Record<BuildNodeType, string> = {
  entity: '#a855f7', // violet
  program: '#6366f1', // indigo
  project: '#38bdf8', // sky
  milestone: '#f59e0b', // amber
  build_item: '#22d3ee', // cyan
  pr: '#34d399', // emerald
  revenue: '#a3e635', // lime
}

export const EDGE_COLOR: Record<BuildEdgeType, string> = {
  spine: '#475569',
  dependency: '#6366f1',
  blocker: '#ef4444',
  revenue: '#a3e635',
  pr_link: '#34d399',
}

// status → kleur voor de statusbadge (build-domein)
export function statusColor(status: string | null): string {
  if (!status) return '#64748b'
  const s = status.toLowerCase()
  if (['live', 'done', 'confirmed', 'merged', 'actief'].includes(s)) return '#22c55e'
  if (['failed', 'paused', 'closed', 'rejected', 'blocked'].includes(s)) return '#ef4444'
  if (['building', 'testing', 'deploying', 'draft', 'proposed', 'in_progress'].includes(s)) return '#f59e0b'
  return '#64748b'
}

// lage confidence / afgeleide bron → transparantie-badge (aanscherping 2/4)
export function isLowTrust(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false
  const conf = Number(payload['confidence'])
  const src = String(payload['source'] ?? payload['source_reason'] ?? '')
  if (!Number.isNaN(conf) && conf < 0.7) return true
  return /inferred|title_fuzzy/.test(src)
}

// dagre top-down layered layout → React Flow nodes met posities
export function layoutGraph(
  rawNodes: BuildRawNode[],
  rawEdges: BuildRawEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 26, ranksep: 68, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  const known = new Set(rawNodes.map((n) => n.node_id))

  for (const n of rawNodes) {
    const size = NODE_SIZE[n.node_type] ?? { w: 210, h: 80 }
    g.setNode(n.node_id, { width: size.w, height: size.h })
  }
  const validEdges = rawEdges.filter((e) => known.has(e.source_id) && known.has(e.target_id))
  for (const e of validEdges) g.setEdge(e.source_id, e.target_id)

  dagre.layout(g)

  const nodes: Node[] = rawNodes.map((n) => {
    const pos = g.node(n.node_id)
    const size = NODE_SIZE[n.node_type] ?? { w: 210, h: 80 }
    return {
      id: n.node_id,
      type: n.node_type,
      position: { x: (pos?.x ?? 0) - size.w / 2, y: (pos?.y ?? 0) - size.h / 2 },
      data: n as unknown as Record<string, unknown>,
    }
  })

  const edges: Edge[] = validEdges.map((e, i) => ({
    id: `${e.source_id}->${e.target_id}-${i}`,
    source: e.source_id,
    target: e.target_id,
    type: 'smoothstep',
    animated: e.edge_type === 'blocker',
    style: {
      stroke: EDGE_COLOR[e.edge_type] ?? '#475569',
      strokeWidth: e.edge_type === 'spine' ? 1.4 : 2,
      strokeDasharray: e.edge_type === 'dependency' ? '5 4' : undefined,
    },
  }))

  return { nodes, edges }
}
