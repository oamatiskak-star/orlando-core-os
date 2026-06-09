import { createClient } from '@/lib/supabase/server'
import { Banknote, MousePointerClick, Users, CreditCard } from 'lucide-react'

export const dynamic = 'force-dynamic'

const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

export default async function RevenuePage() {
  const supabase = await createClient()
  const [links, clicks, convs] = await Promise.all([
    supabase.from('affiliate_links').select('id', { count: 'exact', head: true }),
    supabase.from('affiliate_clicks').select('id', { count: 'exact', head: true }),
    supabase.from('affiliate_conversions').select('value_eur, commission_eur, status'),
  ])

  const linkCount = links.count ?? 0
  const clickCount = clicks.count ?? 0
  const conversions = convs.data ?? []
  const revenue = conversions.reduce((s, c) => s + (Number(c.commission_eur) || 0), 0)
  const hasData = linkCount + clickCount + conversions.length > 0

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">
        Revenue-graph: Hook → Creative → Platform → Klik → Lead → Betaling. Volg een hook tot omzet.
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Funnel icon={Banknote} label="Affiliate-links" value={String(linkCount)} />
        <Funnel icon={MousePointerClick} label="Kliks" value={String(clickCount)} />
        <Funnel icon={Users} label="Conversies" value={String(conversions.length)} />
        <Funnel icon={CreditCard} label="Commissie" value={eur(revenue)} accent="#22c55e" />
      </div>

      {!hasData && (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Banknote size={16} className="text-emerald-400" />
            Nog geen attributie-data
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/50">
            De Affiliate Engine heeft nog geen links/kliks/conversies (<code className="text-white/70">affiliate_*</code> = 0).
            Zodra distributielinks UTM dragen en kliks/betalingen binnenkomen, wordt de volledige keten
            <span className="text-white/70"> hook → creative → platform → klik → lead → betaling</span> zichtbaar in dezelfde
            graph-architectuur (revenue-edges staan al klaar). Per PROJECT_STATUS is UTM-/affiliate-attributie nu nog 0.
          </p>
        </div>
      )}
    </div>
  )
}

function Funnel({ icon: Icon, label, value, accent }: { icon: typeof Banknote; label: string; value: string; accent?: string }) {
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
