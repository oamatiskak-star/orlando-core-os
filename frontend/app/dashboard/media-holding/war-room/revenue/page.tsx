import { createClient } from '@/lib/supabase/server'
import { Banknote, MousePointerClick, Users, CreditCard, ShieldCheck } from 'lucide-react'
import RevenueFunnel, { type FunnelStage } from '@/components/war-room/RevenueFunnel'

export const dynamic = 'force-dynamic'

const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const num = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)

export default async function RevenuePage() {
  const supabase = await createClient()
  const [clicks, convs, creatives, uploads, views] = await Promise.all([
    supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }),
    supabase.from('affiliate_conversions').select('commission_eur, status'),
    supabase.from('media_holding_content_items').select('id', { count: 'exact', head: true }),
    supabase.from('media_holding_uploads').select('id', { count: 'exact', head: true }),
    supabase.from('media_holding_metrics').select('views'),
  ])

  const clickCount = clicks.count ?? 0
  const conversions = convs.data ?? []
  const confirmed = conversions.filter((c) => (c.status ?? '').toLowerCase() === 'confirmed')
  const revenue = confirmed.reduce((s, c) => s + (Number(c.commission_eur) || 0), 0)
  const totalViews = (views.data ?? []).reduce((s, v) => s + (Number(v.views) || 0), 0)
  const traffic = clickCount > 0 ? clickCount : totalViews

  // Orlando-flow: Creative → Platform → Traffic → Lead → Membership → Sale → Revenue.
  // Membership = geen bron-tabel (geen mock) → "Geen data".
  const stages: FunnelStage[] = [
    { key: 'creative', label: 'Creative', value: num(creatives.count ?? 0), raw: creatives.count ?? 0 },
    { key: 'platform', label: 'Platform', value: num(uploads.count ?? 0), raw: uploads.count ?? 0 },
    { key: 'traffic', label: 'Traffic', value: num(traffic), raw: traffic },
    { key: 'lead', label: 'Lead', value: num(conversions.length), raw: conversions.length },
    { key: 'membership', label: 'Membership', value: 'Geen data', raw: 0 },
    { key: 'sale', label: 'Sale', value: num(confirmed.length), raw: confirmed.length },
    { key: 'revenue', label: 'Revenue', value: eur(revenue), raw: confirmed.length },
  ]

  // Revenue confidence (verplicht): hoeveel van de funnel echt gekoppeld is.
  let conf = 0
  if (traffic > 0) conf += 0.34
  if (conversions.length > 0) conf += 0.33
  if (revenue > 0) conf += 0.33
  const confidencePct = Math.round(conf * 100)
  const confColor = confidencePct >= 66 ? '#22c55e' : confidencePct >= 33 ? '#f59e0b' : '#ef4444'
  const confLabel = confidencePct >= 66 ? 'High' : confidencePct >= 33 ? 'Medium' : 'Low'
  const hasCommercial = clickCount + conversions.length > 0

  // per-stap Volume / Conversion / Revenue (conversion = volume t.o.v. vorige stap)
  const breakdown = stages.map((s, i) => {
    const prev = i > 0 ? stages[i - 1] : null
    const conv = prev && prev.raw > 0 && s.key !== 'membership' ? Math.round((s.raw / prev.raw) * 1000) / 10 : null
    return {
      label: s.label,
      volume: s.key === 'membership' ? 'Geen data' : (s.key === 'revenue' ? eur(revenue) : num(s.raw)),
      conversion: s.key === 'membership' ? 'Geen data' : (conv != null ? `${conv}%` : '—'),
      revenue: s.key === 'revenue' ? eur(revenue) : (s.key === 'sale' ? eur(revenue) : '—'),
      active: s.raw > 0,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/45">
          Revenue-flow: Creative → Platform → Traffic → Lead → Membership → Sale → Revenue. Groene schakels dragen echte data.
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold"
          style={{ color: confColor, borderColor: `${confColor}55`, background: `${confColor}14` }}
          title="Revenue attributie-confidence: aandeel van de funnel dat echt gekoppeld is (geen schatting)">
          <ShieldCheck size={13} />
          Attributie-confidence {confLabel} · {confidencePct}%
        </span>
      </div>

      <RevenueFunnel stages={stages} />

      {/* per-stap Volume / Conversion / Revenue */}
      <div className="overflow-hidden rounded-lg border border-white/8">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-white/[0.03] text-[9px] uppercase tracking-wide text-white/40">
            <tr>
              <th className="px-3 py-2 font-medium">Stap</th>
              <th className="px-3 py-2 font-medium">Volume</th>
              <th className="px-3 py-2 font-medium">Conversion</th>
              <th className="px-3 py-2 font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map((b) => (
              <tr key={b.label} className="border-t border-white/5">
                <td className="px-3 py-1.5 text-white/70">{b.label}</td>
                <td className="px-3 py-1.5 tabular-nums" style={{ color: b.active ? '#fff' : 'rgba(255,255,255,0.35)' }}>{b.volume}</td>
                <td className="px-3 py-1.5 tabular-nums text-white/55">{b.conversion}</td>
                <td className="px-3 py-1.5 tabular-nums text-emerald-400/80">{b.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI icon={MousePointerClick} label="Kliks" value={String(clickCount)} />
        <KPI icon={Users} label="Conversies" value={String(conversions.length)} />
        <KPI icon={CreditCard} label="Confirmed sales" value={String(confirmed.length)} />
        <KPI icon={Banknote} label="Commissie (confirmed)" value={eur(revenue)} accent="#22c55e" />
      </div>

      {!hasCommercial && (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Banknote size={16} className="text-emerald-400" />
            Linkerhelft draait, commerciële helft wacht op data — confidence {confidencePct}%
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/50">
            Creative → Platform → Traffic dragen echte aantallen. Lead → Sale → Revenue staan op 0 omdat
            <code className="text-white/70"> affiliate_*</code> nog geen kliks/conversies heeft, en <span className="text-white/70">Membership</span> heeft
            geen bron-tabel (daarom &quot;Geen data&quot;, geen schatting). Zodra distributielinks UTM dragen en betalingen binnenkomen
            kleuren die schakels groen en stijgt de confidence automatisch — geen verdere wiring nodig.
          </p>
        </div>
      )}
    </div>
  )
}

function KPI({ icon: Icon, label, value, accent }: { icon: typeof Banknote; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/40">
        <Icon size={12} />
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold" style={{ color: accent ?? '#fff' }}>{value}</div>
    </div>
  )
}
