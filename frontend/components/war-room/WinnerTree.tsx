'use client'

import { useMemo } from 'react'
import dagre from '@dagrejs/dagre'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { statusColor } from '@/lib/war-room/graph'
import { Trophy, GitBranch } from 'lucide-react'

export type WinnerVariant = {
  job_id: string
  output_id: string | null
  label: string
  status: string | null
  variant_kind: string | null
}
export type WinnerGroup = {
  source_id: string
  source_label: string
  variants: WinnerVariant[]
}

// outcome → kleur: winnaar (groen) / verliezer (rood) / lopend (neutraal)
function outcomeColor(status: string | null): string {
  if (!status) return '#64748b'
  const s = status.toLowerCase()
  if (['published', 'ready', 'verified_live', 'live', 'winner'].includes(s)) return '#22c55e'
  if (['failed', 'unrecoverable', 'rejected', 'loser', 'archived'].includes(s)) return '#ef4444'
  return '#f59e0b' // pending/rendering/processing = lopend
}

function SourceNode({ data }: NodeProps) {
  const d = data as unknown as { label: string }
  return (
    <div className="rounded-lg border bg-[#0e1525] text-white shadow-md" style={{ width: 240, borderColor: '#22c55e88', borderTopColor: '#22c55e', borderTopWidth: 3 }}>
      <Handle type="source" position={Position.Bottom} style={{ background: '#22c55e', border: 'none' }} />
      <div className="p-2.5">
        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
          <Trophy size={11} /> Winnaar — bron
        </div>
        <div className="mt-1 text-xs font-medium leading-tight line-clamp-2">{d.label}</div>
      </div>
    </div>
  )
}

function VariantNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; status: string | null; variant_kind: string | null }
  const c = outcomeColor(d.status)
  return (
    <div className="rounded-lg border bg-[#0e1525] text-white shadow-md" style={{ width: 210, borderColor: `${c}88`, borderTopColor: c, borderTopWidth: 3 }}>
      <Handle type="target" position={Position.Top} style={{ background: c, border: 'none' }} />
      <div className="p-2.5">
        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: c }}>
          <GitBranch size={11} /> {d.variant_kind ?? 'variant'}
        </div>
        <div className="mt-1 text-[11px] leading-tight line-clamp-2">{d.label}</div>
        {d.status && (
          <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase" style={{ color: c, background: `${c}1a` }}>{d.status}</span>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { winnerSource: SourceNode, winnerVariant: VariantNode }

export default function WinnerTree({ groups }: { groups: WinnerGroup[] }) {
  const { nodes, edges } = useMemo(() => {
    const g = new dagre.graphlib.Graph()
    g.setGraph({ rankdir: 'TB', nodesep: 24, ranksep: 64, marginx: 16, marginy: 16 })
    g.setDefaultEdgeLabel(() => ({}))
    const rawNodes: { id: string; type: string; data: Record<string, unknown>; w: number; h: number }[] = []
    const rawEdges: { source: string; target: string }[] = []

    for (const grp of groups) {
      const sid = `src:${grp.source_id}`
      rawNodes.push({ id: sid, type: 'winnerSource', data: { label: grp.source_label }, w: 240, h: 70 })
      g.setNode(sid, { width: 240, height: 70 })
      grp.variants.forEach((v, i) => {
        const vid = v.output_id ? `out:${v.output_id}` : `job:${v.job_id}-${i}`
        rawNodes.push({ id: vid, type: 'winnerVariant', data: { label: v.label, status: v.status, variant_kind: v.variant_kind }, w: 210, h: 84 })
        g.setNode(vid, { width: 210, height: 84 })
        g.setEdge(sid, vid)
        rawEdges.push({ source: sid, target: vid })
      })
    }
    dagre.layout(g)

    const nodes: Node[] = rawNodes.map((n) => {
      const p = g.node(n.id)
      return { id: n.id, type: n.type, position: { x: (p?.x ?? 0) - n.w / 2, y: (p?.y ?? 0) - n.h / 2 }, data: n.data }
    })
    const edges: Edge[] = rawEdges.map((e, i) => ({
      id: `${e.source}->${e.target}-${i}`, source: e.source, target: e.target,
      type: 'smoothstep', animated: true, style: { stroke: '#22c55e', strokeWidth: 2 },
    }))
    return { nodes, edges }
  }, [groups])

  return (
    <div className="h-[calc(100vh-300px)] min-h-[440px] rounded-lg border border-white/5 bg-[#070b14]">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView minZoom={0.1} proOptions={{ hideAttribution: true }}>
        <Background color="#1e293b" gap={20} />
        <Controls className="!bg-[#0e1525] !border-white/10" />
        <MiniMap nodeColor="#22c55e" maskColor="rgba(7,11,20,0.7)" className="!bg-[#0e1525]" />
      </ReactFlow>
    </div>
  )
}
