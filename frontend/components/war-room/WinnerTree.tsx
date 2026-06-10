'use client'

import { useMemo } from 'react'
import dagre from '@dagrejs/dagre'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Trophy, GitBranch } from 'lucide-react'

export type VariantDecision = 'scale' | 'keep_testing' | 'stop' | 'unknown'

export type WinnerVariant = {
  job_id: string
  output_id: string | null
  label: string
  status: string | null
  variant_kind: string | null
  views: number | null
  ctr: number | null
  retention: number | null
}
export type WinnerGroup = {
  source_id: string
  source_label: string
  decision: VariantDecision
  variants: WinnerVariant[]
}

const DECISION_LABEL: Record<VariantDecision, string> = {
  scale: 'OPSCHALEN', keep_testing: 'BLIJF TESTEN', stop: 'STOPPEN', unknown: 'GEEN DATA',
}
const DECISION_COLOR: Record<VariantDecision, string> = {
  scale: '#22c55e', keep_testing: '#f59e0b', stop: '#ef4444', unknown: '#475569',
}

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)

// outcome → kleur: winnaar (groen) / verliezer (rood) / lopend (neutraal)
function outcomeColor(status: string | null): string {
  if (!status) return '#64748b'
  const s = status.toLowerCase()
  if (['published', 'ready', 'verified_live', 'live', 'winner'].includes(s)) return '#22c55e'
  if (['failed', 'unrecoverable', 'rejected', 'loser', 'archived'].includes(s)) return '#ef4444'
  return '#f59e0b' // pending/rendering/processing = lopend
}

function SourceNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; decision: VariantDecision }
  const dc = DECISION_COLOR[d.decision]
  return (
    <div className="rounded-lg border bg-[#0e1525] text-white shadow-md" style={{ width: 240, borderColor: '#22c55e88', borderTopColor: '#22c55e', borderTopWidth: 3 }}>
      <Handle type="source" position={Position.Bottom} style={{ background: '#22c55e', border: 'none' }} />
      <div className="p-2.5">
        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
          <Trophy size={11} /> Winnaar — bron
        </div>
        <div className="mt-1 text-xs font-medium leading-tight line-clamp-2">{d.label}</div>
        <span className="mt-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color: dc, background: `${dc}1a`, border: `1px solid ${dc}55` }}>
          {DECISION_LABEL[d.decision]}
        </span>
      </div>
    </div>
  )
}

function VariantNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; status: string | null; variant_kind: string | null; views: number | null; ctr: number | null; retention: number | null }
  const c = outcomeColor(d.status)
  const hasMetrics = d.views != null || d.ctr != null || d.retention != null
  return (
    <div className="rounded-lg border bg-[#0e1525] text-white shadow-md" style={{ width: 210, borderColor: `${c}88`, borderTopColor: c, borderTopWidth: 3 }}>
      <Handle type="target" position={Position.Top} style={{ background: c, border: 'none' }} />
      <div className="p-2.5">
        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: c }}>
          <GitBranch size={11} /> {d.variant_kind ?? 'variant'}
        </div>
        <div className="mt-1 text-[11px] leading-tight line-clamp-2">{d.label}</div>
        <div className="mt-1.5 grid grid-cols-3 gap-1 rounded bg-white/[0.03] px-1.5 py-1 text-center">
          <div><div className="text-[7px] uppercase text-white/30">views</div><div className="text-[10px] font-semibold tabular-nums" style={{ color: d.views != null ? '#fff' : 'rgba(255,255,255,0.25)' }}>{d.views != null ? compact(d.views) : '—'}</div></div>
          <div><div className="text-[7px] uppercase text-white/30">ctr</div><div className="text-[10px] font-semibold tabular-nums" style={{ color: d.ctr != null ? '#34d399' : 'rgba(255,255,255,0.25)' }}>{d.ctr != null ? `${d.ctr}%` : '—'}</div></div>
          <div><div className="text-[7px] uppercase text-white/30">ret</div><div className="text-[10px] font-semibold tabular-nums" style={{ color: d.retention != null ? '#38bdf8' : 'rgba(255,255,255,0.25)' }}>{d.retention != null ? `${d.retention}%` : '—'}</div></div>
        </div>
        {!hasMetrics && <div className="mt-1 text-[8px] italic text-white/25">nog geen metrics</div>}
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
      rawNodes.push({ id: sid, type: 'winnerSource', data: { label: grp.source_label, decision: grp.decision }, w: 240, h: 92 })
      g.setNode(sid, { width: 240, height: 92 })
      grp.variants.forEach((v, i) => {
        const vid = v.output_id ? `out:${v.output_id}` : `job:${v.job_id}-${i}`
        rawNodes.push({ id: vid, type: 'winnerVariant', data: { label: v.label, status: v.status, variant_kind: v.variant_kind, views: v.views, ctr: v.ctr, retention: v.retention }, w: 210, h: 124 })
        g.setNode(vid, { width: 210, height: 124 })
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
