import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { AccountStatusBadge, LoginStatusLabel, CategoryBadge } from '@/lib/affiliate-programs/badges'
import { createProgram, setAccountStatus, enqueueRun } from '../actions'
import {
  CATEGORY_LABEL, ACCOUNT_STATUS_LABEL,
  type AffiliateProgramRow, type AccountStatus, type ProgramCategory,
} from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const FILTERS: { key: string; label: string; statuses: AccountStatus[] | null }[] = [
  { key: 'all',      label: 'Alle',     statuses: null },
  { key: 'pending',  label: 'Pending',  statuses: ['applied', 'pending'] },
  { key: 'approved', label: 'Approved', statuses: ['approved'] },
  { key: 'active',   label: 'Active',   statuses: ['active', 'payout_active'] },
  { key: 'inactive', label: 'Inactive', statuses: ['not_started', 'rejected', 'suspended'] },
]

const STATUS_OPTIONS: AccountStatus[] = ['not_started', 'applied', 'pending', 'approved', 'active', 'payout_active', 'rejected', 'suspended']
const CATEGORY_OPTIONS: ProgramCategory[] = ['saas_ai', 'finance_crypto', 'vastgoed_data', 'affiliate_network', 'other']

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; focus?: string }>
}) {
  const params = await searchParams
  const activeFilter = FILTERS.find(f => f.key === params.status) ?? FILTERS[0]

  const company = await getActiveCompany()
  const supabase = await createClient()

  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  let query = supabase
    .from('affiliate_programs')
    .select('id, company_id, name, account_type, category, url, payout_model, recurring, account_status, login_status, payout_threshold, payout_currency, affiliate_link, referral_code, connected_channels, connected_brands, tax_requirements, kyc_requirements, country_availability, api_available, notes, assigned_agent, monthly_revenue, lifetime_revenue, last_status_check_at, next_action_at, created_at, updated_at')

  query = companyId
    ? query.or(`company_id.eq.${companyId},company_id.is.null`)
    : query.is('company_id', null)

  if (activeFilter.statuses) query = query.in('account_status', activeFilter.statuses)

  const { data } = await query.order('category', { ascending: true }).order('name', { ascending: true })
  const programs: AffiliateProgramRow[] = (data ?? []) as AffiliateProgramRow[]

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === 'all' ? '?' : `?status=${f.key}`}
            className={
              f.key === activeFilter.key
                ? 'px-2.5 py-1 text-[11px] rounded-lg bg-white/[0.1] text-white border border-white/15'
                : 'px-2.5 py-1 text-[11px] rounded-lg bg-white/[0.03] text-white/55 border border-white/[0.06] hover:bg-white/[0.06]'
            }
          >
            {f.label}
          </Link>
        ))}
        <span className="ml-auto text-[10px] text-white/40 tabular-nums">{programs.length} programma&apos;s</span>
      </div>

      {/* Add program */}
      <details className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <summary className="text-[11px] text-white/70 cursor-pointer select-none">+ Nieuw affiliate-programma toevoegen</summary>
        <form action={createProgram} className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
          <input name="name" required placeholder="Naam" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85 placeholder:text-white/30 focus:outline-none focus:border-white/30" />
          <select name="category" defaultValue="saas_ai" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85">
            {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
          </select>
          <input name="url" placeholder="https://…" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85 placeholder:text-white/30 focus:outline-none focus:border-white/30" />
          <input type="hidden" name="company_slug" value={company.id} />
          <button type="submit" className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded text-emerald-200">
            Toevoegen
          </button>
        </form>
      </details>

      {/* Table */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4 overflow-x-auto">
        {programs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[11px] text-white/40">Geen programma&apos;s voor dit filter.</p>
          </div>
        ) : (
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
                <th className="pb-2 font-medium">Programma</th>
                <th className="pb-2 font-medium">Categorie</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Login</th>
                <th className="pb-2 font-medium text-right">MRR</th>
                <th className="pb-2 font-medium">Acties</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => {
                const highlight = params.focus === p.id
                return (
                  <tr key={p.id} className={`border-t border-white/[0.04] align-middle ${highlight ? 'bg-white/[0.03]' : ''}`}>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] text-white/90 font-medium">{p.name}</span>
                        {p.url && (
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60">
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                      {p.account_type && p.account_type !== 'affiliate_program' && (
                        <div className="text-[9px] text-violet-300/70 font-mono">{p.account_type}</div>
                      )}
                      {p.affiliate_link && (
                        <div className="text-[9.5px] text-emerald-300/70 font-mono truncate max-w-[220px]">{p.affiliate_link}</div>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <CategoryBadge category={p.category} label={CATEGORY_LABEL[p.category]} size="xs" />
                    </td>
                    <td className="py-2 pr-3"><AccountStatusBadge status={p.account_status} size="xs" /></td>
                    <td className="py-2 pr-3"><LoginStatusLabel status={p.login_status} /></td>
                    <td className="py-2 pr-3 text-right text-[11px] tabular-nums text-white/70">
                      {Number(p.monthly_revenue) > 0 ? fmtMoney(Number(p.monthly_revenue)) : '—'}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1.5">
                        <form action={setAccountStatus} className="flex items-center gap-1">
                          <input type="hidden" name="program_id" value={p.id} />
                          <select
                            name="account_status"
                            defaultValue={p.account_status}
                            className="bg-white/[0.04] border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/80"
                          >
                            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{ACCOUNT_STATUS_LABEL[s]}</option>)}
                          </select>
                          <button type="submit" className="px-2 py-1 text-[10px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-white/75">
                            Set
                          </button>
                        </form>
                        <form action={enqueueRun}>
                          <input type="hidden" name="program_id" value={p.id} />
                          <input type="hidden" name="run_kind" value="terms_analysis" />
                          <button type="submit" className="px-2 py-1 text-[10px] bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 rounded text-violet-200" title="Queue: analyseer voorwaarden + payout via LLM">
                            Analyse
                          </button>
                        </form>
                        <Link
                          href={`/dashboard/account-setup/${p.id}/live`}
                          className="px-2 py-1 text-[10px] bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-400/30 rounded text-indigo-200"
                          title="Live: agent vult het registratieformulier in, jij keurt verzending goed"
                        >
                          Live setup
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[10px] text-white/30">
        &quot;Analyse&quot; plaatst een <span className="font-mono text-white/50">terms_analysis</span>-run in de queue
        (account_setup_runs). De Account Setup Agent (local-agent) vat dan voorwaarden + payout-structuur samen — komt online in Fase 3.
      </p>
    </div>
  )
}
