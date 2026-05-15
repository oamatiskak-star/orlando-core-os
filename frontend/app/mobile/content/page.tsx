'use client'

import { useState, useEffect } from 'react'
import { Zap, FileVideo, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import SortableSection from '@/components/mobile/SortableSection'

type SectionId = 'stats' | 'progress' | 'recent'

const SECTION_LABELS: Record<SectionId, string> = {
  stats:    'Overzicht',
  progress: 'Voortgang',
  recent:   'Recente media',
}

const DEFAULT_ORDER: SectionId[] = ['stats', 'progress', 'recent']
const LS_ORDER     = 'ct-section-order'
const LS_COLLAPSED = 'ct-section-collapsed'

const RENDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Wachtrij',  color: 'text-white/40' },
  rendering: { label: 'Renderen',  color: 'text-indigo-400' },
  completed: { label: 'Klaar',     color: 'text-emerald-400' },
  failed:    { label: 'Mislukt',   color: 'text-red-400' },
  uploading: { label: 'Uploaden',  color: 'text-sky-400' },
  uploaded:  { label: 'Geüpload', color: 'text-emerald-400' },
}

function fmt(n: number): string {
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

interface MediaItem {
  id: string
  title: string | null
  channel_name: string | null
  render_status: string
  created_at: string | null
  duration_seconds: number | null
}

interface Data {
  total: number
  completed: number
  rendering: number
  failed: number
  recent: MediaItem[]
}

export default function MobileContentPage() {
  const [data, setData]           = useState<Data | null>(null)
  const [order, setOrder]         = useState<SectionId[]>(DEFAULT_ORDER)
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(new Set())
  const [editing, setEditing]     = useState(false)

  useEffect(() => {
    try {
      const o = localStorage.getItem(LS_ORDER)
      if (o) setOrder(JSON.parse(o))
      const c = localStorage.getItem(LS_COLLAPSED)
      if (c) setCollapsed(new Set(JSON.parse(c)))
    } catch {}

    async function load() {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const [total, completed, rendering, failed, recent] = await Promise.all([
        supabase.from('generated_media').select('id', { count: 'exact', head: true }),
        supabase.from('generated_media').select('id', { count: 'exact', head: true }).in('render_status', ['completed','uploaded']),
        supabase.from('generated_media').select('id', { count: 'exact', head: true }).in('render_status', ['rendering','uploading']),
        supabase.from('generated_media').select('id', { count: 'exact', head: true }).eq('render_status', 'failed'),
        supabase.from('generated_media').select('id,title,channel_name,render_status,created_at,duration_seconds').order('created_at', { ascending: false }).limit(15),
      ])
      setData({
        total:     total.count     ?? 0,
        completed: completed.count ?? 0,
        rendering: rendering.count ?? 0,
        failed:    failed.count    ?? 0,
        recent:    (recent.data    ?? []) as MediaItem[],
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

  const total     = data?.total     ?? 0
  const completed = data?.completed ?? 0
  const rendering = data?.rendering ?? 0
  const failed    = data?.failed    ?? 0

  const visibleOrder = order.filter(id => {
    if (id === 'progress' && total === 0) return false
    if (id === 'recent'   && (data?.recent ?? []).length === 0) return false
    return true
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
            <Zap size={16} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Content Productie</h1>
            <p className="text-[11px] text-white/40">AI-gegenereerde media assets</p>
          </div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${editing ? 'bg-indigo-600/80 border-indigo-500/50 text-white' : 'bg-white/[0.04] border-white/[0.08] text-white/40'}`}
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
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Totaal',   val: fmt(total),     icon: FileVideo,   color: 'text-white/65' },
                { label: 'Klaar',    val: fmt(completed), icon: CheckCircle, color: 'text-emerald-400' },
                { label: 'Renderen', val: fmt(rendering), icon: Loader2,     color: rendering > 0 ? 'text-indigo-400' : 'text-white/30' },
                { label: 'Mislukt',  val: fmt(failed),    icon: AlertCircle, color: failed > 0    ? 'text-red-400'    : 'text-white/30' },
              ].map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
                    <Icon size={14} className={`${s.color} mb-2`} />
                    <p className={`text-xl font-bold ${s.color}`}>{data ? s.val : '—'}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
                  </div>
                )
              })}
            </div>
          )}

          {id === 'progress' && total > 0 && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-white/50">Voltooiingsgraad</span>
                <span className="text-[11px] text-white/70 font-medium">{Math.round((completed / total) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.round((completed / total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {id === 'recent' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {(data?.recent ?? []).map(item => {
                const rs = RENDER_STATUS[item.render_status] ?? { label: item.render_status ?? '—', color: 'text-white/40' }
                const dur = item.duration_seconds
                  ? `${Math.floor(item.duration_seconds / 60)}:${String(item.duration_seconds % 60).padStart(2, '0')}`
                  : null
                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <FileVideo size={13} className="text-violet-400/70" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/75 font-medium truncate">{item.title ?? 'Geen titel'}</p>
                      <p className="text-[10px] text-white/35 truncate">
                        {item.channel_name ?? '—'}{dur ? ` · ${dur}` : ''} · {timeAgo(item.created_at)}
                      </p>
                    </div>
                    <span className={`text-[10px] font-medium ${rs.color} shrink-0 mt-0.5`}>{rs.label}</span>
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
