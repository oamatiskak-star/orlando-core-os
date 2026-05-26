import { Boxes, ListChecks, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { AccountStatusBadge } from '@/lib/affiliate-programs/badges'
import { createAndProvisionAccount } from '../actions'
import {
  DOMAIN_LABEL, DOC_KIND_LABEL,
  type AccountSetupTypeRow, type AccountTypeDomain, type AffiliateProgramRow, type DocKind,
} from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DOMAIN_ORDER: AccountTypeDomain[] = ['affiliate', 'social', 'finance', 'legal', 'infra', 'marketplace', 'investor']

type AccountRow = Pick<AffiliateProgramRow, 'id' | 'name' | 'account_type' | 'account_status' | 'created_at'>

export default async function ScalingPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()
  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  const [typesRes, accRes] = await Promise.all([
    supabase.from('account_setup_types')
      .select('type_key, label, domain, description, checklist, required_docs, default_run_kind, active, sort_order')
      .eq('active', true).order('sort_order'),
    (companyId
      ? supabase.from('affiliate_programs').select('id, name, account_type, account_status, created_at').or(`company_id.eq.${companyId},company_id.is.null`)
      : supabase.from('affiliate_programs').select('id, name, account_type, account_status, created_at').is('company_id', null)),
  ])

  const types: AccountSetupTypeRow[] = (typesRes.data ?? []) as AccountSetupTypeRow[]
  const accounts: AccountRow[] = (accRes.data ?? []) as AccountRow[]

  const countByType = new Map<string, number>()
  for (const a of accounts) countByType.set(a.account_type, (countByType.get(a.account_type) ?? 0) + 1)

  const nonAffiliate = accounts.filter(a => a.account_type !== 'affiliate_program')

  const kpis: Kpi[] = [
    { label: 'Account-types', value: types.length, accent: 'white', icon: <Boxes size={13} /> },
    { label: 'Accounts totaal', value: accounts.length, accent: 'indigo' },
    { label: 'Non-affiliate accounts', value: nonAffiliate.length, accent: nonAffiliate.length > 0 ? 'emerald' : 'white' },
    { label: 'Domeinen', value: new Set(types.map(t => t.domain)).size, accent: 'violet' },
  ]

  const byDomain = DOMAIN_ORDER
    .map(d => ({ d, items: types.filter(t => t.domain === d) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />
      <p className="text-[10px] text-white/40">
        Schaalbaarheids-framework: elk account-type definieert declaratief een onboarding-checklist + vereiste documenten
        (<span className="font-mono text-white/55">account_setup_types</span>). &quot;Account aanmaken&quot; zet meteen een
        onboarding-run in de queue — de runner genereert checklist-taken + document-vereisten uit het template.
      </p>

      {byDomain.map(({ d, items }) => (
        <div key={d} className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <div className="text-[10px] uppercase tracking-wide text-white/40 mb-3">{DOMAIN_LABEL[d]}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {items.map((t) => {
              const count = countByType.get(t.type_key) ?? 0
              return (
                <div key={t.type_key} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] text-white/90 font-medium flex-1">{t.label}</span>
                    {count > 0 && <span className="text-[10px] text-emerald-300/80 tabular-nums">{count} account{count === 1 ? '' : 's'}</span>}
                  </div>
                  {t.description && <p className="text-[10.5px] text-white/50 leading-snug mb-2">{t.description}</p>}
                  <div className="flex items-center gap-3 text-[10px] text-white/40 mb-2">
                    <span className="inline-flex items-center gap-1"><ListChecks size={11} />{(t.checklist ?? []).length} stappen</span>
                    {(t.required_docs ?? []).length > 0 && (
                      <span className="inline-flex items-center gap-1"><FileText size={11} />
                        {(t.required_docs as DocKind[]).map(dk => DOC_KIND_LABEL[dk] ?? dk).join(', ')}
                      </span>
                    )}
                  </div>
                  <form action={createAndProvisionAccount} className="flex items-center gap-1.5">
                    <input type="hidden" name="account_type" value={t.type_key} />
                    <input type="hidden" name="company_slug" value={company.id} />
                    <input name="name" required placeholder={`Naam ${t.label}…`} className="flex-1 bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[11px] text-white/85 placeholder:text-white/30" />
                    <button type="submit" className="px-2.5 py-1 text-[11px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded text-emerald-200 whitespace-nowrap">
                      + Account
                    </button>
                  </form>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Geprovisionde non-affiliate accounts */}
      {nonAffiliate.length > 0 && (
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <h2 className="text-xs font-medium text-white/70 mb-3">Aangemaakte accounts (non-affiliate)</h2>
          <table className="w-full">
            <thead><tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
              <th className="pb-2 font-medium">Naam</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {nonAffiliate.map(a => (
                <tr key={a.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[12px] text-white/90">{a.name}</td>
                  <td className="py-1.5 text-[10px] text-white/50 font-mono">{a.account_type}</td>
                  <td className="py-1.5"><AccountStatusBadge status={a.account_status} size="xs" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-white/30 mt-2">Onboarding-checklist + documenten staan onder <span className="text-white/50">Requires Action</span> / <span className="text-white/50">KYC</span> zodra de runner de run heeft verwerkt.</p>
        </div>
      )}
    </div>
  )
}
