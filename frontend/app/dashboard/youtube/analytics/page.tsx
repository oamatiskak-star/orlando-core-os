'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart2, Eye, Users, TrendingUp, RefreshCw, Loader2 } from 'lucide-react'
import clsx from 'clsx'

type Channel = {
  id: string
  naam: string
  subscriber_count: number
  view_count: number
  video_count: number
  today_views: number
  weekly_views: number
  monthly_views: number
  estimated_revenue: number
  last_sync: string | null
  oauth_status: string
}

const COLORS: Record<string, string> = {
  VermogenTv:        '#6366f1',
  VastgoedTv:        '#0ea5e9',
  SpaarTv:           '#10b981',
  CryptoVermogen:    '#f59e0b',
  BeleggingsTv:      '#8b5cf6',
  PropertyInvestorTv:'#ec4899',
}

function num(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function fmt(iso: string | null) {
  if (!iso) return 'Nooit'
  return new Date(iso).toLocaleString('nl-NL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AnalyticsPage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [syncing, setSyncing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data } = await supabase.from('youtube_channels').select('*').order('subscriber_count', { ascending: false })
      setChannels((data ?? []) as Channel[])
      setLoading(false)
    }
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  async function syncAll() {
    setSyncing(true)
    await fetch('/api/youtube/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const supabase = createClient()
    const { data } = await supabase.from('youtube_channels').select('*').order('subscriber_count', { ascending: false })
    setChannels((data ?? []) as Channel[])
    setSyncing(false)
  }

  const totals = channels.reduce((a, c) => ({
    subscribers: a.subscribers + (c.subscriber_count ?? 0),
    views:       a.views       + (c.view_count ?? 0),
    today:       a.today       + (c.today_views ?? 0),
    revenue:     a.revenue     + (c.estimated_revenue ?? 0),
  }), { subscribers: 0, views: 0, today: 0, revenue: 0 })

  return (
    <div className="space-y-5">
      {/* Summary widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal subscribers', value: num(totals.subscribers), icon: Users,      color: 'text-indigo-400' },
          { label: 'Totaal views',        value: num(totals.views),       icon: Eye,        color: 'text-sky-400' },
          { label: 'Views vandaag',       value: num(totals.today),       icon: TrendingUp, color: 'text-green-400' },
          { label: 'Est. Revenue',        value: `€${totals.revenue.toFixed(2)}`, icon: BarChart2, color: 'text-amber-400' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <Icon size={13} className={clsx(s.color, 'mb-2')} />
              <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Per-channel table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart2 size={14} className="text-white/65" /> Kanaal Analytics
          </h2>
          <button
            onClick={syncAll}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80 text-[11px] transition-colors disabled:opacity-50"
          >
            {syncing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Sync alle kanalen
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-white/50 text-center py-8">Laden...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left py-2 pr-4 text-white/50 font-medium">Kanaal</th>
                  <th className="text-right py-2 px-3 text-white/50 font-medium">Subscribers</th>
                  <th className="text-right py-2 px-3 text-white/50 font-medium">Total Views</th>
                  <th className="text-right py-2 px-3 text-white/50 font-medium">Vandaag</th>
                  <th className="text-right py-2 px-3 text-white/50 font-medium">7 dagen</th>
                  <th className="text-right py-2 px-3 text-white/50 font-medium">30 dagen</th>
                  <th className="text-right py-2 px-3 text-white/50 font-medium">Video's</th>
                  <th className="text-right py-2 px-3 text-white/50 font-medium">Revenue</th>
                  <th className="text-right py-2 text-white/50 font-medium">Laatste sync</th>
                </tr>
              </thead>
              <tbody>
                {channels.map(ch => {
                  const color = COLORS[ch.naam] ?? '#6366f1'
                  return (
                    <tr key={ch.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-white/70 font-medium">{ch.naam}</span>
                          {ch.oauth_status !== 'connected' && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">
                              {ch.oauth_status}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-indigo-400">{num(ch.subscriber_count ?? 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-white/50">{num(ch.view_count ?? 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-400">{num(ch.today_views ?? 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-white/65">{num(ch.weekly_views ?? 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-white/65">{num(ch.monthly_views ?? 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-white/50">{ch.video_count ?? 0}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-400">€{(ch.estimated_revenue ?? 0).toFixed(2)}</td>
                      <td className="py-2.5 text-right text-white/38 font-mono text-[10px]">{fmt(ch.last_sync)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
