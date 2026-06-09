'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Megaphone, Tv2, Lightbulb, Clapperboard, Send } from 'lucide-react'
import { NODE_ACCENT, NODE_SIZE, statusColor, type WarRoomNodeType } from '@/lib/war-room/graph'

type Raw = {
  node_type: WarRoomNodeType
  label: string | null
  status: string | null
  score: number | null
  platform: string | null
  scheduled_at: string | null
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

function Shell({
  type,
  hasTarget = true,
  hasSource = true,
  children,
}: {
  type: WarRoomNodeType
  hasTarget?: boolean
  hasSource?: boolean
  children: React.ReactNode
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

function TypeRow({ icon: Icon, label, accent }: { icon: typeof Tv2; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
      <Icon size={11} />
      {label}
    </div>
  )
}

export function CampaignNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="campaign" hasTarget={false}>
      <TypeRow icon={Megaphone} label="Campagne" accent={NODE_ACCENT.campaign} />
      <div className="mt-1 text-sm font-semibold capitalize">{d.label}</div>
    </Shell>
  )
}

export function ChannelNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="channel">
      <TypeRow icon={Tv2} label="Kanaal" accent={NODE_ACCENT.channel} />
      <div className="mt-1 text-sm font-semibold leading-tight">{d.label}</div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-white/50">
        <span>{p<string>(d, 'niche') ?? '—'}</span>
        <StatusBadge status={d.status} />
      </div>
    </Shell>
  )
}

export function HookNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  const variants = p<number>(d, 'variant_count')
  return (
    <Shell type="hook">
      <TypeRow icon={Lightbulb} label="Hook" accent={NODE_ACCENT.hook} />
      <div className="mt-1 text-xs font-medium leading-snug line-clamp-3">{d.label}</div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/45">
        {variants != null && <span>{variants} variant{variants === 1 ? '' : 'en'}</span>}
        {d.score != null && <span className="font-semibold text-amber-400">score {Math.round(d.score)}</span>}
      </div>
    </Shell>
  )
}

export function CreativeNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  const concept = p<string>(d, 'thumbnail_concept')
  const kind = p<string>(d, 'kind')
  const views = p<number>(d, 'views')
  const ctr = p<number>(d, 'ctr_pct')
  const retention = p<number>(d, 'retention_pct')
  return (
    <Shell type="creative">
      <div className="flex items-center justify-between">
        <TypeRow icon={Clapperboard} label={`Creative${kind ? ` · ${kind}` : ''}`} accent={NODE_ACCENT.creative} />
        <StatusBadge status={d.status} />
      </div>
      {/* thumbnail-concept facet (visual_prompt); echte render-thumbnail komt met thumbnail-engine */}
      <div className="mt-1.5 h-12 rounded bg-gradient-to-br from-cyan-500/15 to-violet-500/10 p-1.5 text-[9px] leading-tight text-white/55 line-clamp-3 border border-white/5">
        {concept ? concept : <span className="italic text-white/30">geen thumbnail-concept</span>}
      </div>
      <div className="mt-1.5 text-[11px] font-medium leading-tight line-clamp-2">{d.label}</div>
      <div className="mt-1.5 flex items-center gap-2 text-[9px] text-white/45">
        {views != null && <span>{Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(views)} views</span>}
        {ctr != null && <span className="text-emerald-400">CTR {ctr}%</span>}
        {retention != null && <span className="text-sky-400">ret {retention}%</span>}
        {views == null && ctr == null && <span className="italic text-white/25">nog geen metrics</span>}
      </div>
    </Shell>
  )
}

export function PlatformNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="platform" hasSource={false}>
      <TypeRow icon={Send} label={d.platform ?? 'Platform'} accent={NODE_ACCENT.platform} />
      <div className="mt-1">
        <StatusBadge status={d.status} />
      </div>
    </Shell>
  )
}

export const warRoomNodeTypes = {
  campaign: CampaignNode,
  channel: ChannelNode,
  hook: HookNode,
  creative: CreativeNode,
  platform: PlatformNode,
}
