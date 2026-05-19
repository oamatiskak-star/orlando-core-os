import { createClient } from '@/lib/supabase/server'
import { Video, Target, Globe, Zap } from 'lucide-react'
import Image from 'next/image'

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export default async function ChannelsPage() {
  const supabase = await createClient()

  const [{ data: channels }, { data: campaigns }, { data: daily }] = await Promise.all([
    supabase.from('youtube_channels').select('*').order('naam'),
    supabase.from('youtube_strategy_campaigns').select('*').eq('status', 'active'),
    supabase.from('youtube_strategy_daily').select('channel_slug,views_actual,uploads_actual,breakout_detected'),
  ])

  const chList = channels ?? []
  const cList  = campaigns ?? []
  const dList  = daily ?? []

  return (
    <div className="space-y-6">

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
          <Video size={16} className="text-sky-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Channels</h1>
          <p className="text-xs text-white/45">{chList.length} kanalen in Media Holding OS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {chList.map(ch => {
          const campaign = cList.find(c => c.channel_slug === ch.channel_slug)
          const chDaily  = dList.filter(d => d.channel_slug === ch.channel_slug)
          const views    = chDaily.reduce((s, d) => s + (d.views_actual ?? 0), 0)
          const uploads  = chDaily.reduce((s, d) => s + (d.uploads_actual ?? 0), 0)
          const breakout = chDaily.some(d => d.breakout_detected)
          const color    = ch.accent_color ?? '#6366f1'

          return (
            <div key={ch.id} className="bg-white/[0.04] border border-white/8 rounded-2xl p-4 space-y-3 hover:border-white/12 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                  {ch.logo_svg_path ? (
                    <Image src={ch.logo_svg_path} alt={ch.naam} width={40} height={40} className="object-cover" />
                  ) : (
                    <Target size={14} className="text-white/30" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{ch.naam}</p>
                  <p className="text-xs text-white/40 truncate">@{ch.channel_slug}</p>
                </div>
                {breakout && (
                  <span className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400">
                    <Zap size={8} /> HOT
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.04] rounded-lg p-2">
                  <p className="text-[10px] text-white/35 uppercase">Views</p>
                  <p className="text-base font-bold tabular-nums" style={{ color }}>{num(views)}</p>
                </div>
                <div className="bg-white/[0.04] rounded-lg p-2">
                  <p className="text-[10px] text-white/35 uppercase">Uploads</p>
                  <p className="text-base font-bold text-white tabular-nums">{uploads}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                {ch.content_language && (
                  <span className="flex items-center gap-1 text-white/40">
                    <Globe size={10} /> {ch.content_language.toUpperCase()}
                  </span>
                )}
                {campaign && (
                  <span className="text-white/35">
                    {campaign.target_uploads_daily} Shorts/dag
                  </span>
                )}
                {ch.shorts_first && (
                  <span className="text-violet-400/70 font-medium">Shorts-first</span>
                )}
              </div>
            </div>
          )
        })}

        {chList.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <Video size={32} className="text-white/15 mb-3" />
            <p className="text-sm text-white/40">Geen kanalen gevonden</p>
          </div>
        )}
      </div>
    </div>
  )
}
