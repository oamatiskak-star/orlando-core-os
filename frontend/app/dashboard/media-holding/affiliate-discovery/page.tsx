import { createClient } from '@/lib/supabase/server'
import { Radar, CheckCircle2, XCircle, Circle, Plug } from 'lucide-react'

export const revalidate = 0
export const dynamic = 'force-dynamic'

type Run = { id: string; network: string; source: string; rows_received: number; rows_imported: number; rows_skipped: number; ran_at: string | null; outcome: string; detail: Record<string, unknown> | null }
type Net = { network_category: string; programs: number; media_relevant: number; recurring: number; api_available: number; avg_rpm_equiv: number | null; avg_epc: number | null; revenue_potential: number | null; last_seen: string | null }
type Conn = { id: string; provider: string; base_url: string | null; auth_type: string | null; credential_env: string | null; enabled: boolean; last_sync_at: string | null; last_sync_status: string | null; last_error: string | null; program_name: string | null }

const OUTCOME_C: Record<string, string> = { imported: '#22c55e', no_new: '#94a3b8', empty: '#64748b', error: '#ef4444' }
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—')

export default async function AffiliateDiscoveryPage() {
  const supabase = await createClient()
  const [{ data: runs }, { data: nets }, { data: conns }] = await Promise.all([
    supabase.from('v_affiliate_discovery_runs').select('*').limit(40),
    supabase.from('v_affiliate_network_overview').select('*'),
    supabase.from('v_affiliate_connector_health').select('*'),
  ])
  const runList = (runs ?? []) as Run[]
  const netList = (nets ?? []) as Net[]
  const connList = (conns ?? []) as Conn[]
  const totalPrograms = netList.reduce((s, n) => s + n.programs, 0)
  const enabledConns = connList.filter((c) => c.enabled).length
  const everRan = runList.length > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center">
          <Radar size={16} className="text-fuchsia-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Affiliate Discovery</h1>
          <p className="text-xs text-white/45">Continue crawler over netwerk-connectors — {totalPrograms} programma&apos;s in portefeuille</p>
        </div>
      </div>

      {!everRan && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-sm text-white/80">
          <span className="font-semibold text-amber-300">Crawler heeft nog niet gedraaid.</span> {enabledConns} connector(s) actief.
          De crawler draait runtime (Engine <code>affiliate:discovery</code>, CLI-L lane L3): <code>AFFILIATE_DISCOVERY_RUN=1 node dist/affiliate-discovery.js</code>.
          Connectors zonder credential worden overgeslagen (geen mock).
        </div>
      )}

      {/* connector-gezondheid */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2">
          <Plug size={13} className="text-white/50" />
          <span className="text-xs font-semibold text-white">Connectors ({enabledConns} actief)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="text-white/35"><tr className="border-b border-white/5">
              <th className="px-4 py-2 font-medium">Provider</th><th className="px-3 py-2 font-medium">Auth</th>
              <th className="px-3 py-2 font-medium">Credential-env</th><th className="px-3 py-2 font-medium">Laatste sync</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr></thead>
            <tbody>
              {connList.map((c) => (
                <tr key={c.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2 font-medium text-white/80">
                    {c.enabled ? <CheckCircle2 size={11} className="inline mr-1 text-emerald-400" /> : <Circle size={11} className="inline mr-1 text-white/25" />}
                    {c.provider}
                  </td>
                  <td className="px-3 py-2 text-white/45">{c.auth_type ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-[10px] text-white/45">{c.credential_env ?? '—'}</td>
                  <td className="px-3 py-2 text-white/45">{dt(c.last_sync_at)}</td>
                  <td className="px-3 py-2">
                    {c.last_sync_status === 'ok' ? <span className="text-emerald-400 text-[10px]">ok</span>
                      : c.last_sync_status === 'error' ? <span className="text-red-400 text-[10px]" title={c.last_error ?? ''}>error</span>
                      : <span className="text-white/30 text-[10px]">nooit</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* netwerk-overzicht */}
      <div>
        <span className="text-xs font-semibold text-white/80">Portefeuille per categorie</span>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {netList.map((nrow) => (
            <div key={nrow.network_category} className="bg-white/[0.04] border border-white/8 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{nrow.network_category}</span>
                <span className="text-lg font-bold text-fuchsia-300">{nrow.programs}</span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px]">
                <Mini label="media" value={String(nrow.media_relevant)} />
                <Mini label="recurring" value={String(nrow.recurring)} />
                <Mini label="API" value={String(nrow.api_available)} />
                <Mini label="EPC" value={nrow.avg_epc ? `€${nrow.avg_epc}` : '—'} />
                <Mini label="RPM" value={nrow.avg_rpm_equiv ? `€${nrow.avg_rpm_equiv}` : '—'} />
                <Mini label="pot." value={nrow.revenue_potential ? `€${nrow.revenue_potential}` : '—'} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* crawl-historie */}
      <div className="bg-white/[0.04] border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 text-xs font-semibold text-white">Crawl-historie</div>
        {runList.length === 0 ? (
          <div className="px-4 py-6 text-[12px] text-white/35 text-center">Nog geen crawl-runs.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="text-white/35"><tr className="border-b border-white/5">
                <th className="px-4 py-2 font-medium">Wanneer</th><th className="px-3 py-2 font-medium">Netwerk</th>
                <th className="px-3 py-2 font-medium text-right">Ontvangen</th><th className="px-3 py-2 font-medium text-right">Nieuw</th>
                <th className="px-3 py-2 font-medium text-right">Bekend</th><th className="px-3 py-2 font-medium">Resultaat</th>
              </tr></thead>
              <tbody>
                {runList.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-2 text-white/55">{dt(r.ran_at)}</td>
                    <td className="px-3 py-2 text-white/70">{r.network}</td>
                    <td className="px-3 py-2 text-right text-white/55">{r.rows_received}</td>
                    <td className="px-3 py-2 text-right text-emerald-400">{r.rows_imported}</td>
                    <td className="px-3 py-2 text-right text-white/40">{r.rows_skipped}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold" style={{ color: OUTCOME_C[r.outcome] ?? '#94a3b8' }}>
                        {r.outcome === 'error' ? <XCircle size={10} /> : <CheckCircle2 size={10} />}{r.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[10px] text-white/30 leading-relaxed">
        Config-gedreven crawler over <code className="text-white/40">affiliate_api_connectors</code> → <code className="text-white/40">affiliate_programs</code> + <code className="text-white/40">affiliate_import_runs</code>.
        Geen hardcoded endpoints/mock: provider/auth/response-vorm staan in de connector-config. Draaien = runtime (CLI-L L3); research-sourcing van netwerken = L6.
      </p>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-black/20 px-1.5 py-1"><div className="text-white/30 text-[9px]">{label}</div><div className="font-semibold text-white/75">{value}</div></div>
}
