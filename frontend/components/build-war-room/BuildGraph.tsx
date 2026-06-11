'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, type Node, type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  layoutGraph, NODE_ACCENT,
  type BuildRawNode, type BuildRawEdge, type BuildNodeType,
} from '@/lib/build-war-room/graph'
import { buildWarRoomNodeTypes } from './nodes'
import { createClient } from '@/lib/supabase/client'

const LEGEND: { type: BuildNodeType; label: string }[] = [
  { type: 'entity', label: 'Entiteit' },
  { type: 'program', label: 'Programma' },
  { type: 'project', label: 'Project' },
  { type: 'milestone', label: 'Milestone' },
  { type: 'build_item', label: 'Build item' },
  { type: 'pr', label: 'PR' },
  { type: 'revenue', label: 'Resultaat' },
]

// timeline-zoom: alleen nodes binnen het venster (op created_at) tonen
const ZOOMS: { key: string; label: string; days: number | null }[] = [
  { key: 'day', label: 'Dag', days: 1 },
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Maand', days: 31 },
  { key: 'quarter', label: 'Kwartaal', days: 92 },
  { key: 'year', label: 'Jaar', days: 366 },
  { key: 'all', label: 'Alles', days: null },
]

export default function BuildGraph({
  rawNodes: initialNodes, rawEdges: initialEdges, defaultZoom = 'all',
}: { rawNodes: BuildRawNode[]; rawEdges: BuildRawEdge[]; defaultZoom?: string }) {
  const [rawNodes, setRawNodes] = useState(initialNodes)
  const [rawEdges, setRawEdges] = useState(initialEdges)
  const [entity, setEntity] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [zoom, setZoom] = useState<string>(defaultZoom)
  const [live, setLive] = useState(false)

  // realtime: bij mutaties op de build-tabellen → graph opnieuw ophalen (WP4)
  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/build-tracker/war-room/graph', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setRawNodes(json.nodes ?? [])
      setRawEdges(json.edges ?? [])
    } catch { /* stil — realtime is best-effort */ }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('build-war-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'build_tracker' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'build_tracker_items' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'build_project_dependencies' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'build_programs' }, refetch)
      .subscribe((s) => setLive(s === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [refetch])

  const entityOptions = useMemo(
    () => rawNodes.filter((n) => n.node_type === 'entity').map((n) => n.entity_slug ?? '').filter(Boolean).sort(),
    [rawNodes]
  )

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

    // entity-filter: behoud de gekozen entiteit-subtree
    if (entity !== 'all') {
      keep = new Set<string>()
      const root = rawNodes.find((n) => n.node_type === 'entity' && n.entity_slug === entity)
      const stack = root ? [root.node_id] : []
      while (stack.length) {
        const id = stack.pop()!
        if (keep.has(id)) continue
        keep.add(id)
        for (const c of childrenOf.get(id) ?? []) stack.push(c)
      }
    }

    // status-filter: alleen project/build_item/pr met de gekozen status + hun voorouders
    if (status !== 'all') {
      const survive = new Set<string>()
      for (const n of rawNodes) {
        if (!keep.has(n.node_id)) continue
        if ((n.status ?? '').toLowerCase() === status) {
          survive.add(n.node_id)
          let cur: string | null = n.parent_id
          while (cur && byId.has(cur)) { survive.add(cur); cur = byId.get(cur)!.parent_id }
        }
      }
      keep = new Set([...keep].filter((id) => survive.has(id)))
    }

    // timeline-zoom: nodes binnen het venster + voorouders (entiteit/programma blijven anker)
    const days = ZOOMS.find((z) => z.key === zoom)?.days ?? null
    if (days != null) {
      const cutoff = Date.now() - days * 86400000
      const survive = new Set<string>()
      for (const n of rawNodes) {
        if (!keep.has(n.node_id)) continue
        const anchor = n.node_type === 'entity' || n.node_type === 'program'
        const ts = n.created_at ? new Date(n.created_at).getTime() : null
        if (anchor || (ts != null && ts >= cutoff)) {
          survive.add(n.node_id)
          let cur: string | null = n.parent_id
          while (cur && byId.has(cur)) { survive.add(cur); cur = byId.get(cur)!.parent_id }
        }
      }
      keep = new Set([...keep].filter((id) => survive.has(id)))
    }

    const ns = rawNodes.filter((n) => keep.has(n.node_id))
    const es = rawEdges.filter((e) => keep.has(e.source_id) && keep.has(e.target_id))
    return layoutGraph(ns, es)
  }, [rawNodes, rawEdges, entity, status, zoom])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(filtered.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(filtered.edges)

  useEffect(() => {
    setNodes(filtered.nodes)
    setEdges(filtered.edges)
  }, [filtered, setNodes, setEdges])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select label="Entiteit" value={entity} onChange={setEntity} options={entityOptions} />
        <Select label="Status" value={status} onChange={setStatus}
          options={['live', 'building', 'testing', 'deploying', 'planned', 'paused', 'failed']} />
        <div className="flex items-center gap-1 rounded border border-white/10 bg-[#0e1525] p-0.5">
          {ZOOMS.map((z) => (
            <button key={z.key} onClick={() => setZoom(z.key)}
              className={`rounded px-2 py-1 text-[10px] font-medium ${zoom === z.key ? 'bg-violet-500/25 text-violet-300' : 'text-white/45 hover:text-white/70'}`}>
              {z.label}
            </button>
          ))}
        </div>
        {(entity !== 'all' || status !== 'all' || zoom !== 'all') && (
          <button onClick={() => { setEntity('all'); setStatus('all'); setZoom('all') }}
            className="rounded border border-white/10 px-2 py-1 text-xs text-white/60 hover:text-white">Reset</button>
        )}
        <span className={`flex items-center gap-1 text-[10px] ${live ? 'text-emerald-400' : 'text-white/30'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-emerald-400' : 'bg-white/30'}`} /> realtime
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          {LEGEND.map((l) => (
            <span key={l.type} className="flex items-center gap-1 text-[10px] text-white/45">
              <span className="h-2 w-2 rounded-sm" style={{ background: NODE_ACCENT[l.type] }} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="h-[calc(100vh-250px)] min-h-[520px] rounded-lg border border-white/5 bg-[#070b14]">
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
          nodeTypes={buildWarRoomNodeTypes}
          fitView fitViewOptions={{ maxZoom: 1, padding: 0.25 }} minZoom={0.05}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1e293b" gap={20} />
          <Controls className="!bg-[#0e1525] !border-white/10" />
          <MiniMap pannable zoomable
            nodeColor={(n) => NODE_ACCENT[(n.type as BuildNodeType)] ?? '#64748b'}
            maskColor="rgba(7,11,20,0.7)" className="!bg-[#0e1525]" />
        </ReactFlow>
      </div>
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-[10px] uppercase tracking-wide text-white/40">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="rounded border border-white/10 bg-[#0e1525] px-2 py-1 text-xs text-white capitalize">
        <option value="all">Alle</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}
