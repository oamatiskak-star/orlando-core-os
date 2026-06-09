import { createClient } from '@/lib/supabase/server'
import { Megaphone, Video, Lightbulb, Upload, Radio, Eye } from 'lucide-react'

export const dynamic = 'force-dynamic'

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

export default async function CampaignViewPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('v_war_room_campaigns')
    .select('*')
    .order('total_views', { ascending: false })

  if (error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Fout: {error.message}</div>
  }
  const campaigns = (data ?? []) as Campaign[]

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">Uitzoomniveau — prestaties per campagne (niche). Direct zien welke campagnes presteren.</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {campaigns.map((c) => (
          <div key={c.campaign_key} className="rounded-lg border border-white/8 bg-[#0e1525] p-4">
            <div className="flex items-center gap-2">
              <Megaphone size={15} className="text-violet-400" />
              <h3 className="text-sm font-semibold capitalize text-white">{c.campaign_key}</h3>
              <span className="ml-auto text-[10px] text-white/40">{c.channels} kanaal{c.channels === 1 ? '' : 'en'}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat icon={Video} label="creatives" value={String(c.creatives)} />
              <Stat icon={Lightbulb} label="hooks" value={String(c.hooks)} />
              <Stat icon={Upload} label="uploads" value={String(c.uploads)} />
              <Stat icon={Radio} label="live" value={String(c.live_uploads)} accent="#22c55e" />
              <Stat icon={Eye} label="views" value={num(c.total_views)} />
              <Stat label="CTR" value={c.avg_ctr != null ? `${c.avg_ctr}%` : '—'} accent="#34d399" />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-xs">
              <span className="text-white/40">retentie {c.avg_retention != null ? `${c.avg_retention}%` : '—'}</span>
              <span className="font-semibold text-emerald-400">{eur(c.revenue_attributed)}</span>
            </div>
          </div>
        ))}
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
