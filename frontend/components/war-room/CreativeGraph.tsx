'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  layoutGraph, NODE_ACCENT,
  type WarRoomRawNode, type WarRoomRawEdge, type WarRoomNodeType,
} from '@/lib/war-room/graph'
import { warRoomNodeTypes } from './nodes'

const LEGEND: { type: WarRoomNodeType; label: string }[] = [
  { type: 'campaign', label: 'Campagne' },
  { type: 'channel', label: 'Kanaal' },
  { type: 'hook', label: 'Hook' },
  { type: 'creative', label: 'Creative' },
  { type: 'platform', label: 'Platform' },
]

export default function CreativeGraph({
  rawNodes, rawEdges,
}: { rawNodes: WarRoomRawNode[]; rawEdges: WarRoomRawEdge[] }) {
  const [campaign, setCampaign] = useState<string>('all')
  const [platform, setPlatform] = useState<string>('all')

  const campaignOptions = useMemo(
    () => rawNodes.filter((n) => n.node_type === 'campaign').map((n) => n.label ?? '').sort(),
    [rawNodes]
  )
  const platformOptions = useMemo(
    () => Array.from(new Set(rawNodes.filter((n) => n.node_type === 'platform').map((n) => n.platform ?? ''))).filter(Boolean).sort(),
    [rawNodes]
  )

  // filter de raw graaf (klein genoeg om client-side te doen)
  const filtered = useMemo(() => {
    const byId = new Map(rawNodes.map((n) => [n.node_id, n]))
    const childrenOf = new Map<string, string[]>()
    for (const n of rawNodes) {
      if (n.parent_id) {
        if (!childrenOf.has(n.parent_id)) childrenOf.set(n.parent_id, [])
        childrenOf.get(n.parent_id)!.push(n.node_id)
      }
    }
    let keep = new Set(rawNodes.map((n) => n.node_id))

    if (campaign !== 'all') {
      const root = rawNodes.find((n) => n.node_type === 'campaign' && n.label === campaign)
      keep = new Set<string>()
      const stack = root ? [root.node_id] : []
      while (stack.length) {
        const id = stack.pop()!
        if (keep.has(id)) continue
        keep.add(id)
        for (const c of childrenOf.get(id) ?? []) stack.push(c)
      }
    }

    if (platform !== 'all') {
      // creatives met een platform-child van het gekozen platform + hun voorouders + die platform-nodes
      const matchPlatformNodes = rawNodes.filter(
        (n) => n.node_type === 'platform' && n.platform === platform && keep.has(n.node_id)
      )
      const survive = new Set<string>()
      for (const pn of matchPlatformNodes) {
        survive.add(pn.node_id)
        let cur: string | null = pn.parent_id
        while (cur && byId.has(cur)) {
          survive.add(cur)
          cur = byId.get(cur)!.parent_id
        }
      }
      keep = new Set([...keep].filter((id) => survive.has(id)))
    }

    const ns = rawNodes.filter((n) => keep.has(n.node_id))
    const es = rawEdges.filter((e) => keep.has(e.source_id) && keep.has(e.target_id))
    return layoutGraph(ns, es)
  }, [rawNodes, rawEdges, campaign, platform])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(filtered.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(filtered.edges)

  useEffect(() => {
    setNodes(filtered.nodes)
    setEdges(filtered.edges)
  }, [filtered, setNodes, setEdges])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-white/40">Campagne</label>
          <select
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            className="rounded border border-white/10 bg-[#0e1525] px-2 py-1 text-xs text-white capitalize"
          >
            <option value="all">Alle</option>
            {campaignOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-white/40">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded border border-white/10 bg-[#0e1525] px-2 py-1 text-xs text-white"
          >
            <option value="all">Alle</option>
            {platformOptions.map((pf) => (
              <option key={pf} value={pf}>{pf}</option>
            ))}
          </select>
        </div>
        {(campaign !== 'all' || platform !== 'all') && (
          <button
            onClick={() => { setCampaign('all'); setPlatform('all') }}
            className="rounded border border-white/10 px-2 py-1 text-xs text-white/60 hover:text-white"
          >
            Reset
          </button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {LEGEND.map((l) => (
            <span key={l.type} className="flex items-center gap-1 text-[10px] text-white/45">
              <span className="h-2 w-2 rounded-sm" style={{ background: NODE_ACCENT[l.type] }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="h-[calc(100vh-230px)] min-h-[520px] rounded-lg border border-white/5 bg-[#070b14]">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={warRoomNodeTypes}
          fitView
          minZoom={0.1}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={20} />
          <Controls className="!bg-[#0e1525] !border-white/10" />
          <MiniMap
            pannable zoomable
            nodeColor={(n) => NODE_ACCENT[(n.type as WarRoomNodeType)] ?? '#64748b'}
            maskColor="rgba(7,11,20,0.7)"
            className="!bg-[#0e1525]"
          />
        </ReactFlow>
      </div>
    </div>
  )
}
