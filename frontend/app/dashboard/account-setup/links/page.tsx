import { Link as LinkIcon, MousePointerClick, BadgeDollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import type { AffiliateProgramRow, AffiliatePerformanceRow } from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type RegistryLink = Pick<AffiliateProgramRow, 'id' | 'name' | 'affiliate_link' | 'referral_code' | 'category'>

function fmtEur(n: number): string {
  return Number(n).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
}

export default async function LinksPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()
  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  // Registry-zijde: programma's met een eigen affiliate-link / referral-code
  let regQuery = supabase
    .from('affiliate_programs')
    .select('id, name, affiliate_link, referral_code, category')
  regQuery = companyId ? regQuery.or(`company_id.eq.${companyId},company_id.is.null`) : regQuery.is('company_id', null)
  const { data: regData } = await regQuery.order('name')
  const registry: RegistryLink[] = ((regData ?? []) as RegistryLink[]).filter(r => r.affiliate_link || r.referral_code)

  // 066-zijde: link-level performance (media-holding affiliate-engine).
  // Kan leeg zijn als er nog geen links/tracking is — geen harde afhankelijkheid.
  const { data: perfData } = await supabase
    .from('affiliate_performance')
    .select('link_id, product, network, niche, commission_pct, click_count, conversion_count, confirmed_count, confirmed_commission_eur, pending_commission_eur, conversion_rate_pct, epc_eur')
    .order('confirmed_commission_eur', { ascending: false })
    .limit(100)
  const perf: AffiliatePerformanceRow[] = (perfData ?? []) as AffiliatePerformanceRow[]

  const totalClicks = perf.reduce((a, p) => a + Number(p.click_count ?? 0), 0)
  const totalConfirmed = perf.reduce((a, p) => a + Number(p.confirmed_count ?? 0), 0)
  const totalCommission = perf.reduce((a, p) => a + Number(p.confirmed_commission_eur ?? 0), 0)

  const kpis: Kpi[] = [
    { label: 'Registry-links', value: registry.length, accent: 'white', icon: <LinkIcon size={13} /> },
    { label: 'Clicks (066)', value: totalClicks, accent: totalClicks > 0 ? 'indigo' : 'white', icon: <MousePointerClick size={13} /> },
    { label: 'Conversies', value: totalConfirmed, accent: totalConfirmed > 0 ? 'emerald' : 'white' },
    { label: 'Commissie (confirmed)', value: fmtEur(totalCommission), accent: totalCommission > 0 ? 'emerald' : 'white', icon: <BadgeDollarSign size={13} /> },
  ]

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      {/* Registry links */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-1">Programma-links (registry)</h2>
        <p className="text-[10px] text-white/40 mb-3">Eigen affiliate-link / referral-code per programma. Beheer via KYC-tab.</p>
        {registry.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-white/40">Nog geen affiliate-links ingevuld. Voeg ze toe via de KYC-tab.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Programma</th>
                <th className="pb-2 font-medium">Affiliate link</th>
                <th className="pb-2 font-medium">Referral code</th>
              </tr>
            </thead>
            <tbody>
              {registry.map(r => (
                <tr key={r.id} className="border-t border-white/[0.04]">
                  <td className="py-2 text-[12px] text-white/90">{r.name}</td>
                  <td className="py-2 text-[10.5px] text-emerald-300/80 font-mono truncate max-w-[320px]">
                    {r.affiliate_link
                      ? <a href={r.affiliate_link} target="_blank" rel="noopener noreferrer" className="hover:underline">{r.affiliate_link}</a>
                      : <span className="text-white/30">—</span>}
                  </td>
                  <td className="py-2 text-[10.5px] text-white/70 font-mono">{r.referral_code ?? <span className="text-white/30">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 066 affiliate_performance */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-1">Link performance (media-holding engine · 066)</h2>
        <p className="text-[10px] text-white/40 mb-3">Live click/conversie-tracking uit de bestaande affiliate-engine. Read-only koppeling.</p>
        {perf.length === 0 ? (
          <p className="py-6 text-center text-[11px] text-white/40">Geen link-performance data beschikbaar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Netwerk</th>
                  <th className="pb-2 font-medium text-right">Clicks</th>
                  <th className="pb-2 font-medium text-right">Conv.</th>
                  <th className="pb-2 font-medium text-right">CVR%</th>
                  <th className="pb-2 font-medium text-right">EPC</th>
                  <th className="pb-2 font-medium text-right">Commissie</th>
                </tr>
              </thead>
              <tbody>
                {perf.map(p => (
                  <tr key={p.link_id} className="border-t border-white/[0.04]">
                    <td className="py-1.5 text-[11px] text-white/85">{p.product ?? '—'}</td>
                    <td className="py-1.5 text-[10px] text-white/50">{p.network ?? '—'}</td>
                    <td className="py-1.5 text-right text-[11px] tabular-nums text-white/70">{p.click_count}</td>
                    <td className="py-1.5 text-right text-[11px] tabular-nums text-white/70">{p.confirmed_count}</td>
                    <td className="py-1.5 text-right text-[11px] tabular-nums text-white/55">{Number(p.conversion_rate_pct).toFixed(1)}</td>
                    <td className="py-1.5 text-right text-[11px] tabular-nums text-white/55">{fmtEur(Number(p.epc_eur))}</td>
                    <td className="py-1.5 text-right text-[11px] tabular-nums text-emerald-300/90">{fmtEur(Number(p.confirmed_commission_eur))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
