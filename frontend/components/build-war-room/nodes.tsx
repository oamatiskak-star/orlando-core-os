'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Building2, Map, Hammer, Flag, ListChecks, GitPullRequest, Banknote, AlertTriangle } from 'lucide-react'
import { NODE_ACCENT, NODE_SIZE, statusColor, isLowTrust, type BuildNodeType } from '@/lib/build-war-room/graph'

type Raw = {
  node_type: BuildNodeType
  label: string | null
  status: string | null
  progress: number | null
  score: number | null
  entity_slug: string | null
  payload: Record<string, unknown> | null
}

function p<T = unknown>(data: Raw, key: string): T | undefined {
  return (data.payload?.[key] as T) ?? undefined
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ color: statusColor(status), background: `${statusColor(status)}1a` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusColor(status) }} />
      {status}
    </span>
  )
}

// transparantie-badge: afgeleide / lage-confidence koppeling (aanscherping 2/4)
function TrustBadge({ data }: { data: Raw }) {
  if (!isLowTrust(data.payload)) return null
  const conf = Number(data.payload?.['confidence'])
  return (
    <span
      title={`Afgeleide koppeling — confidence ${Number.isNaN(conf) ? '?' : conf}`}
      className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-400/10"
    >
      <AlertTriangle size={9} /> inferred
    </span>
  )
}

function Shell({
  type, hasTarget = true, hasSource = true, children,
}: {
  type: BuildNodeType; hasTarget?: boolean; hasSource?: boolean; children: React.ReactNode
}) {
  const size = NODE_SIZE[type]
  const accent = NODE_ACCENT[type]
  return (
    <div
      className="rounded-lg border bg-[#0e1525] text-white shadow-md overflow-hidden"
      style={{ width: size.w, minHeight: size.h, borderColor: `${accent}55`, borderTopColor: accent, borderTopWidth: 3 }}
    >
      {hasTarget && <Handle type="target" position={Position.Top} style={{ background: accent, border: 'none' }} />}
      <div className="p-2.5">{children}</div>
      {hasSource && <Handle type="source" position={Position.Bottom} style={{ background: accent, border: 'none' }} />}
    </div>
  )
}

function TypeRow({ icon: Icon, label, accent }: { icon: typeof Map; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
      <Icon size={11} />
      {label}
    </div>
  )
}

function ProgressBar({ pct, accent }: { pct: number; accent: string }) {
  return (
    <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: accent }} />
    </div>
  )
}

export function EntityNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="entity" hasTarget={!!p<string>(d, 'parent_slug')}>
      <TypeRow icon={Building2} label="Entiteit" accent={NODE_ACCENT.entity} />
      <div className="mt-1 text-sm font-semibold leading-tight">{d.label}</div>
      <div className="mt-0.5 text-[10px] text-white/40">{p<string>(d, 'type') ?? '—'}</div>
    </Shell>
  )
}

export function ProgramNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="program">
      <div className="flex items-center justify-between">
        <TypeRow icon={Map} label="Programma" accent={NODE_ACCENT.program} />
        <StatusBadge status={d.status} />
      </div>
      <div className="mt-1 text-xs font-semibold leading-tight">{d.label}</div>
    </Shell>
  )
}

export function ProjectNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  const owner = p<string>(d, 'owner')
  const milestone = p<string>(d, 'current_milestone')
  return (
    <Shell type="project">
      <div className="flex items-center justify-between">
        <TypeRow icon={Hammer} label="Project" accent={NODE_ACCENT.project} />
        <StatusBadge status={d.status} />
      </div>
      <div className="mt-1 text-[11px] font-medium leading-tight line-clamp-2">{d.label}</div>
      {d.progress != null && <ProgressBar pct={d.progress} accent={NODE_ACCENT.project} />}
      <div className="mt-1 flex items-center justify-between text-[9px] text-white/45">
        <span>{owner ?? '—'}</span>
        {d.progress != null && <span>{d.progress}%</span>}
      </div>
      {milestone && <div className="mt-0.5 text-[9px] text-white/35 line-clamp-1">▸ {milestone}</div>}
    </Shell>
  )
}

export function MilestoneNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  const nr = p<number>(d, 'milestone_nr')
  const verdienmodel = p<string>(d, 'verdienmodel')
  return (
    <Shell type="milestone">
      <div className="flex items-center justify-between">
        <TypeRow icon={Flag} label={`Milestone${nr != null ? ` ${nr}` : ''}`} accent={NODE_ACCENT.milestone} />
        <StatusBadge status={d.status} />
      </div>
      <div className="mt-1 text-[11px] font-medium leading-tight line-clamp-2">{d.label}</div>
      {d.progress != null && <ProgressBar pct={d.progress} accent={NODE_ACCENT.milestone} />}
      {verdienmodel && <div className="mt-1 text-[9px] text-white/40 line-clamp-1">{verdienmodel}</div>}
    </Shell>
  )
}

export function BuildItemNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  const section = p<string>(d, 'section')
  const blocker = p<string>(d, 'blocker_code')
  const owner = p<string>(d, 'owner')
  return (
    <Shell type="build_item">
      <div className="flex items-center justify-between gap-1">
        <TypeRow icon={ListChecks} label={`Item${section ? ` · ${section}` : ''}`} accent={NODE_ACCENT.build_item} />
        <div className="flex items-center gap-1">
          {blocker && <span className="rounded bg-red-500/15 px-1 py-0.5 text-[8px] font-bold text-red-400">{blocker}</span>}
          <TrustBadge data={d} />
        </div>
      </div>
      <div className="mt-1 text-[11px] font-medium leading-tight line-clamp-2">{d.label}</div>
      <div className="mt-1 flex items-center justify-between text-[9px] text-white/45">
        <StatusBadge status={d.status} />
        {owner && <span>{owner}</span>}
      </div>
    </Shell>
  )
}

export function PRNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="pr" hasSource={false}>
      <div className="flex items-center justify-between gap-1">
        <TypeRow icon={GitPullRequest} label="PR" accent={NODE_ACCENT.pr} />
        <TrustBadge data={d} />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs font-semibold">{d.label}</span>
        <StatusBadge status={d.status} />
      </div>
    </Shell>
  )
}

export function RevenueNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  const amount = p<number>(d, 'expected_amount')
  const actual = p<number>(d, 'actual_amount')
  const currency = p<string>(d, 'currency') ?? 'EUR'
  const fmt = (v: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(v)
  return (
    <Shell type="revenue" hasSource={false}>
      <TypeRow icon={Banknote} label="Resultaat" accent={NODE_ACCENT.revenue} />
      <div className="mt-1 text-[11px] font-medium leading-tight line-clamp-1">{d.label}</div>
      <div className="mt-1 flex items-center gap-2 text-[10px]">
        {amount != null && <span className="font-semibold text-lime-400">{fmt(amount)}</span>}
        {actual != null && actual > 0 && <span className="text-white/50">echt {fmt(actual)}</span>}
      </div>
    </Shell>
  )
}

export const buildWarRoomNodeTypes = {
  entity: EntityNode,
  program: ProgramNode,
  project: ProjectNode,
  milestone: MilestoneNode,
  build_item: BuildItemNode,
  pr: PRNode,
  revenue: RevenueNode,
}
