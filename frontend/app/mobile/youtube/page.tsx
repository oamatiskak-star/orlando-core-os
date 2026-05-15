'use client'

import { useState, useEffect } from 'react'
import { Play, Users, Eye, Video, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import SortableSection from '@/components/mobile/SortableSection'

type SectionId = 'stats' | 'queue' | 'channels' | 'recent'

const SECTION_LABELS: Record<SectionId, string> = {
  stats:    'Overzicht',
  queue:    'Queue Status',
  channels: 'Kanalen',
  recent:   'Recente uploads',
}

const DEFAULT_ORDER: SectionId[] = ['stats', 'queue', 'channels', 'recent']
const LS_ORDER     = 'yt-section-order'
const LS_COLLAPSED = 'yt-section-collapsed'

const STATUS_META: Record<string, { label: string; color: string }> = {
  queued:                      { label: 'In wachtrij',  color: 'text-sky-400' },
  preparing:                   { label: 'Voorbereiden', color: 'text-sky-400' },
  normalizing:                 { label: 'Normaliseren', color: 'text-sky-400' },
  uploading:                   { label: 'Uploaden',     color: 'text-indigo-400' },
  uploaded_pending_processing: { label: 'Verwerking',   color: 'text-indigo-400' },
  processing:                  { label: 'Verwerking',   color: 'text-indigo-400' },
  verifying:                   { label: 'Verificatie',  color: 'text-violet-400' },
  verified_live:               { label: 'Live',         color: 'text-emerald-400' },
  failed:                      { label: 'Mislukt',      color: 'text-red-400' },
  retrying:                    { label: 'Herpoging',    color: 'text-amber-400' },
  manual_review_required:      { label: 'Review nodig', color: 'text-amber-400' },
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

interface Channel { id: string; naam: string; subscriber_count: number | null; view_count: number | null; video_count: number | null; oauth_connected: boolean }
interface QueueItem { id: string; title: string | null; channel_name: string | null; status: string; updated_at: string | null }

interface Data {
  channels: Channel[]
  active: number
  failed: number
  live: number
  recent: QueueItem[]
}

export default function MobileYouTubePage() {
  const [data, setData]         = useState<Data | null>(null)
  const [order, setOrder]       = useState<SectionId[]>(DEFAULT_ORDER)
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(new Set())
  const [editing, setEditing]   = useState(false)

  useEffect(() => {
    // Load preferences
    try {
      const o = localStorage.getItem(LS_ORDER)
      if (o) setOrder(JSON.parse(o))
      const c = localStorage.getItem(LS_COLLAPSED)
      if (c) setCollapsed(new Set(JSON.parse(c)))
    } catch {}

    // Fetch data
    async function load() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const [ch, active, failed, live, recent] = await Promise.all([
        supabase.from('youtube_channels').select('id,naam,subscriber_count,view_count,video_count,oauth_connected').order('subscriber_count', { ascending: false }),
        supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true }).in('status', ['queued','preparing','normalizing','uploading','uploaded_pending_processing','processing','verifying','retrying']),
        supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true }).in('status', ['failed','manual_review_required']),
        supabase.from('youtube_upload_queue').select('id', { count: 'exact', head: true }).eq('status', 'verified_live'),
        supabase.from('youtube_upload_queue').select('id,title,channel_name,status,updated_at').order('updated_at', { ascending: false }).limit(10),
      ])
      setData({
        channels: (ch.data ?? []) as Channel[],
        active:   active.count ?? 0,
        failed:   failed.count ?? 0,
        live:     live.count   ?? 0,
        recent:   (recent.data ?? []) as QueueItem[],
      })
    }
    load()
  }, [])

  function saveOrder(next: SectionId[]) {
    setOrder(next)
    try { localStorage.setItem(LS_ORDER, JSON.stringify(next)) } catch {}
  }
  function toggleCollapse(id: SectionId) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem(LS_COLLAPSED, JSON.stringify([...next])) } catch {}
      return next
    })
  }
  function moveUp(id: SectionId) {
    const idx = order.indexOf(id)
    if (idx <= 0) return
    const next = [...order]; [next[idx-1], next[idx]] = [next[idx], next[idx-1]]
    saveOrder(next)
  }
  function moveDown(id: SectionId) {
    const idx = order.indexOf(id)
    if (idx >= order.length - 1) return
    const next = [...order]; [next[idx], next[idx+1]] = [next[idx+1], next[idx]]
    saveOrder(next)
  }

  const channels  = data?.channels ?? []
  const totalSubs  = channels.reduce((s, c) => s + (c.subscriber_count ?? 0), 0)
  const totalViews = channels.reduce((s, c) => s + (c.view_count ?? 0), 0)
  const totalVids  = channels.reduce((s, c) => s + (c.video_count ?? 0), 0)

  const visibleOrder = order.filter(id => {
    if (id === 'channels' && channels.length === 0) return false
    if (id === 'recent'   && (data?.recent ?? []).length === 0) return false
    return true
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <Play size={16} className="text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">YouTube Engine</h1>
            <p className="text-[11px] text-white/40">Upload pipeline & kanalen</p>
          </div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className={`px-4 min-h-[44px] rounded-xl text-[11px] font-medium border transition-colors ${editing ? 'bg-indigo-600/80 border-indigo-500/50 text-white' : 'bg-white/[0.04] border-white/[0.08] text-white/40'}`}
        >
          {editing ? 'Klaar' : 'Rangschikken'}
        </button>
      </div>

      {visibleOrder.map((id, idx) => (
        <SortableSection
          key={id}
          label={SECTION_LABELS[id]}
          collapsed={collapsed.has(id)}
          editing={editing}
          isFirst={idx === 0}
          isLast={idx === visibleOrder.length - 1}
          onToggleCollapse={() => toggleCollapse(id)}
          onMoveUp={() => moveUp(id)}
          onMoveDown={() => moveDown(id)}
        >
          {id === 'stats' && (
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Abonnees', val: fmt(totalSubs),  color: 'text-indigo-400' },
                { label: 'Views',    val: fmt(totalViews), color: 'text-sky-400' },
                { label: "Video's",  val: fmt(totalVids),  color: 'text-white/65' },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                  <p className={`text-lg font-bold ${s.color}`}>{data ? s.val : '—'}</p>
                  <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {id === 'queue' && (
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: 'Actief', val: data?.active ?? 0, icon: Loader2,    color: (data?.active ?? 0) > 0 ? 'text-indigo-400' : 'text-white/30' },
                { label: 'Live',   val: data?.live   ?? 0, icon: CheckCircle, color: 'text-emerald-400' },
                { label: 'Fouten', val: data?.failed ?? 0, icon: AlertCircle, color: (data?.failed ?? 0) > 0 ? 'text-red-400' : 'text-white/30' },
              ].map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3">
                    <Icon size={14} className={`${s.color} mb-2`} />
                    <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
                  </div>
                )
              })}
            </div>
          )}

          {id === 'channels' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {channels.map(ch => (
                <div key={ch.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.oauth_connected ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white/80 font-medium truncate">{ch.naam}</p>
                    <p className="text-[10px] text-white/35">{fmt(ch.video_count ?? 0)} video&apos;s</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white/70">{fmt(ch.subscriber_count ?? 0)}</p>
                    <p className="text-[10px] text-white/30">subs</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {id === 'recent' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {(data?.recent ?? []).map(item => {
                const meta = STATUS_META[item.status] ?? { label: item.status, color: 'text-white/40' }
                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/75 font-medium truncate">{item.title ?? 'Geen titel'}</p>
                      <p className="text-[10px] text-white/35 truncate">{item.channel_name ?? '—'} · {timeAgo(item.updated_at)}</p>
                    </div>
                    <span className={`text-[10px] font-medium ${meta.color} shrink-0 mt-0.5`}>{meta.label}</span>
                  </div>
                )
              })}
            </div>
          )}
        </SortableSection>
      ))}

      {!data && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="text-white/20 animate-spin" />
        </div>
      )}
    </div>
  )
}
