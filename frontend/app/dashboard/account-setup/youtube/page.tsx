import { Tv2, Users, Link2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { KpiStrip, type Kpi } from '@/components/executive/KpiStrip'
import { setChannelLink } from '../actions'
import { channelLabel, type YoutubeChannelRow } from '@/lib/affiliate-programs/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type ProgLink = { id: string; name: string; connected_channels: string[] }

function fmtNum(n: number | null): string {
  return (n ?? 0).toLocaleString('nl-NL')
}
function subsOf(c: YoutubeChannelRow): number {
  return Number(c.subscriber_count ?? c.subscribers ?? 0)
}

export default async function YoutubeConnectorPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()
  const companyRow = await supabase.from('companies').select('id').eq('slug', company.id).maybeSingle()
  const companyId = companyRow.data?.id ?? null

  const [channelsRes, progRes] = await Promise.all([
    supabase
      .from('youtube_channels')
      .select('id, name, naam, handle, subscriber_count, subscribers, monthly_revenue, estimated_revenue, status, language'),
    (companyId
      ? supabase.from('affiliate_programs').select('id, name, connected_channels').or(`company_id.eq.${companyId},company_id.is.null`)
      : supabase.from('affiliate_programs').select('id, name, connected_channels').is('company_id', null)),
  ])

  const channels: YoutubeChannelRow[] = (channelsRes.data ?? []) as YoutubeChannelRow[]
  channels.sort((a, b) => subsOf(b) - subsOf(a))
  const programs: ProgLink[] = ((progRes.data ?? []) as ProgLink[]).map(p => ({
    ...p, connected_channels: Array.isArray(p.connected_channels) ? p.connected_channels : [],
  }))

  const totalConnections = programs.reduce((a, p) => a + p.connected_channels.length, 0)
  const connectedPrograms = programs.filter(p => p.connected_channels.length > 0).length

  const kpis: Kpi[] = [
    { label: 'Kanalen', value: channels.length, accent: 'white', icon: <Tv2 size={13} /> },
    { label: 'Koppelingen', value: totalConnections, accent: totalConnections > 0 ? 'emerald' : 'white', icon: <Link2 size={13} /> },
    { label: 'Programma’s gekoppeld', value: connectedPrograms, accent: 'indigo' },
    { label: 'Totaal subs', value: fmtNum(channels.reduce((a, c) => a + subsOf(c), 0)), accent: 'violet', icon: <Users size={13} /> },
  ]

  return (
    <div className="space-y-4">
      <KpiStrip items={kpis} />
      <p className="text-[10px] text-white/40">
        Koppel affiliate-programma&apos;s aan YouTube-kanalen. De koppeling wordt opgeslagen in
        <span className="font-mono text-white/55"> affiliate_programs.connected_channels</span> en gebruikt door de Aquier Revenue Engine.
      </p>

      {channels.length === 0 ? (
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] py-10 text-center">
          <Tv2 size={22} className="text-white/15 mx-auto mb-2" />
          <p className="text-[11px] text-white/40">Geen YouTube-kanalen gevonden.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {channels.map((c) => {
            const connected = programs.filter(p => p.connected_channels.includes(c.id))
            const available = programs.filter(p => !p.connected_channels.includes(c.id))
            const revenue = Number(c.monthly_revenue ?? c.estimated_revenue ?? 0)
            return (
              <div key={c.id} className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Tv2 size={14} className="text-red-400/80" />
                  <span className="text-[13px] text-white/90 font-medium flex-1">{channelLabel(c)}</span>
                  <span className="text-[10px] text-white/45 tabular-nums">{fmtNum(subsOf(c))} subs</span>
                  {revenue > 0 && <span className="text-[10px] text-emerald-300/80 tabular-nums">€{fmtNum(Math.round(revenue))}/mo</span>}
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {connected.length === 0 ? (
                    <span className="text-[10px] text-white/30">Geen programma&apos;s gekoppeld</span>
                  ) : connected.map(p => (
                    <form key={p.id} action={setChannelLink} className="inline-flex">
                      <input type="hidden" name="program_id" value={p.id} />
                      <input type="hidden" name="channel_id" value={c.id} />
                      <input type="hidden" name="op" value="remove" />
                      <button type="submit" title="Ontkoppelen"
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 hover:bg-red-500/15 hover:border-red-400/30 hover:text-red-200 transition-colors">
                        {p.name} <span className="text-[11px] leading-none">×</span>
                      </button>
                    </form>
                  ))}
                </div>

                {available.length > 0 && (
                  <form action={setChannelLink} className="flex items-center gap-1.5">
                    <input type="hidden" name="channel_id" value={c.id} />
                    <input type="hidden" name="op" value="add" />
                    <select name="program_id" className="bg-white/[0.04] border border-white/10 rounded px-1.5 py-1 text-[10px] text-white/80 flex-1">
                      {available.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button type="submit" className="px-2 py-1 text-[10px] bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded text-white/75">+ Koppel</button>
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
