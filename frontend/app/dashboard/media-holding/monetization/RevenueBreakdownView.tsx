'use client'

import { useEffect, useState } from 'react'
import { Layers3, Video, Trophy, Wallet, RefreshCw } from 'lucide-react'

type Niche = { niche: string; views: number; clicks: number; leads: number; rapport: number; memberships: number; sales: number; revenue: number; confidence: number }
type Vid = { content_item_id: string; title: string; channel_name: string; clicks: number; leads: number; sales: number; revenue: number }
type TopVid = { video_id: string; channel_name: string; title: string; revenue_30d: number; views_30d: number; avg_ctr: number; avg_rpm: number }
type Winner = { id: string; title: string; channel: string; niche: string; winner_status: string; revenue: number; rpm_equiv: number; revenue_per_1k: number; economic_winner_score: number; positive_economic: boolean; views: number; ctr: number }
type MediaRev = { affiliate_confirmed_eur: number; affiliate_pending_eur: number; youtube_est_30d_eur: number; niche_attributed_eur: number; confirmed_conversions: number; positive_economic_winners: number; media_total_30d_eur: number }
type Data = { niche: Niche[]; video: Vid[]; topVideos: TopVid[]; winners: Winner[]; mediaRevenue: MediaRev | null }

const eur = (n: number | null | undefined) => '€' + (n ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num = (n: number | null | undefined) => { const v = n ?? 0; return v >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(Math.round(v)) }

export default function RevenueBreakdownView() {
  const [d, setD] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/media-holding/monetization/breakdown').then((r) => r.json()).then(setD).finally(() => setLoading(false))
  }
  useEffect(load, [])

  if (loading && !d) return <div className="text-xs text-white/40 py-8 text-center">laden…</div>
  const m = d?.mediaRevenue
  const noEuros = m && m.media_total_30d_eur === 0

  return (
    <div className="space-y-5">
      {/* CEO-OS media-omzet rollup */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Wallet} label="Media-omzet 30d" value={eur(m?.media_total_30d_eur)} accent="#22c55e" />
        <Kpi icon={Wallet} label="Affiliate bevestigd" value={eur(m?.affiliate_confirmed_eur)} sub={`${m?.confirmed_conversions ?? 0} conversies`} />
        <Kpi icon={Wallet} label="Affiliate pending" value={eur(m?.affiliate_pending_eur)} />
        <Kpi icon={Trophy} label="Positief-econ. winners" value={String(m?.positive_economic_winners ?? 0)} sub="proxy-economie" />
      </div>

      {noEuros && (
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.05] px-3 py-2 text-[11px] text-white/60 flex items-center justify-between">
          <span>Nog €0 echte euro-omzet: de conversie-tracking-pijplijn draait nog niet (CLI-L lane L2). Views/winners-proxy is wel zichtbaar.</span>
          <button onClick={load} className="flex items-center gap-1 text-sky-300 hover:text-sky-200"><RefreshCw size={11} /> ververs</button>
        </div>
      )}

      {/* per niche */}
      <Section icon={Layers3} title="Omzet per niche" accent="#a855f7">
        <Table head={['Niche', 'Views', 'Clicks', 'Leads', 'Sales', 'Omzet', 'Confidence']}
          rows={(d?.niche ?? []).map((n) => [n.niche, num(n.views), num(n.clicks), String(n.leads), String(n.sales), eur(n.revenue), `${Math.round((n.confidence ?? 0) * 100)}%`])} />
      </Section>

      {/* per video (attributie) */}
      <Section icon={Video} title="Omzet per video (attributie)" accent="#38bdf8">
        {(d?.video ?? []).length === 0
          ? <Empty text="Geen video-attributie — vult zodra conversie-tracking live is (L2)." />
          : <Table head={['Titel', 'Kanaal', 'Clicks', 'Leads', 'Sales', 'Omzet']}
              rows={(d?.video ?? []).map((v) => [v.title, v.channel_name, num(v.clicks), String(v.leads), String(v.sales), eur(v.revenue)])} />}
      </Section>

      {/* top videos (omzet 30d) */}
      <Section icon={Video} title="Top-video's (omzet 30d)" accent="#f59e0b">
        <Table head={['Titel', 'Kanaal', 'Omzet 30d', 'Views 30d', 'CTR', 'RPM']}
          rows={(d?.topVideos ?? []).slice(0, 25).map((v) => [v.title, v.channel_name, eur(v.revenue_30d), num(v.views_30d), `${((v.avg_ctr ?? 0)).toFixed(1)}%`, eur(v.avg_rpm)])} />
      </Section>

      {/* winner economics (proxy) */}
      <Section icon={Trophy} title="Winner-economie (proxy)" accent="#22c55e">
        <Table head={['Titel', 'Niche', 'Status', 'RPM-equiv', '€/1k', 'Score', 'Pos?']}
          rows={(d?.winners ?? []).slice(0, 25).map((w) => [w.title, w.niche, w.winner_status, eur(w.rpm_equiv), eur(w.revenue_per_1k), (w.economic_winner_score ?? 0).toFixed(2), w.positive_economic ? '✓' : '—'])} />
      </Section>

      <p className="text-[10px] text-white/30 leading-relaxed">
        Bron: <code className="text-white/40">v_attribution_niche</code>, <code className="text-white/40">v_attribution_video</code>, <code className="text-white/40">v_top_videos_revenue</code>, <code className="text-white/40">v_winner_economics</code> + CEO-OS <code className="text-white/40">v_ceo_media_revenue</code>.
        Echte euro-omzet vereist de conversie-pijplijn (CLI-L L2); winner-economie is een RPM-/EPC-proxy.
      </p>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, sub, accent }: { icon: typeof Wallet; label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-white/45"><Icon size={11} /> {label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color: accent ?? '#fff' }}>{value}</div>
      {sub && <div className="text-[10px] text-white/35">{sub}</div>}
    </div>
  )
}
function Section({ icon: Icon, title, accent, children }: { icon: typeof Wallet; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2"><Icon size={13} style={{ color: accent }} /><span className="text-xs font-semibold text-white/80">{title}</span></div>
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden">{children}</div>
    </div>
  )
}
function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <Empty text="Geen data." />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs whitespace-nowrap">
        <thead className="text-white/35"><tr className="border-b border-white/5">{head.map((h, i) => <th key={i} className={`px-3 py-2 font-medium ${i >= 2 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
              {r.map((c, ci) => <td key={ci} className={`px-3 py-1.5 ${ci >= 2 ? 'text-right text-white/55' : ci === 0 ? 'text-white/75 max-w-[280px] truncate' : 'text-white/45'}`} title={ci === 0 ? String(c) : undefined}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function Empty({ text }: { text: string }) { return <div className="px-4 py-5 text-[11px] text-white/35 text-center">{text}</div> }
