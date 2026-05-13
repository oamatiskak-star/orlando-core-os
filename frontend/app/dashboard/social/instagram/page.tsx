'use client'

import { Globe, BarChart3, Image, TrendingUp } from 'lucide-react'

export default function InstagramPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Instagram</h1>
        <p className="text-sm text-white/40 mt-0.5">Posts, analytics en contentplanning voor Instagram</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: Image,      label: 'Posts & Reels',  desc: 'Content overzicht en publicaties' },
          { icon: BarChart3,  label: 'Analytics',      desc: 'Bereik, engagement en groei' },
          { icon: TrendingUp, label: 'Trending',       desc: 'Trending content en hashtags' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="bg-white/[0.03] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 transition-colors cursor-pointer">
            <div className="w-9 h-9 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <Icon size={16} className="text-pink-400" />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/40">{desc}</p>
          </div>
        ))}
      </div>
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-8 flex flex-col items-center gap-3">
        <Globe size={32} className="text-white/15" />
        <p className="text-sm text-white/30">Instagram account nog niet gekoppeld</p>
        <button className="text-xs text-pink-400 hover:text-pink-300 transition-colors">Instagram verbinden</button>
      </div>
    </div>
  )
}
