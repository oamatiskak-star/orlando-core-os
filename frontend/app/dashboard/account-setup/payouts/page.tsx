import { Wallet, AlertTriangle, CheckCircle2, PlugZap } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { addPayout, upsertConnector, enqueueRun } from '../actions'
import {
  PAYOUT_STATUS_LABEL,
  type ReconciliationRow, type PayoutRow, type ConnectorRow, type ConnectorAuthType,
} from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const AUTH_TYPES: ConnectorAuthType[] = ['none', 'bearer', 'api_key', 'basic']

const PAYOUT_STATUS_STYLE: Record<string, string> = {
  expected: 'text-amber-300 border-amber-400/30 bg-amber-500/10',
  pending: 'text-indigo-300 border-indigo-400/30 bg-indigo-500/10',
  partial: 'text-amber-300 border-amber-400/30 bg-amber-500/10',
  paid: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10',
  discrepancy: 'text-red-300 border-red-400/30 bg-red-500/10',
  written_off: 'text-white/40 border-white/10 bg-white/[0.04]',
}

function fmt(n: number, cur = 'USD'): string {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 0 })
}
function fmtDate(s: string | null): string {
  return s ? new Date(s).toLocaleDateString('nl-NL', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
}

export default async function PayoutsPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()
  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  let progQ = supabase.from('affiliate_programs').select('id, name')
  progQ = companyId ? progQ.or(`company_id.eq.${companyId},company_id.is.null`) : progQ.is('company_id', null)
  const { data: progData } = await progQ.order('name')
  const programs = (progData ?? []) as { id: string; name: string }[]
  const programIds = programs.map(p => p.id)
  const nameById = new Map(programs.map(p => [p.id, p.name]))

  let recQ = supabase.from('v_payout_reconciliation')
    .select('program_id, company_id, name, payout_currency, payout_threshold, commission_total, total_paid, outstanding, at_threshold, open_expected, discrepancies')
  recQ = companyId ? recQ.or(`company_id.eq.${companyId},company_id.is.null`) : recQ.is('company_id', null)
  const { data: recData } = await recQ
  const recon = ((recData ?? []) as ReconciliationRow[]).filter(r => Number(r.commission_total) > 0 || Number(r.total_paid) > 0 || r.at_threshold)

  const [payoutsRes, connRes] = await Promise.all([
    programIds.length
      ? supabase.from('affiliate_payouts')
          .select('id, program_id, period_month, expected_amount, paid_amount, currency, status, expected_at, paid_at, external_ref, variance_amount, reconciled, notes')
          .in('program_id', programIds).order('updated_at', { ascending: false }).limit(50)
      : Promise.resolve({ data: [] }),
    programIds.length
      ? supabase.from('affiliate_api_connectors')
          .select('id, program_id, provider, base_url, auth_type, credential_env, config, enabled, last_sync_at, last_sync_status, last_error')
          .in('program_id', programIds)
      : Promise.resolve({ data: [] }),
  ])
  const payouts = (payoutsRes.data ?? []) as PayoutRow[]
  const connectors = (connRes.data ?? []) as ConnectorRow[]
  const connByProgram = new Map(connectors.map(c => [c.program_id, c]))

  const totalOutstanding = recon.reduce((a, r) => a + Number(r.outstanding ?? 0), 0)
  const totalPaid = recon.reduce((a, r) => a + Number(r.total_paid ?? 0), 0)
  const atThreshold = recon.filter(r => r.at_threshold).length
  const discrepancies = recon.reduce((a, r) => a + Number(r.discrepancies ?? 0), 0)

  const kpis: Kpi[] = [
    { label: 'Uitstaand', value: fmt(totalOutstanding), accent: totalOutstanding > 0 ? 'amber' : 'white', icon: <Wallet size={13} /> },
    { label: 'Totaal betaald', value: fmt(totalPaid), accent: 'emerald', icon: <CheckCircle2 size={13} /> },
    { label: 'Op drempel', value: atThreshold, accent: atThreshold > 0 ? 'indigo' : 'white' },
    { label: 'Discrepanties', value: discrepancies, accent: discrepancies > 0 ? 'red' : 'white', icon: <AlertTriangle size={13} /> },
  ]

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />

      {/* Reconciliatie */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-1">Payout-reconciliatie</h2>
        <p className="text-[10px] text-white/40 mb-3">Commissie-totaal (rollup) − betaald = uitstaand. De cron maakt een &apos;verwacht&apos; payout zodra de drempel is bereikt.</p>
        {recon.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-white/40">Nog geen commissie/payouts geboekt.</p>
        ) : (
          <table className="w-full">
            <thead><tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
              <th className="pb-2 font-medium">Programma</th><th className="pb-2 font-medium text-right">Commissie</th>
              <th className="pb-2 font-medium text-right">Betaald</th><th className="pb-2 font-medium text-right">Uitstaand</th>
              <th className="pb-2 font-medium text-right">Drempel</th>
            </tr></thead>
            <tbody>
              {recon.map(r => (
                <tr key={r.program_id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[12px] text-white/90">{r.name}{r.discrepancies > 0 && <span className="ml-1.5 text-[9px] text-red-300">⚠ {r.discrepancies}</span>}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-white/70">{fmt(Number(r.commission_total), r.payout_currency)}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-emerald-300/80">{fmt(Number(r.total_paid), r.payout_currency)}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-amber-300/90">{fmt(Number(r.outstanding), r.payout_currency)}</td>
                  <td className="py-1.5 text-right text-[10px] tabular-nums text-white/50">{r.payout_threshold != null ? fmt(Number(r.payout_threshold), r.payout_currency) : '—'}{r.at_threshold && <span className="ml-1 text-emerald-300">✓</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <details className="mt-3">
          <summary className="text-[11px] text-white/70 cursor-pointer select-none">+ Betaalde payout boeken</summary>
          <form action={addPayout} className="mt-2 grid grid-cols-1 sm:grid-cols-5 gap-2 text-[11px]">
            <select name="program_id" required className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85 sm:col-span-2">
              {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input name="paid_amount" type="number" step="0.01" min="0" required placeholder="Bedrag" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85" />
            <input name="paid_at" type="date" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85" />
            <input name="external_ref" placeholder="Ref / transactie-id" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1.5 text-white/85" />
            <input type="hidden" name="currency" value="USD" />
            <button type="submit" className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 rounded text-emerald-200 sm:col-span-5">Boeken + reconcileren</button>
          </form>
        </details>
      </div>

      {/* Payout-historie */}
      {payouts.length > 0 && (
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
          <h2 className="text-xs font-medium text-white/70 mb-3">Payout-historie</h2>
          <table className="w-full">
            <thead><tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
              <th className="pb-2 font-medium">Programma</th><th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium text-right">Verwacht</th><th className="pb-2 font-medium text-right">Betaald</th>
              <th className="pb-2 font-medium text-right">Variance</th><th className="pb-2 font-medium">Datum</th>
            </tr></thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[11px] text-white/85">{nameById.get(p.program_id) ?? '—'}</td>
                  <td className="py-1.5"><span className={`inline-flex px-1.5 py-0.5 text-[9px] uppercase tracking-wide rounded border ${PAYOUT_STATUS_STYLE[p.status] ?? ''}`}>{PAYOUT_STATUS_LABEL[p.status]}</span></td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-white/60">{fmt(Number(p.expected_amount), p.currency)}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-emerald-300/80">{fmt(Number(p.paid_amount), p.currency)}</td>
                  <td className={`py-1.5 text-right text-[11px] tabular-nums ${Number(p.variance_amount) < 0 ? 'text-red-300/80' : 'text-white/50'}`}>{fmt(Number(p.variance_amount), p.currency)}</td>
                  <td className="py-1.5 text-[10px] text-white/45 tabular-nums">{fmtDate(p.paid_at ?? p.expected_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* API-connectors */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-1">
          <PlugZap size={14} className="text-cyan-300" />
          <h2 className="text-xs font-medium text-white/70">API-connectors (auto revenue-sync)</h2>
          {connectors.length > 0 && (
            <span className="ml-auto text-[10px] text-cyan-300/80 tabular-nums">{connectors.length} geconfigureerd · {connectors.filter(c => c.enabled).length} actief</span>
          )}
        </div>
        <p className="text-[10px] text-white/40 mb-3">Per programma een netwerk-API koppelen. <span className="text-white/55">Secret staat NIET in de DB</span> — vul de naam van een env-var (op de runner-host) in via <span className="font-mono">credential_env</span>. &quot;Sync nu&quot; zet een revenue_sync-run in de queue. Geconfigureerde connectors staan bovenaan.</p>
        <div className="space-y-2">
          {[...programs].sort((a, b) => {
            const rank = (id: string) => { const c = connByProgram.get(id); return c ? (c.enabled ? 0 : 1) : 2 }
            const ra = rank(a.id), rb = rank(b.id)
            return ra !== rb ? ra - rb : a.name.localeCompare(b.name)
          }).map(p => {
            const c = connByProgram.get(p.id)
            return (
              <details key={p.id} open={!!c} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
                <summary className="flex items-center gap-2 cursor-pointer select-none list-none">
                  <span className="text-[12px] text-white/85 flex-1">{p.name}</span>
                  {c?.enabled
                    ? <span className="text-[9px] px-1.5 py-0.5 rounded border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">ON</span>
                    : <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04] text-white/40">{c ? 'OFF' : 'geen'}</span>}
                  {c?.last_sync_status && <span className={`text-[9px] ${c.last_sync_status === 'ok' ? 'text-emerald-300/70' : 'text-red-300/70'}`}>sync: {c.last_sync_status}</span>}
                </summary>
                <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <form action={upsertConnector} className="space-y-1.5">
                    <input type="hidden" name="program_id" value={p.id} />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input name="provider" defaultValue={c?.provider ?? ''} placeholder="provider (bv. impact)" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10.5px] text-white/85" />
                      <select name="auth_type" defaultValue={c?.auth_type ?? 'none'} className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10.5px] text-white/85">
                        {AUTH_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <input name="endpoint" defaultValue={String(c?.config?.endpoint ?? '')} placeholder="endpoint URL" className="w-full bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10.5px] text-white/85" />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input name="credential_env" defaultValue={c?.credential_env ?? ''} placeholder="credential_env (env-var)" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10.5px] text-white/85 font-mono" />
                      <input name="header_name" defaultValue={String(c?.config?.header_name ?? '')} placeholder="header_name (api_key)" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10.5px] text-white/85" />
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <input name="array_path" defaultValue={String(c?.config?.array_path ?? '')} placeholder="array_path" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10px] text-white/85 font-mono" />
                      <input name="commission_path" defaultValue={String(c?.config?.commission_path ?? '')} placeholder="commission_path" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10px] text-white/85 font-mono" />
                      <input name="period_path" defaultValue={String(c?.config?.period_path ?? '')} placeholder="period_path" className="bg-white/[0.04] border border-white/10 rounded px-2 py-1 text-[10px] text-white/85 font-mono" />
                    </div>
                    <input type="hidden" name="method" value="GET" />
                    <label className="flex items-center gap-1.5 text-[10.5px] text-white/70">
                      <input type="checkbox" name="enabled" defaultChecked={c?.enabled ?? false} /> Connector ingeschakeld
                    </label>
                    <button type="submit" className="px-2.5 py-1 text-[10.5px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-white/80">Connector opslaan</button>
                  </form>
                  <div className="space-y-1.5">
                    {c?.last_error && <p className="text-[10px] text-red-300/80 font-mono leading-snug">laatste fout: {c.last_error}</p>}
                    {c?.last_sync_at && <p className="text-[10px] text-white/45">laatste sync: {fmtDate(c.last_sync_at)}</p>}
                    <form action={enqueueRun}>
                      <input type="hidden" name="program_id" value={p.id} />
                      <input type="hidden" name="run_kind" value="revenue_sync" />
                      <button type="submit" disabled={!c?.enabled}
                        className={c?.enabled
                          ? 'px-2.5 py-1 text-[10.5px] bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/30 rounded text-cyan-200'
                          : 'px-2.5 py-1 text-[10.5px] bg-white/[0.03] border border-white/10 rounded text-white/30 cursor-not-allowed'}>
                        Sync nu
                      </button>
                    </form>
                    <p className="text-[9.5px] text-white/30 leading-snug">De runner leest de API met de auth uit <span className="font-mono">credential_env</span> en upsert per maand in <span className="font-mono">affiliate_revenue_ledger</span>.</p>
                  </div>
                </div>
              </details>
            )
          })}
        </div>
      </div>
    </div>
  )
}
