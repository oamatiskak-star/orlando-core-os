'use client'

import {
  ReactFlow, Background, Controls, Handle, Position,
  type Node, type Edge, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

export type FunnelStage = { key: string; label: string; value: string; raw: number }

function StageNode({ data }: NodeProps) {
  const d = data as unknown as { label: string; value: string; active: boolean; first: boolean; last: boolean }
  const c = d.active ? '#22c55e' : '#475569'
  return (
    <div className="rounded-lg border bg-[#0e1525] text-center text-white shadow-md" style={{ width: 150, borderColor: `${c}88`, borderTopColor: c, borderTopWidth: 3 }}>
      {!d.first && <Handle type="target" position={Position.Left} style={{ background: c, border: 'none' }} />}
      <div className="p-3">
        <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: c }}>{d.label}</div>
        <div className="mt-1 text-lg font-semibold" style={{ color: d.active ? '#fff' : 'rgba(255,255,255,0.4)' }}>{d.value}</div>
      </div>
      {!d.last && <Handle type="source" position={Position.Right} style={{ background: c, border: 'none' }} />}
    </div>
  )
}

const nodeTypes = { stage: StageNode }

export default function RevenueFunnel({ stages }: { stages: FunnelStage[] }) {
  const nodes: Node[] = stages.map((s, i) => ({
    id: s.key,
    type: 'stage',
    position: { x: i * 210, y: 0 },
    data: { label: s.label, value: s.value, active: s.raw > 0, first: i === 0, last: i === stages.length - 1 },
  }))
  const edges: Edge[] = stages.slice(1).map((s, i) => ({
    id: `${stages[i].key}->${s.key}`,
    source: stages[i].key,
    target: s.key,
    type: 'smoothstep',
    animated: s.raw > 0,
    style: { stroke: s.raw > 0 ? '#22c55e' : '#334155', strokeWidth: 1.6 },
  }))

  return (
    <div className="h-[300px] rounded-lg border border-white/5 bg-[#070b14]">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.2} nodesDraggable={false} proOptions={{ hideAttribution: true }}>
        <Background color="#1e293b" gap={20} />
        <Controls showInteractive={false} className="!bg-[#0e1525] !border-white/10" />
      </ReactFlow>
    </div>
  )
}
