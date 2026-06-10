import { createClient } from '@/lib/supabase/server'
import { TrendingUp, Trophy, ArrowUpCircle, StopCircle, FlaskConical } from 'lucide-react'
import { Sparkline } from '@/components/executive/Sparkline'
import { computeScores, WINNER_LABEL, WINNER_COLOR, type NodeScore } from '@/lib/war-room/scoring'
import { recCategory, humanizeAction } from '@/lib/war-room/recommendations'
import type { WarRoomRawNode, WarRoomNodeType } from '@/lib/war-room/graph'

export const dynamic = 'force-dynamic'

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)

export default async function PerformanceCenterPage() {
  const supabase = await createClient()
  const [nodesRes, metricsRes, recsRes] = await Promise.all([
    supabase.from('v_war_room_nodes').select('*'),
    supabase.from('media_holding_metrics').select('snapshot_at, ctr_pct, revenue, retention_pct').order('snapshot_at', { ascending: true }),
    supabase.from('executive_recommendations').select('action_kind, rationale, priority, status').neq('status', 'executed').neq('status', 'dismissed').order('priority', { ascending: false }).limit(300),
  ])

  const rawNodes = (nodesRes.data ?? []) as WarRoomRawNode[]
  const scores = computeScores(rawNodes)

  // trends per dag (CTR avg, revenue sum, retention avg)
  const byDay = new Map<string, { ctr: number[]; rev: number; ret: number[] }>()
  for (const m of metricsRes.data ?? []) {
    if (!m.snapshot_at) continue
    const day = String(m.snapshot_at).slice(0, 10)
    const e = byDay.get(day) ?? { ctr: [], rev: 0, ret: [] }
    if (m.ctr_pct != null) e.ctr.push(Number(m.ctr_pct))
    if (m.retention_pct != null) e.ret.push(Number(m.retention_pct))
    e.rev += Number(m.revenue) || 0
    byDay.set(day, e)
  }
  const days = [...byDay.keys()].sort()
  const ctrSeries = days.map((d) => { const a = byDay.get(d)!.ctr; return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0 })
  const revSeries = days.map((d) => byDay.get(d)!.rev)
  const retSeries = days.map((d) => { const a = byDay.get(d)!.ret; return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0 })

  const rank = (type: WarRoomNodeType) => rawNodes
    .filter((n) => n.node_type === type)
    .map((n) => ({ label: n.label ?? '—', s: scores.get(n.node_id) }))
    .filter((r) => r.s && r.s.winner_score !== null)
    .sort((a, b) => (b.s!.winner_score ?? 0) - (a.s!.winner_score ?? 0))
    .slice(0, 5)

  const cat = (k: string) => recCategory(k)
  const recsScale = (recsRes.data ?? []).filter((r) => ['scale', 'expand'].includes(cat(r.action_kind))).slice(0, 4)
  const recsStop = (recsRes.data ?? []).filter((r) => cat(r.action_kind) === 'pause').slice(0, 4)
  const recsTest = (recsRes.data ?? []).filter((r) => ['test', 'replace'].includes(cat(r.action_kind))).slice(0, 4)

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">Performance Center — agency-overzicht: trends, rankings (Winner Engine) en Hermes-inzichten. Slechts {days.length} meetdag(en) → trends tonen &quot;Geen data&quot; bij te weinig punten.</p>

      {/* trends */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Trend label="CTR-trend" series={ctrSeries} days={days.length} color="#34d399" suffix="%" />
        <Trend label="Revenue-trend" series={revSeries} days={days.length} color="#22c55e" prefix="€" />
        <Trend label="Retention-trend" series={retSeries} days={days.length} color="#38bdf8" suffix="%" />
      </div>

      {/* rankings */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Ranking title="Creative ranking" rows={rank('creative')} />
        <Ranking title="Hook ranking" rows={rank('hook')} />
        <Ranking title="Kanaal ranking" rows={rank('channel')} />
        <Ranking title="Campagne ranking" rows={rank('campaign')} />
      </div>

      {/* Hermes inzichten */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Insight icon={ArrowUpCircle} title="Wat opschalen" color="#22c55e" recs={recsScale} />
        <Insight icon={StopCircle} title="Wat stoppen" color="#ef4444" recs={recsStop} />
        <Insight icon={FlaskConical} title="Wat testen" color="#f59e0b" recs={recsTest} />
      </div>
    </div>
  )
}

function Trend({ label, series, days, color, prefix = '', suffix = '' }: { label: string; series: number[]; days: number; color: string; prefix?: string; suffix?: string }) {
  const last = series.length ? series[series.length - 1] : null
  return (
    <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40"><TrendingUp size={11} /> {label}</div>
      {days < 2 ? (
        <div className="mt-2 text-[11px] italic text-white/30">Geen data beschikbaar (te weinig meetdagen)</div>
      ) : (
        <>
          <div className="mt-1 text-lg font-semibold tabular-nums" style={{ color }}>{prefix}{last != null ? Math.round(last * 10) / 10 : '—'}{suffix}</div>
          <Sparkline values={series} width={240} height={32} stroke={color} className="mt-1 w-full" />
        </>
      )}
    </div>
  )
}

function Ranking({ title, rows }: { title: string; rows: { label: string; s: NodeScore | undefined }[] }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50"><Trophy size={12} className="text-amber-400" /> {title}</div>
      {rows.length === 0 ? (
        <div className="text-[11px] italic text-white/30">Geen data beschikbaar</div>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((r, i) => {
            const wc = r.s ? WINNER_COLOR[r.s.winner_status] : '#475569'
            return (
              <li key={i} className="flex items-center gap-2">
                <span className="w-4 text-[10px] text-white/30">{i + 1}</span>
                <span className="flex-1 truncate text-[11px] text-white/75 capitalize">{r.label}</span>
                <span className="text-[10px] tabular-nums text-white/40">{r.s?.views != null ? compact(r.s.views) : '—'}</span>
                <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase" style={{ color: wc, background: `${wc}1a` }}>{r.s ? WINNER_LABEL[r.s.winner_status] : '—'}</span>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

function Insight({ icon: Icon, title, color, recs }: { icon: typeof StopCircle; title: string; color: string; recs: { action_kind: string; rationale: string | null }[] }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color }}><Icon size={13} /> {title}</div>
      {recs.length === 0 ? (
        <div className="text-[11px] italic text-white/30">Geen aanbevelingen</div>
      ) : (
        <ul className="space-y-1.5">
          {recs.map((r, i) => (
            <li key={i} className="text-[10px] text-white/55" title={r.rationale ?? undefined}>
              <span className="font-medium text-white/75">{humanizeAction(r.action_kind)}</span>
              {r.rationale && <span className="block truncate text-white/40">{r.rationale}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
