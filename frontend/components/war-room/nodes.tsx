'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Megaphone, Tv2, Lightbulb, Clapperboard, Send, Sparkles, AlertTriangle } from 'lucide-react'
import { NODE_ACCENT, NODE_SIZE, type WarRoomNodeType, type WarRoomHermesRec } from '@/lib/war-room/graph'
import {
  WINNER_LABEL, WINNER_COLOR, OPERATOR_LABEL, OPERATOR_COLOR, type NodeScore,
} from '@/lib/war-room/scoring'

// node.data = WarRoomRawNode + geïnjecteerde _score / _hermes (door CreativeGraph)
type Raw = {
  node_type: WarRoomNodeType
  label: string | null
  status: string | null
  score: number | null
  platform: string | null
  scheduled_at: string | null
  payload: Record<string, unknown> | null
  _score?: NodeScore
  _hermes?: WarRoomHermesRec[]
}

function p<T = unknown>(data: Raw, key: string): T | undefined {
  return (data.payload?.[key] as T) ?? undefined
}

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

// ── Winner Score-badge (laag 2) ─────────────────────────────────────────────────
function WinnerBadge({ s }: { s?: NodeScore }) {
  if (!s) return null
  const c = WINNER_COLOR[s.winner_status]
  const showScore = s.winner_score !== null && s.winner_status !== 'insufficient_data'
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
      style={{ color: c, background: `${c}1a`, border: `1px solid ${c}55` }}
      title={
        s.winner_status === 'insufficient_data'
          ? 'Onvoldoende data voor een betrouwbare score'
          : `Winner ${s.winner_score} = Performance ${s.performance_score ?? '—'} + Commercial ${s.commercial_score ?? 'geen data'}`
      }
    >
      {WINNER_LABEL[s.winner_status]}
      {showScore && <span className="opacity-70">{s.winner_score}</span>}
    </span>
  )
}

// ── Operator-status-badge (laag 5) ──────────────────────────────────────────────
function OperatorBadge({ s }: { s?: NodeScore }) {
  if (!s) return null
  const c = OPERATOR_COLOR[s.operator_status]
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ color: c, background: `${c}1a` }}
      title={s.failure_reason ?? undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {OPERATOR_LABEL[s.operator_status]}
      {s.failure_reason && <AlertTriangle size={9} />}
    </span>
  )
}

