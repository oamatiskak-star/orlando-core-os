import { createClient } from '@/lib/supabase/server'
import { Megaphone, Video, Radio, Eye, Users, CreditCard, ChevronRight } from 'lucide-react'

type Campaign = {
  campaign_key: string
  channels: number
  creatives: number
  hooks: number
  uploads: number
  live_uploads: number
  avg_ctr: number | null
  avg_retention: number | null
  total_views: number
  revenue_attributed: number
}

const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)
const num = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)

// Gedeeld campagne-dashboard (gebruikt door /war-room/campaigns én /war-room/workspace/campaigns).
export default async function CampaignStudio() {
  const supabase = await createClient()
  const [campRes, convRes, chRes] = await Promise.all([
    supabase.from('v_war_room_campaigns').select('*').order('total_views', { ascending: false }),
    supabase.from('affiliate_conversions').select('channel_id, commission_eur, status'),
    supabase.from('media_holding_channels').select('id, niche'),
  ])

  if (campRes.error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Fout: {campRes.error.message}</div>
  }
  const campaigns = (campRes.data ?? []) as Campaign[]

  const nicheOf = new Map<string, string>()
  for (const c of chRes.data ?? []) nicheOf.set(c.id, c.niche ?? 'overig')
  const commercial = new Map<string, { leads: number; sales: number; revenue: number }>()
  for (const cv of convRes.data ?? []) {
    const key = cv.channel_id ? (nicheOf.get(cv.channel_id) ?? 'overig') : 'overig'
    const agg = commercial.get(key) ?? { leads: 0, sales: 0, revenue: 0 }
    agg.leads += 1
    if ((cv.status ?? '').toLowerCase() === 'confirmed') { agg.sales += 1; agg.revenue += Number(cv.commission_eur) || 0 }
    commercial.set(key, agg)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">Campaign Studio — campagne-dashboard per niche: keten + commerciële uitkomst. Affiliate-data nog 0 → Leads/Sales = &quot;Geen data&quot;.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => {
          const comm = commercial.get(c.campaign_key)
          const revenue = (comm?.revenue ?? 0) || Number(c.revenue_attributed) || 0
          return (
            <div key={c.campaign_key} className="rounded-lg border border-white/8 bg-[#0e1525] p-4">
              <div className="flex items-center gap-2">
                <Megaphone size={15} className="text-violet-400" />
                <h3 className="text-sm font-semibold capitalize text-white">{c.campaign_key}</h3>
                <span className="ml-auto text-[10px] text-white/40">{c.channels} kanaal{c.channels === 1 ? '' : 'en'}</span>
              </div>

              {/* keten: Campagne → Hook → Creative → Platform → Resultaat */}
              <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] text-white/50">
                <span className="rounded bg-violet-500/15 px-1.5 py-0.5 capitalize text-violet-300">{c.campaign_key}</span>
                <ChevronRight size={10} className="text-white/25" />
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-300">{c.hooks} hooks</span>
                <ChevronRight size={10} className="text-white/25" />
                <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">{c.creatives} creatives</span>
                <ChevronRight size={10} className="text-white/25" />
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300">{c.uploads} uploads</span>
                <ChevronRight size={10} className="text-white/25" />
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">{revenue > 0 ? eur(revenue) : 'geen omzet'}</span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat icon={Radio} label="live" value={String(c.live_uploads)} accent="#22c55e" />
                <Stat icon={Eye} label="views" value={num(c.total_views)} />
                <Stat label="CTR" value={c.avg_ctr != null ? `${c.avg_ctr}%` : '—'} accent="#34d399" />
                <Stat icon={Users} label="leads" value={comm ? String(comm.leads) : '—'} />
                <Stat icon={CreditCard} label="sales" value={comm ? String(comm.sales) : '—'} />
                <Stat label="ROAS" value={'—'} />
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
                <span className="text-white/40">revenue · retentie {c.avg_retention != null ? `${c.avg_retention}%` : '—'}</span>
                <span className="font-semibold text-emerald-400">{revenue > 0 ? eur(revenue) : 'Geen data'}</span>
              </div>
            </div>
          )
        })}
        {campaigns.length === 0 && (
          <div className="col-span-full rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">Nog geen campagnes.</div>
        )}
      </div>
    </div>
  )
}

function Stat({ icon: Icon, label, value, accent }: { icon?: typeof Video; label: string; value: string; accent?: string }) {
  return (
    <div className="rounded bg-white/[0.03] py-2">
      <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-white/35">
        {Icon && <Icon size={10} />}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold" style={{ color: accent ?? '#fff' }}>{value}</div>
    </div>
  )
}
