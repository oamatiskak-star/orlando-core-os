import { createClient } from '@/lib/supabase/server'
import { Briefcase, TrendingUp, TrendingDown, Minus, Target, AlertTriangle, ShieldAlert } from 'lucide-react'

export const revalidate = 0
export const dynamic = 'force-dynamic'

type Row = {
  channel_id: string; channel_name: string; niche_fit: string | null; best_program: string | null
  rev_30d: number | null; projected_rev_30d: number | null; rev_7d: number | null; rpm_eur: number | null
  views_30d: number | null; growth_velocity: number | null; trend_ratio: number | null; probability_to_60k: number | null
  tier: number | null; scale_score: number | null; above_scale_threshold: boolean | null
  distance_to_60k_eur: number | null; expected_rev_30d_eur: number | null; rank: number | null
  health_status: string | null; monthly_gain_eur: number | null
  months_to_10k: number | null; months_to_60k: number | null
  recommendation: 'verdubbel' | 'houd' | 'stop'; recommendation_reason: string
}
type Summary = {
  channels: number; n_verdubbel: number; n_houd: number; n_stop: number
  total_rev_30d: number; total_projected_rev_30d: number; target_rev_30d: number
  gap_to_60k: number; media_ai_burn_30d_usd: number
}

const eur = (n: number | null | undefined) =>
  '€' + (n ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number | null | undefined) => {
  const v = n ?? 0
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K'
  return String(Math.round(v))
}

const REC: Record<string, { label: string; c: string; bg: string; border: string; Icon: typeof TrendingUp; tag: string }> = {
  verdubbel: { label: 'Verdubbel', c: '#22c55e', bg: 'bg-emerald-500/[0.06]', border: 'border-emerald-500/25', Icon: TrendingUp, tag: 'DOUBLE DOWN' },
  houd: { label: 'Houd', c: '#94a3b8', bg: 'bg-white/[0.03]', border: 'border-white/10', Icon: Minus, tag: 'HOLD' },
  stop: { label: 'Stop', c: '#ef4444', bg: 'bg-red-500/[0.06]', border: 'border-red-500/25', Icon: TrendingDown, tag: 'CUT' },
}
const ORDER = ['verdubbel', 'houd', 'stop'] as const

