import { createClient } from '@/lib/supabase/server'
import { GitBranch, AlertTriangle, ArrowRight } from 'lucide-react'

export const revalidate = 0
export const dynamic = 'force-dynamic'

type Gap = {
  plan_open: number; plan_done: number; plan_failed: number
  cf2_total: number; cf2_planned: number; cf2_cancelled: number; cf2_advanced: number
  vp_total: number; vp_ready: number; vp_rework: number; vp_live: number; vp_approved: number
  bridge_backlog: number; plan_to_cf2_ratio: number; cf2_to_vp_ratio: number; vp_to_live_ratio: number
}
type Daily = { day: string; planned: number; cf2_created: number; vp_created: number }
type ByCh = { channel_id: string; channel_name: string; cf2_jobs: number; video_projects: number; vp_rework: number; vp_live: number }

const n = (v: number | null | undefined) => (v ?? 0).toLocaleString('nl-NL')
const pct = (v: number | null | undefined) => `${Math.round((v ?? 0) * 100)}%`

export default async function ProducerGapPage() {
  const supabase = await createClient()
  const [{ data: gapData }, { data: daily }, { data: byCh }] = await Promise.all([
    supabase.from('v_producer_gap').select('*').maybeSingle(),
    supabase.from('v_producer_gap_daily').select('*'),
    supabase.from('v_producer_gap_by_channel').select('*'),
  ])
  const g = (gapData ?? null) as Gap | null
  const days = (daily ?? []) as Daily[]
  const chs = (byCh ?? []) as ByCh[]
  const maxDay = Math.max(1, ...days.map((d) => Math.max(d.planned, d.cf2_created, d.vp_created)))

  // trechter-stages met conversie naar de volgende
  const stages = g ? [
    { label: 'Gepland', sub: 'content_factory open', value: g.plan_open, ratio: null as number | null, c: '#a855f7' },
    { label: 'CF2-jobs', sub: `${n(g.cf2_planned)} vast · ${n(g.cf2_advanced)} verder`, value: g.cf2_total, ratio: g.plan_to_cf2_ratio, c: '#38bdf8' },
    { label: 'Video-projects', sub: `${n(g.vp_rework)} rework`, value: g.vp_total, ratio: g.cf2_to_vp_ratio, c: '#f59e0b' },
    { label: 'Live', sub: 'gepubliceerd', value: g.vp_live, ratio: g.vp_to_live_ratio, c: '#22c55e' },
  ] : []
  const maxStage = Math.max(1, ...stages.map((s) => s.value))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <GitBranch size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Producer Gap</h1>
          <p className="text-xs text-white/45">Plan → produce-trechter: waar lekt de productie weg?</p>
        </div>
      </div>

      {/* brug-backlog waarschuwing */}
      {g && g.bridge_backlog > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-white/80">
            <span className="font-semibold text-amber-300">{n(g.bridge_backlog)} plannen</span> staan open zonder productie.
            De brug content_factory → cf2_jobs converteert maar <span className="font-semibold">{pct(g.plan_to_cf2_ratio)}</span>;
            van cf2 → video <span className="font-semibold">{pct(g.cf2_to_vp_ratio)}</span>; en
            video → live <span className="font-semibold text-red-300">{pct(g.vp_to_live_ratio)}</span>.
            <div className="text-[11px] text-white/40 mt-1">
              Enqueue + state-sync is runtime (cf2-producer, Engine <code>content:cf2-video-projects-runner</code>, CLI-L lane L1). Dit dashboard meet; het draait de producer niet.
            </div>
          </div>
        </div>
      )}

      {/* trechter */}
      {g && (
        <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
          <span className="text-xs font-semibold text-white/80">Productie-trechter</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            {stages.map((s, i) => (
              <div key={s.label} className="relative">
                <div className="rounded-xl border border-white/8 bg-black/20 p-3">
                  <div className="text-[10px] uppercase tracking-wide text-white/40">{s.label}</div>
                  <div className="text-2xl font-bold" style={{ color: s.c }}>{n(s.value)}</div>
                  <div className="text-[10px] text-white/40 truncate" title={s.sub}>{s.sub}</div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, (s.value / maxStage) * 100)}%`, background: s.c }} />
                  </div>
                  {s.ratio != null && (
                    <div className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: s.ratio === 0 ? '#ef4444' : s.ratio < 0.2 ? '#f59e0b' : '#22c55e' }}>
                      <ArrowRight size={10} /> {pct(s.ratio)} conversie
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* dagelijkse doorzet */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-white/80">Dagelijkse doorzet (14d)</span>
          <div className="flex items-center gap-3 text-[10px]">
            <Legend c="#a855f7" l="gepland" /><Legend c="#38bdf8" l="cf2" /><Legend c="#f59e0b" l="video" />
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-28">
          {days.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5 group">
              <div className="w-full flex items-end justify-center gap-px h-24" title={`${d.day}: ${d.planned} gepland · ${d.cf2_created} cf2 · ${d.vp_created} video`}>
                <span className="w-1/3 rounded-t" style={{ height: `${(d.planned / maxDay) * 100}%`, background: '#a855f7', minHeight: d.planned ? 2 : 0 }} />
                <span className="w-1/3 rounded-t" style={{ height: `${(d.cf2_created / maxDay) * 100}%`, background: '#38bdf8', minHeight: d.cf2_created ? 2 : 0 }} />
                <span className="w-1/3 rounded-t" style={{ height: `${(d.vp_created / maxDay) * 100}%`, background: '#f59e0b', minHeight: d.vp_created ? 2 : 0 }} />
              </div>
              <span className="text-[8px] text-white/25">{new Date(d.day).getDate()}</span>
            </div>
          ))}
        </div>
      </div>

      {/* per kanaal */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 text-xs font-semibold text-white">Productie per kanaal</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="text-white/35"><tr className="border-b border-white/5">
              <th className="px-4 py-2 font-medium">Kanaal</th>
              <th className="px-3 py-2 font-medium text-right">CF2-jobs</th>
              <th className="px-3 py-2 font-medium text-right">Video-projects</th>
              <th className="px-3 py-2 font-medium text-right">Rework</th>
              <th className="px-3 py-2 font-medium text-right">Live</th>
            </tr></thead>
            <tbody>
              {chs.filter((c) => c.cf2_jobs > 0 || c.video_projects > 0).map((c) => (
                <tr key={c.channel_id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2 font-medium text-white/80">{c.channel_name}</td>
                  <td className="px-3 py-2 text-right text-white/60">{n(c.cf2_jobs)}</td>
                  <td className="px-3 py-2 text-right text-white/60">{n(c.video_projects)}</td>
                  <td className="px-3 py-2 text-right" style={{ color: c.vp_rework > 0 ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>{n(c.vp_rework)}</td>
                  <td className="px-3 py-2 text-right" style={{ color: c.vp_live > 0 ? '#22c55e' : 'rgba(255,255,255,0.3)' }}>{n(c.vp_live)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-white/30 leading-relaxed">
        Bron: <code className="text-white/40">orchestrator_tasks</code> (executor=content_factory), <code className="text-white/40">cf2_jobs</code>, <code className="text-white/40">video_projects</code>.
        CLI-R levert zichtbaarheid + read-only brug-kandidaten (<code className="text-white/40">producer_bridge_candidates()</code>). De enqueue/state-sync draait runtime (cf2-producer, CLI-L L1) — dit dashboard schrijft niets.
      </p>
    </div>
  )
}

function Legend({ c, l }: { c: string; l: string }) {
  return <span className="flex items-center gap-1 text-white/45"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{l}</span>
}