// ── Performance-rij (laag 1) — "—" = Geen data, nooit verzonnen ──────────────────
function Metric({ label, value, accent }: { label: string; value: string | null; accent?: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[8px] uppercase tracking-wide text-white/30">{label}</span>
      <span className="text-[10px] font-semibold tabular-nums" style={{ color: value === null ? 'rgba(255,255,255,0.25)' : accent ?? '#fff' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function PerfRow({ s, show }: { s?: NodeScore; show: Array<'views' | 'ctr' | 'watch' | 'ret' | 'subs' | 'rev'> }) {
  if (!s) return null
  const cells: Record<string, { label: string; value: string | null; accent?: string }> = {
    views: { label: 'views', value: s.views != null ? compact(s.views) : null },
    ctr: { label: 'ctr', value: s.ctr_pct != null ? `${s.ctr_pct}%` : null, accent: '#34d399' },
    watch: { label: 'watch', value: s.watchtime_min != null ? `${Math.round(s.watchtime_min)}m` : null, accent: '#38bdf8' },
    ret: { label: 'ret', value: s.retention_pct != null ? `${s.retention_pct}%` : null, accent: '#38bdf8' },
    subs: { label: 'subs', value: s.subscribers != null ? compact(s.subscribers) : null, accent: '#a855f7' },
    rev: { label: 'rev', value: s.revenue_eur != null ? eur(s.revenue_eur) : null, accent: '#22c55e' },
  }
  return (
    <div
      className="mt-1.5 grid gap-1 rounded bg-white/[0.03] px-1.5 py-1"
      style={{ gridTemplateColumns: `repeat(${show.length}, minmax(0,1fr))` }}
    >
      {show.map((k) => <Metric key={k} {...cells[k]} />)}
    </div>
  )
}

// ── Revenue-confidence (laag 3, verplicht zichtbaar) ────────────────────────────
function Confidence({ s }: { s?: NodeScore }) {
  if (!s) return null
  const pct = Math.round(s.revenue_confidence * 100)
  const c = pct >= 66 ? '#22c55e' : pct >= 33 ? '#f59e0b' : '#64748b'
  return (
    <span
      className="text-[8px] font-medium"
      style={{ color: c }}
      title="Revenue attributie-confidence: hoeveel van de funnel echt gekoppeld is"
    >
      conf {pct}%{!s.has_commercial && ' · geen omzetdata'}
    </span>
  )
}

// ── Hermes node-level chip (laag 6 / condition 10) ──────────────────────────────
function HermesChip({ recs }: { recs?: WarRoomHermesRec[] }) {
  if (!recs || recs.length === 0) return null
  const top = recs[0]
  return (
    <div
      className="mt-1.5 flex items-center gap-1 rounded border border-violet-400/30 bg-violet-500/10 px-1.5 py-1 text-[9px] text-violet-200"
      title={top.rationale ?? undefined}
    >
      <Sparkles size={10} className="shrink-0 text-violet-300" />
      <span className="truncate font-medium">{top.action_kind.replace(/_/g, ' ')}</span>
      {recs.length > 1 && <span className="ml-auto shrink-0 text-violet-300/70">+{recs.length - 1}</span>}
    </div>
  )
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/50 bg-white/[0.06]">
      {status}
    </span>
  )
}

function Shell({
  type, hasTarget = true, hasSource = true, children,
}: {
  type: WarRoomNodeType; hasTarget?: boolean; hasSource?: boolean; children: React.ReactNode
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

function TypeRow({ icon: Icon, label, accent, right }: { icon: typeof Tv2; label: string; accent: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: accent }}>
      <Icon size={11} />
      {label}
      {right && <span className="ml-auto">{right}</span>}
    </div>
  )
}

export function CampaignNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="campaign" hasTarget={false}>
      <TypeRow icon={Megaphone} label="Campagne" accent={NODE_ACCENT.campaign} right={<WinnerBadge s={d._score} />} />
      <div className="mt-1 text-sm font-semibold capitalize">{d.label}</div>
      <PerfRow s={d._score} show={['views', 'ctr', 'ret', 'rev']} />
      <div className="mt-1"><Confidence s={d._score} /></div>
      <HermesChip recs={d._hermes} />
    </Shell>
  )
}

export function ChannelNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="channel">
      <TypeRow icon={Tv2} label="Kanaal" accent={NODE_ACCENT.channel} right={<WinnerBadge s={d._score} />} />
      <div className="mt-1 flex items-center justify-between gap-1">
        <div className="text-sm font-semibold leading-tight">{d.label}</div>
        <OperatorBadge s={d._score} />
      </div>
      <div className="mt-0.5 text-[10px] text-white/45">{p<string>(d, 'niche') ?? '—'}</div>
      <PerfRow s={d._score} show={['views', 'subs', 'ret', 'rev']} />
      <div className="mt-1"><Confidence s={d._score} /></div>
      <HermesChip recs={d._hermes} />
    </Shell>
  )
}

export function HookNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  const variants = p<number>(d, 'variant_count')
  return (
    <Shell type="hook">
      <TypeRow icon={Lightbulb} label="Hook" accent={NODE_ACCENT.hook} right={<WinnerBadge s={d._score} />} />
      <div className="mt-1 text-xs font-medium leading-snug line-clamp-2">{d.label}</div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/45">
        {variants != null && <span>{variants} variant{variants === 1 ? '' : 'en'}</span>}
        {d.score != null && <span className="font-semibold text-amber-400">score {Math.round(d.score)}</span>}
      </div>
      <PerfRow s={d._score} show={['views', 'ctr', 'ret']} />
    </Shell>
  )
}

export function CreativeNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  const concept = p<string>(d, 'thumbnail_concept')
  const kind = p<string>(d, 'kind')
  return (
    <Shell type="creative">
      <div className="flex items-center justify-between">
        <TypeRow icon={Clapperboard} label={`Creative${kind ? ` · ${kind}` : ''}`} accent={NODE_ACCENT.creative} />
        <WinnerBadge s={d._score} />
      </div>
      {/* thumbnail-concept facet (visual_prompt); echte render-thumbnail komt met thumbnail-engine */}
      <div className="mt-1.5 h-10 rounded bg-gradient-to-br from-cyan-500/15 to-violet-500/10 p-1.5 text-[9px] leading-tight text-white/55 line-clamp-2 border border-white/5">
        {concept ? concept : <span className="italic text-white/30">geen thumbnail-concept</span>}
      </div>
      <div className="mt-1.5 text-[11px] font-medium leading-tight line-clamp-2">{d.label}</div>
      <PerfRow s={d._score} show={['views', 'ctr', 'watch', 'ret', 'rev']} />
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <OperatorBadge s={d._score} />
        <Confidence s={d._score} />
      </div>
    </Shell>
  )
}

export function PlatformNode({ data }: NodeProps) {
  const d = data as unknown as Raw
  return (
    <Shell type="platform" hasSource={false}>
      <TypeRow icon={Send} label={d.platform ?? 'Platform'} accent={NODE_ACCENT.platform} />
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <OperatorBadge s={d._score} />
        <StatusBadge status={d.status} />
      </div>
      <PerfRow s={d._score} show={['views', 'ctr', 'ret']} />
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
