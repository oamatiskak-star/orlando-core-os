// Media War Room — gedeelde types, kleuren en dagre auto-layout voor de Creative Graph.
import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'

export type WarRoomNodeType = 'campaign' | 'channel' | 'hook' | 'creative' | 'platform'

export type WarRoomRawNode = {
  node_id: string
  node_type: WarRoomNodeType
  label: string | null
  parent_id: string | null
  channel_id: string | null
  platform: string | null
  status: string | null
  score: number | null
  thumbnail_url: string | null
  created_at: string | null
  scheduled_at: string | null
  payload: Record<string, unknown> | null
}

export type WarRoomRawEdge = {
  source_id: string
  target_id: string
  edge_type: 'spine' | 'winner' | 'revenue'
}

// node-type → afmeting (px) voor dagre + render
export const NODE_SIZE: Record<WarRoomNodeType, { w: number; h: number }> = {
  campaign: { w: 210, h: 64 },
  channel: { w: 210, h: 76 },
  hook: { w: 250, h: 96 },
  creative: { w: 250, h: 150 },
  platform: { w: 170, h: 64 },
}

export const NODE_ACCENT: Record<WarRoomNodeType, string> = {
  campaign: '#a855f7', // violet
  channel: '#38bdf8', // sky
  hook: '#f59e0b', // amber
  creative: '#22d3ee', // cyan
  platform: '#34d399', // emerald
}

export const EDGE_COLOR: Record<WarRoomRawEdge['edge_type'], string> = {
  spine: '#475569',
  winner: '#22c55e',
  revenue: '#f59e0b',
}

// status → kleur voor de statusbadge
export function statusColor(status: string | null): string {
  if (!status) return '#64748b'
  const s = status.toLowerCase()
  if (['published', 'verified_live', 'live', 'ready'].includes(s)) return '#22c55e'
  if (['failed', 'unrecoverable', 'manual_review_required', 'error'].includes(s)) return '#ef4444'
  if (['uploading', 'processing', 'rendering', 'preparing', 'verifying'].includes(s)) return '#f59e0b'
  return '#64748b'
}

// dagre top-down layered layout → React Flow nodes met posities
export function layoutGraph(
  rawNodes: WarRoomRawNode[],
  rawEdges: WarRoomRawEdge[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 70, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  const known = new Set(rawNodes.map((n) => n.node_id))

  for (const n of rawNodes) {
    const size = NODE_SIZE[n.node_type] ?? { w: 200, h: 80 }
    g.setNode(n.node_id, { width: size.w, height: size.h })
  }
  const validEdges = rawEdges.filter((e) => known.has(e.source_id) && known.has(e.target_id))
  for (const e of validEdges) g.setEdge(e.source_id, e.target_id)

  dagre.layout(g)

  const nodes: Node[] = rawNodes.map((n) => {
    const pos = g.node(n.node_id)
    const size = NODE_SIZE[n.node_type] ?? { w: 200, h: 80 }
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
    animated: e.edge_type === 'winner',
    style: { stroke: EDGE_COLOR[e.edge_type], strokeWidth: e.edge_type === 'spine' ? 1.4 : 2 },
  }))

  return { nodes, edges }
}
