import { Globe, Tv2, Wallet, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { AccountStatusBadge } from '@/lib/affiliate-programs/badges'
import {
  channelLabel,
  type YoutubeChannelRow, type AquierMonitorRow, type AffiliateProgramRow,
} from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const AQUIER_PATTERN = /^(aquier|propertyinvestor)/i

function isAquier(c: YoutubeChannelRow): boolean {
  return AQUIER_PATTERN.test(c.naam ?? '') || AQUIER_PATTERN.test(c.name ?? '') || AQUIER_PATTERN.test(c.handle ?? '')
}
function subsOf(c: YoutubeChannelRow): number {
  return Number(c.subscriber_count ?? c.subscribers ?? 0)
}
function fmtEur(n: number): string {
  return Number(n).toLocaleString('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}
function fmtUsd(n: number): string {
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

type ProgRev = Pick<AffiliateProgramRow, 'id' | 'name' | 'account_status' | 'monthly_revenue' | 'lifetime_revenue' | 'connected_channels'>

export default async function AquierRevenuePage() {
  const company = await getActiveCompany()
  const supabase = await createClient()
  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  const { data: chanData } = await supabase
    .from('youtube_channels')
    .select('id, name, naam, handle, subscriber_count, subscribers, monthly_revenue, estimated_revenue, status, language')
  const allChannels: YoutubeChannelRow[] = (chanData ?? []) as YoutubeChannelRow[]
  const aquierChannels = allChannels.filter(isAquier)
  const aquierChannelIds = aquierChannels.map(c => c.id)

  // Affiliate-programma's gekoppeld aan Aquier-kanalen (array-overlap)
  let linkedPrograms: ProgRev[] = []
  if (aquierChannelIds.length) {
    let q = supabase
      .from('affiliate_programs')
      .select('id, name, account_status, monthly_revenue, lifetime_revenue, connected_channels')
      .overlaps('connected_channels', aquierChannelIds)
    q = companyId ? q.or(`company_id.eq.${companyId},company_id.is.null`) : q.is('company_id', null)
    const { data } = await q.order('monthly_revenue', { ascending: false })
    linkedPrograms = (data ?? []) as ProgRev[]
  }

  // Aquier monitor-signalen (echte metrics)
  const { data: monData } = await supabase
    .from('aquier_monitor_events')
    .select('id, event_at, category, title, metric_key, metric_value, metric_target, variance_pct')
    .not('metric_key', 'is', null)
    .order('event_at', { ascending: false })
    .limit(12)
  const monitor: AquierMonitorRow[] = (monData ?? []) as AquierMonitorRow[]

  const ytRevenue = aquierChannels.reduce((a, c) => a + Number(c.monthly_revenue ?? c.estimated_revenue ?? 0), 0)
  const ytSubs = aquierChannels.reduce((a, c) => a + subsOf(c), 0)
  const affMrr = linkedPrograms.reduce((a, p) => a + Number(p.monthly_revenue ?? 0), 0)

  const kpis: Kpi[] = [
    { label: 'Aquier-kanalen', value: aquierChannels.length, accent: 'white', icon: <Tv2 size={13} /> },
    { label: 'YT revenue (mo)', value: fmtEur(ytRevenue), accent: ytRevenue > 0 ? 'emerald' : 'white', icon: <Wallet size={13} /> },
    { label: 'Affiliate MRR (Aquier)', value: fmtUsd(affMrr), accent: affMrr > 0 ? 'emerald' : 'white' },
    { label: 'Aquier subs', value: ytSubs.toLocaleString('nl-NL'), accent: 'violet' },
  ]

  return (
    <div className="space-y-5">
      <KpiStrip items={kpis} />
      <p className="text-[10px] text-white/40">
        Aggregatie van <span className="text-white/55">echte bronnen</span>: Aquier-YouTube-kanalen (youtube_channels),
        affiliate-programma&apos;s gekoppeld aan Aquier-kanalen (via YouTube Connector) en Aquier monitor-metrics.
        Lead/membership/SaaS-referral-tracking koppelt zodra die bron bestaat — geen geschatte cijfers.
      </p>

      {/* Aquier kanalen */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-3"><Globe size={14} className="text-cyan-300" /><h2 className="text-xs font-medium text-white/70">Aquier YouTube-kanalen</h2></div>
        {aquierChannels.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-white/40">Geen Aquier-kanalen herkend.</p>
        ) : (
          <table className="w-full">
            <thead><tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
              <th className="pb-2 font-medium">Kanaal</th><th className="pb-2 font-medium">Taal</th>
              <th className="pb-2 font-medium text-right">Subs</th><th className="pb-2 font-medium text-right">Revenue/mo</th>
            </tr></thead>
            <tbody>
              {aquierChannels.map(c => (
                <tr key={c.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[12px] text-white/90">{channelLabel(c)}</td>
                  <td className="py-1.5 text-[10px] text-white/45 uppercase">{c.language ?? '—'}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-white/70">{subsOf(c).toLocaleString('nl-NL')}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-emerald-300/90">{fmtEur(Number(c.monthly_revenue ?? c.estimated_revenue ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Affiliate-programma's via Aquier-kanalen */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <h2 className="text-xs font-medium text-white/70 mb-1">Affiliate-programma&apos;s via Aquier-kanalen</h2>
        <p className="text-[10px] text-white/40 mb-3">Programma&apos;s die in de YouTube Connector aan een Aquier-kanaal zijn gekoppeld.</p>
        {linkedPrograms.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-white/40">Nog geen programma&apos;s gekoppeld aan een Aquier-kanaal. Koppel ze via de YouTube Connector.</p>
        ) : (
          <table className="w-full">
            <thead><tr className="text-left text-[9px] uppercase tracking-wide text-white/35">
              <th className="pb-2 font-medium">Programma</th><th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium text-right">MRR</th><th className="pb-2 font-medium text-right">Lifetime</th>
            </tr></thead>
            <tbody>
              {linkedPrograms.map(p => (
                <tr key={p.id} className="border-t border-white/[0.04]">
                  <td className="py-1.5 text-[12px] text-white/90">{p.name}</td>
                  <td className="py-1.5"><AccountStatusBadge status={p.account_status} size="xs" /></td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-emerald-300/90">{fmtUsd(Number(p.monthly_revenue))}</td>
                  <td className="py-1.5 text-right text-[11px] tabular-nums text-white/70">{fmtUsd(Number(p.lifetime_revenue))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Aquier monitor-metrics */}
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-4">
        <div className="flex items-center gap-2 mb-3"><Activity size={14} className="text-indigo-300" /><h2 className="text-xs font-medium text-white/70">Aquier monitor-signalen</h2></div>
        {monitor.length === 0 ? (
          <p className="py-4 text-center text-[11px] text-white/40">Geen metric-events.</p>
        ) : (
          <div className="space-y-1">
            {monitor.map(m => (
              <div key={m.id} className="flex items-center gap-3 text-[10.5px] bg-white/[0.02] border border-white/[0.05] rounded px-2.5 py-1.5">
                <span className="text-white/40 font-mono w-16 shrink-0">{m.metric_key}</span>
                <span className="text-white/80 flex-1 truncate">{m.title ?? m.category ?? '—'}</span>
                <span className="tabular-nums text-white/70">{m.metric_value ?? '—'}{m.metric_target != null ? ` / ${m.metric_target}` : ''}</span>
                {m.variance_pct != null && (
                  <span className={`tabular-nums w-14 text-right ${Number(m.variance_pct) >= 0 ? 'text-emerald-300/80' : 'text-red-300/80'}`}>
                    {Number(m.variance_pct) >= 0 ? '+' : ''}{Number(m.variance_pct).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
