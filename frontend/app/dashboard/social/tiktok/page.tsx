'use client'

import { Globe, BarChart3, Video, TrendingUp } from 'lucide-react'

export default function TikTokPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">TikTok</h1>
        <p className="text-sm text-white/65 mt-0.5">Shorts, analytics en contentplanning voor TikTok</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Video,      label: 'Videos',     desc: 'TikTok video overzicht en statistieken' },
          { icon: BarChart3,  label: 'Analytics',  desc: 'Views, likes en followersgroei' },
          { icon: TrendingUp, label: 'Trending',   desc: 'Trending sounds en hashtags' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white/[0.06] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Icon size={16} className="text-cyan-400" />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/65">{desc}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/[0.06] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <Globe size={32} className="text-white/50" />
        <p className="text-sm text-white/50">TikTok account nog niet gekoppeld</p>
        <button className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">TikTok verbinden</button>
      </div>
    </div>
  )
}
