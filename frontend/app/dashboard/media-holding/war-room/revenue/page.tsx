import { createClient } from '@/lib/supabase/server'
import { Banknote, MousePointerClick, Users, CreditCard } from 'lucide-react'
import RevenueFunnel, { type FunnelStage } from '@/components/war-room/RevenueFunnel'

export const dynamic = 'force-dynamic'

const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const num = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)

export default async function RevenuePage() {
  const supabase = await createClient()
  const [links, clicks, convs, creatives, uploads, hooks] = await Promise.all([
    supabase.from('affiliate_links').select('id', { count: 'exact', head: true }),
    supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }),
    supabase.from('affiliate_conversions').select('commission_eur, status'),
    supabase.from('media_holding_content_items').select('id', { count: 'exact', head: true }),
    supabase.from('media_holding_uploads').select('id', { count: 'exact', head: true }),
    supabase.from('v_war_room_nodes').select('node_id', { count: 'exact', head: true }).eq('node_type', 'hook'),
  ])

  const linkCount = links.count ?? 0
  const clickCount = clicks.count ?? 0
  const conversions = convs.data ?? []
  const confirmed = conversions.filter((c) => (c.status ?? '').toLowerCase() === 'confirmed')
  const revenue = confirmed.reduce((s, c) => s + (Number(c.commission_eur) || 0), 0)
  const hasData = linkCount + clickCount + conversions.length > 0

  const stages: FunnelStage[] = [
    { key: 'hook', label: 'Hook', value: num(hooks.count ?? 0), raw: hooks.count ?? 0 },
    { key: 'creative', label: 'Creative', value: num(creatives.count ?? 0), raw: creatives.count ?? 0 },
    { key: 'platform', label: 'Platform', value: num(uploads.count ?? 0), raw: uploads.count ?? 0 },
    { key: 'klik', label: 'Klik', value: num(clickCount), raw: clickCount },
    { key: 'lead', label: 'Lead', value: num(conversions.length), raw: conversions.length },
    { key: 'betaling', label: 'Betaling', value: eur(revenue), raw: confirmed.length },
  ]

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Revenue-graph: Hook → Creative → Platform → Klik → Lead → Betaling. Volg een hook tot omzet. Groene schakels dragen al data.
      </p>

      <RevenueFunnel stages={stages} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI icon={Banknote} label="Affiliate-links" value={String(linkCount)} />
        <KPI icon={MousePointerClick} label="Kliks" value={String(clickCount)} />
        <KPI icon={Users} label="Conversies" value={String(conversions.length)} />
        <KPI icon={CreditCard} label="Commissie (confirmed)" value={eur(revenue)} accent="#22c55e" />
      </div>

      {!hasData && (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Banknote size={16} className="text-emerald-400" />
            Linkerhelft draait, attributie-helft wacht op data
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/50">
            Hook → Creative → Platform dragen al echte aantallen. De Affiliate Engine heeft nog geen
            links/kliks/conversies (<code className="text-white/70">affiliate_*</code> = 0), dus Klik → Lead → Betaling staan op 0.
            Zodra distributielinks UTM dragen en kliks/betalingen binnenkomen kleuren die schakels groen — geen verdere wiring nodig.
            Per PROJECT_STATUS is UTM-/affiliate-attributie nu nog 0.
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