export default async function ChannelPortfolioPage() {
  const supabase = await createClient()
  const [{ data: rows }, { data: sum }] = await Promise.all([
    supabase.from('v_channel_portfolio').select('*'),
    supabase.from('v_channel_portfolio_summary').select('*').maybeSingle(),
  ])

  const list = (rows ?? []) as Row[]
  const s = (sum ?? null) as Summary | null
  const sorted = [...list].sort((a, b) => {
    const o = ORDER.indexOf(a.recommendation) - ORDER.indexOf(b.recommendation)
    return o !== 0 ? o : (b.scale_score ?? 0) - (a.scale_score ?? 0)
  })
  const progress = s ? Math.min(100, Math.round((s.total_rev_30d / s.target_rev_30d) * 100)) : 0

  return (
    <div className="space-y-6">
      {/* kop */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <Briefcase size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Channel Portfolio</h1>
          <p className="text-xs text-white/45">
            Hedge-fund-stijl kapitaal- &amp; aandacht-allocatie — verdubbel / houd / stop op echte metrics
          </p>
        </div>
      </div>

      {/* kapitaal-allocatie kop */}
      {s && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* omzet 30d vs €60k-doel */}
          <div className="lg:col-span-2 bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/60 flex items-center gap-1.5"><Target size={13} className="text-violet-400" /> Omzet 30d vs €60k/maand-doel</span>
              <span className="text-[11px] text-white/40">{progress}%</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white">{eur(s.total_rev_30d)}</span>
              <span className="text-xs text-white/40">/ {eur(s.target_rev_30d)}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-400" style={{ width: `${Math.max(1, progress)}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/45">
              <span>Gat tot €60k: <span className="text-white/70">{eur(s.gap_to_60k)}</span></span>
              <span>Projectie 30d: <span className="text-white/70">{eur(s.total_projected_rev_30d)}</span></span>
              <span title="ai_usage heeft geen channel_id — burn alleen holding-breed, niet per kanaal toerekenbaar">
                Gelogde AI-burn 30d: <span className="text-white/70">${(s.media_ai_burn_30d_usd ?? 0).toLocaleString('nl-NL')}</span>
              </span>
            </div>
          </div>

          {/* allocatie-verdeling */}
          <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-4">
            <span className="text-xs font-medium text-white/60">Allocatie-advies</span>
            <div className="mt-3 space-y-2">
              {ORDER.map((k) => {
                const cfg = REC[k]
                const n = k === 'verdubbel' ? s.n_verdubbel : k === 'houd' ? s.n_houd : s.n_stop
                const pct = s.channels ? Math.round((n / s.channels) * 100) : 0
                return (
                  <div key={k} className="flex items-center gap-2">
                    <cfg.Icon size={13} style={{ color: cfg.c }} />
                    <span className="text-[11px] text-white/55 w-20">{cfg.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cfg.c }} />
                    </div>
                    <span className="text-[11px] font-semibold text-white/70 w-6 text-right">{n}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* positie-kaarten gegroepeerd per advies */}
      {ORDER.map((k) => {
        const cfg = REC[k]
        const group = sorted.filter((r) => r.recommendation === k)
        if (group.length === 0) return null
        return (
          <div key={k} className="space-y-2">
            <div className="flex items-center gap-2">
              <cfg.Icon size={14} style={{ color: cfg.c }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: cfg.c }}>{cfg.label}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: cfg.c, background: `${cfg.c}1a` }}>{cfg.tag}</span>
              <span className="text-[10px] text-white/30">{group.length} kana{group.length === 1 ? 'al' : 'len'}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.map((r) => (
                <div key={r.channel_id} className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4 space-y-2.5`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{r.channel_name}</div>
                      <div className="text-[10px] text-white/40 truncate">{r.niche_fit ?? '—'}{r.tier ? ` · tier ${r.tier}` : ''}</div>
                    </div>
                    {r.health_status === 'critical' && (
                      <span title="health: critical" className="flex items-center gap-1 text-[9px] font-semibold text-red-400 shrink-0">
                        <ShieldAlert size={11} /> critical
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-white">{eur(r.rev_30d)}</span>
                    <span className="text-[10px] text-white/35">omzet 30d</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                    <Metric label="groei" value={(r.growth_velocity ?? 0).toFixed(2)} good={(r.growth_velocity ?? 0) > 0.3} />
                    <Metric label="trend" value={(r.trend_ratio ?? 0).toFixed(2)} good={(r.trend_ratio ?? 0) >= 1} />
                    <Metric label="scale" value={(r.scale_score ?? 0).toFixed(2)} good={(r.scale_score ?? 0) >= 0.4} />
                    <Metric label="views 30d" value={num(r.views_30d)} />
                    <Metric label="RPM" value={eur(r.rpm_eur)} />
                    <Metric label="→€10k" value={r.months_to_10k != null ? `${r.months_to_10k}m` : '—'} />
                  </div>
                  <p className="text-[10px] text-white/40 leading-snug border-t border-white/5 pt-2">{r.recommendation_reason}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* ranglijst */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Portefeuille-ranglijst</span>
          <span className="text-[10px] text-white/35">gesorteerd op advies → scale-score</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="text-white/35">
              <tr className="border-b border-white/5">
                <th className="px-4 py-2 font-medium">Kanaal</th>
                <th className="px-3 py-2 font-medium">Niche</th>
                <th className="px-3 py-2 font-medium text-right">Omzet 30d</th>
                <th className="px-3 py-2 font-medium text-right">Omzet 7d</th>
                <th className="px-3 py-2 font-medium text-right">Groei</th>
                <th className="px-3 py-2 font-medium text-right">Trend</th>
                <th className="px-3 py-2 font-medium text-right">Scale</th>
                <th className="px-3 py-2 font-medium text-right">→€10k</th>
                <th className="px-3 py-2 font-medium">Health</th>
                <th className="px-3 py-2 font-medium">Advies</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const cfg = REC[r.recommendation]
                return (
                  <tr key={r.channel_id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-2 font-medium text-white/80">{r.channel_name}</td>
                    <td className="px-3 py-2 text-white/45">{r.niche_fit ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-white/70">{eur(r.rev_30d)}</td>
                    <td className="px-3 py-2 text-right text-white/45">{eur(r.rev_7d)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: (r.growth_velocity ?? 0) > 0.3 ? '#22c55e' : '#94a3b8' }}>{(r.growth_velocity ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: (r.trend_ratio ?? 0) >= 1 ? '#22c55e' : '#94a3b8' }}>{(r.trend_ratio ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: (r.scale_score ?? 0) >= 0.4 ? '#22c55e' : '#94a3b8' }}>{(r.scale_score ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-white/55">{r.months_to_10k != null ? `${r.months_to_10k}m` : '—'}</td>
                    <td className="px-3 py-2">
                      {r.health_status === 'critical'
                        ? <span className="inline-flex items-center gap-1 text-[10px] text-red-400"><AlertTriangle size={10} /> critical</span>
                        : <span className="text-white/30 text-[10px]">{r.health_status ?? '—'}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: cfg.c, background: `${cfg.c}1a` }}>
                        <cfg.Icon size={10} /> {cfg.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] text-white/30 leading-relaxed">
        Bron: bestaande <code className="text-white/40">v_channel_60k_projection</code>, <code className="text-white/40">v_channel_scale_priority</code>,{' '}
        <code className="text-white/40">v_channel_ranking</code>, <code className="text-white/40">v_channel_revenue</code> + laatste <code className="text-white/40">youtube_channel_health</code>.
        Advies is deterministisch over echte metrics. Geen per-kanaal kosten beschikbaar (ai_usage zonder channel_id) → géén verzonnen cash-runway;
        &quot;→€10k&quot; is velocity-ETA bij de huidige trend.
      </p>
    </div>
  )
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="rounded-lg bg-black/20 px-1.5 py-1">
      <div className="text-white/30 text-[9px]">{label}</div>
      <div className="font-semibold" style={{ color: good ? '#22c55e' : 'rgba(255,255,255,0.7)' }}>{value}</div>
    </div>
  )
}
