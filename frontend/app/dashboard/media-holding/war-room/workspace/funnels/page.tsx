import { createClient } from '@/lib/supabase/server'
import { Filter, AlertTriangle, Target, Rocket, ChevronRight } from 'lucide-react'
import { humanizeAction } from '@/lib/war-room/recommendations'

export const dynamic = 'force-dynamic'

const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const num = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)

type Step = {
  key: string; label: string
  volume: number | null      // null = geen bron-tabel → "Geen data"
  revenue: number | null
  sourced: boolean           // is er een echte bron?
}

export default async function FunnelCommandCenterPage() {
  const supabase = await createClient()
  const [creatives, clicks, convs, recRes] = await Promise.all([
    supabase.from('media_holding_content_items').select('id', { count: 'exact', head: true }),
    supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }),
    supabase.from('affiliate_conversions').select('commission_eur, status'),
    supabase.from('executive_recommendations').select('action_kind, rationale').neq('status', 'executed').neq('status', 'dismissed').order('priority', { ascending: false }).limit(1),
  ])

  const conversions = convs.data ?? []
  const confirmed = conversions.filter((c) => (c.status ?? '').toLowerCase() === 'confirmed')
  const revenue = confirmed.reduce((s, c) => s + (Number(c.commission_eur) || 0), 0)

  // Creative → Click → Lead → Rapport → Membership → Sale → Revenue
  const steps: Step[] = [
    { key: 'creative', label: 'Creative', volume: creatives.count ?? 0, revenue: null, sourced: true },
    { key: 'click', label: 'Click', volume: clicks.count ?? 0, revenue: null, sourced: true },
    { key: 'lead', label: 'Lead', volume: conversions.length, revenue: null, sourced: true },
    { key: 'rapport', label: 'Rapport', volume: null, revenue: null, sourced: false }, // geen bron in media-domein
    { key: 'membership', label: 'Membership', volume: null, revenue: null, sourced: false },
    { key: 'sale', label: 'Sale', volume: confirmed.length, revenue: null, sourced: true },
    { key: 'revenue', label: 'Revenue', volume: confirmed.length, revenue, sourced: true },
  ]

  const conv = (i: number): number | null => {
    if (i === 0) return null
    const cur = steps[i], prev = steps[i - 1]
    if (cur.volume == null || prev.volume == null || prev.volume === 0) return null
    return Math.round((cur.volume / prev.volume) * 1000) / 10
  }
  const confidence = (s: Step): string => {
    if (!s.sourced) return 'Geen data'
    if (s.volume && s.volume > 0) return 'High'
    return 'Low'
  }

  // grootste lek = laagste conversie tussen gesourcede stappen met prev>0
  let leak: { from: string; to: string; pct: number } | null = null
  for (let i = 1; i < steps.length; i++) {
    const c = conv(i)
    if (c != null && (leak === null || c < leak.pct)) leak = { from: steps[i - 1].label, to: steps[i].label, pct: c }
  }
  // eerste niet-gekoppelde stap = grootste kans (attributie sluiten)
  const firstGap = steps.find((s) => !s.sourced)
  const topRec = (recRes.data ?? [])[0]

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">Funnel Command Center — Creative → Click → Lead → Rapport → Membership → Sale → Revenue. Niet-gekoppelde stappen tonen &quot;Geen data&quot; (geen schatting).</p>

      {/* funnel */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {steps.map((s, i) => {
          const c = conv(i)
          const conf = confidence(s)
          const confColor = conf === 'High' ? '#22c55e' : conf === 'Low' ? '#f59e0b' : '#64748b'
          return (
            <div key={s.key} className="relative rounded-lg border border-white/8 bg-[#0e1525] p-3">
              {i > 0 && <ChevronRight size={12} className="absolute -left-2.5 top-1/2 hidden -translate-y-1/2 text-white/20 xl:block" />}
              <div className="text-[10px] uppercase tracking-wide text-white/40">{s.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums" style={{ color: s.volume != null && s.volume > 0 ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                {s.volume == null ? 'Geen data' : (s.key === 'revenue' ? eur(s.revenue ?? 0) : num(s.volume))}
              </div>
              <div className="mt-1.5 space-y-0.5 text-[9px]">
                <div className="text-white/40">conv: <span className="text-white/60">{c != null ? `${c}%` : '—'}</span></div>
                <div style={{ color: confColor }}>confidence: {conf}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Hermes funnel-inzichten */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-red-400/20 bg-red-500/[0.05] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-red-300"><AlertTriangle size={13} /> Grootste lek</div>
          <div className="mt-1.5 text-xs text-white/70">
            {leak ? <>{leak.from} → {leak.to}: <span className="font-semibold text-red-300">{leak.pct}%</span> conversie</> : <span className="italic text-white/30">Geen data beschikbaar</span>}
          </div>
        </div>
        <div className="rounded-lg border border-violet-400/20 bg-violet-500/[0.05] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300"><Target size={13} /> Grootste kans</div>
          <div className="mt-1.5 text-xs text-white/70">
            {firstGap ? <>Koppel <span className="font-semibold text-violet-200">{firstGap.label}</span>-attributie om de funnel te sluiten.</> : <span className="italic text-white/30">Funnel volledig gekoppeld</span>}
          </div>
        </div>
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.05] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-300"><Rocket size={13} /> Hoogste ROI-actie</div>
          <div className="mt-1.5 text-xs text-white/70">
            {topRec ? <><span className="font-semibold text-emerald-200">{humanizeAction(topRec.action_kind)}</span>{topRec.rationale && <span className="mt-0.5 block text-[10px] text-white/45 line-clamp-2">{topRec.rationale}</span>}</> : <span className="italic text-white/30">Geen aanbeveling</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-white/30"><Filter size={11} /> Bron: attribution engine (affiliate_*) + Hermes (executive_recommendations). Rapport/Membership nog niet gekoppeld.</div>
    </div>
  )
}
