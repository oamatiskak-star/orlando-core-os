'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Globe2, Radar, Hammer, Upload, Activity, Zap, TrendingUp,
  BookOpen, Music, Search, Network, Megaphone, Link as LinkIcon,
  Wallet, Users, Award, Archive, Languages, Video,
} from 'lucide-react'
import clsx from 'clsx'

type Kpis = {
  channels:           { total: number; by_status: Record<string, number> }
  viral_opportunities:{ total: number; top: Array<{ id: string; virality_score: number; title?: string }> }
  content:            { total: number; by_status: Record<string, number> }
  uploads:            { total: number; by_status: Record<string, number> }
  metrics:            { total_views: number; total_revenue: number }
  workers:            { total: number; by_status: Record<string, number> }
  sponsors:           { total: number }
  affiliates:         { total: number }
  monetization:       { monthly_revenue_active: number }
}

type ModuleCard = {
  slug: string
  title: string
  icon: typeof Globe2
  count: number
  status: 'live' | 'stub' | 'offline'
  description: string
}

export default function MediaHoldingHub() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/media-holding/dashboard/kpis')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { setKpis(j); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const modules: ModuleCard[] = [
    { slug: 'viral-intelligence', title: 'Viral Intelligence', icon: Radar,      count: kpis?.viral_opportunities.total ?? 0, status: 'live',    description: 'YouTube / TikTok / Reels / Reddit / Trends scanner' },
    { slug: 'channel-incubator',  title: 'Channel Incubator',  icon: TrendingUp, count: kpis?.channels.total ?? 0,            status: 'live',    description: 'Niche → channel launch pipeline' },
    { slug: 'content-factory',    title: 'Content Factory',    icon: Hammer,     count: kpis?.content.total ?? 0,             status: 'stub',    description: 'Shorts, reels, loops, AI visuals' },
    { slug: 'upload-engine',      title: 'Upload Engine',      icon: Upload,     count: kpis?.uploads.total ?? 0,             status: 'stub',    description: 'Batch scheduling + upload tracking' },
    { slug: 'analytics-engine',   title: 'Analytics Engine',   icon: Activity,   count: 0,                                     status: 'stub',    description: 'Views, retention, CTR snapshots' },
    { slug: 'algorithm-gravity',  title: 'Algorithm Gravity',  icon: Zap,        count: 0,                                     status: 'stub',    description: 'Breakouts, momentum, replay spikes' },
    { slug: 'retention-lab',      title: 'Retention Lab',      icon: Video,      count: 0,                                     status: 'stub',    description: 'Per-second retention curves' },
    { slug: 'hook-library',       title: 'Hook Library',       icon: BookOpen,   count: 0,                                     status: 'stub',    description: 'High-retention openings' },
    { slug: 'audio-library',      title: 'Audio Library',      icon: Music,      count: 0,                                     status: 'stub',    description: 'Rising audio per platform' },
    { slug: 'trend-scanner',      title: 'Trend Scanner',      icon: Search,     count: 0,                                     status: 'stub',    description: 'Google Trends, Reddit, news, X' },
    { slug: 'cross-platform',     title: 'Cross-platform',     icon: Network,    count: 0,                                     status: 'stub',    description: 'Routes per channel / platform' },
    { slug: 'sponsor-engine',     title: 'Sponsor Engine',     icon: Megaphone,  count: kpis?.sponsors.total ?? 0,            status: 'stub',    description: 'Brand outreach + fit scoring' },
    { slug: 'affiliate-engine',   title: 'Affiliate Engine',   icon: LinkIcon,   count: kpis?.affiliates.total ?? 0,          status: 'stub',    description: 'Affiliate links per kanaal' },
    { slug: 'monetization',       title: 'Monetization',       icon: Wallet,     count: 0,                                     status: 'stub',    description: 'AdSense, sponsors, products, memberships' },
    { slug: 'workers',            title: 'Workers',            icon: Users,      count: kpis?.workers.total ?? 0,             status: 'live',    description: 'Worker registry + health' },
    { slug: 'winner-extraction',  title: 'Winner Extraction',  icon: Award,      count: 0,                                     status: 'stub',    description: 'Remix / loop / multilingual variants' },
    { slug: 'archives',           title: 'Archives',           icon: Archive,    count: 0,                                     status: 'stub',    description: 'Gearchiveerde content' },
    { slug: 'language-expansion', title: 'Language Expansion', icon: Languages,  count: 0,                                     status: 'stub',    description: 'Multi-lingual variant pipeline' },
    { slug: 'dashboard',          title: 'KPI Dashboard',      icon: Activity,   count: kpis?.metrics.total_views ?? 0,       status: 'live',    description: 'Holding-wide KPI cockpit' },
  ]

  const statusColor: Record<ModuleCard['status'], string> = {
    live:    'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    stub:    'bg-amber-500/10 text-amber-300 border-amber-500/20',
    offline: 'bg-white/[0.06] text-white/55 border-white/10',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Globe2 size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Media Holding OS</h1>
            <p className="text-xs text-white/50">Autonome AI-aangedreven viral content holding — Phase 1 fundament.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total views"          value={loading ? '…' : (kpis?.metrics.total_views ?? 0).toLocaleString('nl-NL')} color="text-white" />
        <KpiCard label="Viral kansen"         value={loading ? '…' : (kpis?.viral_opportunities.total ?? 0).toString()}        color="text-indigo-300" />
        <KpiCard label="Active kanalen"       value={loading ? '…' : (kpis?.channels.by_status?.live ?? 0).toString()}          color="text-emerald-300" />
        <KpiCard label="Active monthly revenue" value={loading ? '…' : `€ ${(kpis?.monetization.monthly_revenue_active ?? 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="text-amber-300" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {modules.map((m) => {
          const Icon = m.icon
          return (
            <Link
              key={m.slug}
              href={`/dashboard/media-holding/${m.slug}`}
              className="bg-white/[0.06] border border-white/5 rounded-xl p-4 hover:bg-white/[0.10] transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.08] border border-white/10 flex items-center justify-center">
                  <Icon size={16} className="text-white/75" />
                </div>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium border', statusColor[m.status])}>
                  {m.status}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{m.title}</h3>
              <p className="text-[11px] text-white/55 mb-2">{m.description}</p>
              <p className="text-xl font-semibold text-white">{m.count.toLocaleString('nl-NL')}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
      <p className="text-[11px] text-white/50 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}
