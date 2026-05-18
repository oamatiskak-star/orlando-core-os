'use client'

import { useState, useEffect } from 'react'
import { Search, Home, TrendingUp, MapPin, Loader2 } from 'lucide-react'
import SortableSection from '@/components/mobile/SortableSection'

type SectionId = 'stats' | 'inbox' | 'pipeline'

const SECTION_LABELS: Record<SectionId, string> = {
  stats:    'Overzicht',
  inbox:    'Inbox',
  pipeline: 'Pipeline',
}

const DEFAULT_ORDER: SectionId[] = ['stats', 'inbox', 'pipeline']
const LS_ORDER     = 'sc-section-order'
const LS_COLLAPSED = 'sc-section-collapsed'

const CLASS_COLOR: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  B: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  C: 'text-white/50    bg-white/5        border-white/10',
}

function fmtEur(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return '€' + (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return '€' + Math.round(n / 1_000) + 'K'
  return '€' + n
}

interface Deal {
  id: string
  straat: string | null
  stad: string | null
  provincie: string | null
  vraagprijs: number | null
  class: string | null
  pipeline_fase: string | null
}

interface Data {
  total: number
  classA: number
  classB: number
  pipeline: number
  inbox: Deal[]
  active: Deal[]
}

export default function MobileScrapersPage() {
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
      const [total, classA, classB, pipeline, recent] = await Promise.all([
        supabase.from('deals').select('id', { count: 'exact', head: true }),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('class', 'A'),
        supabase.from('deals').select('id', { count: 'exact', head: true }).eq('class', 'B'),
        supabase.from('deals').select('id', { count: 'exact', head: true }).not('pipeline_fase', 'is', null).neq('pipeline_fase', 'verloren'),
        supabase.from('deals').select('id,straat,stad,provincie,vraagprijs,class,pipeline_fase').order('created_at', { ascending: false }).limit(30),
      ])
      const deals = (recent.data ?? []) as Deal[]
      setData({
        total:    total.count    ?? 0,
        classA:   classA.count   ?? 0,
        classB:   classB.count   ?? 0,
        pipeline: pipeline.count ?? 0,
        inbox:  deals.filter(d => !d.pipeline_fase),
        active: deals.filter(d => d.pipeline_fase && d.pipeline_fase !== 'verloren'),
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

  const visibleOrder = order.filter(id => {
    if (id === 'inbox'    && (data?.inbox  ?? []).length === 0) return false
    if (id === 'pipeline' && (data?.active ?? []).length === 0) return false
    return true
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center flex-shrink-0">
            <Search size={16} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Vastgoed Scraper</h1>
            <p className="text-[11px] text-white/40">AI-gedreven dealflow</p>
          </div>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className={`px-4 min-h-[44px] rounded-xl text-[11px] font-medium border transition-colors ${editing ? 'bg-indigo-600/80 border-indigo-500/50 text-white' : 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'}`}
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
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Totaal',   val: data?.total    ?? 0, color: 'text-white/65' },
                { label: 'A-deals',  val: data?.classA   ?? 0, color: 'text-emerald-400' },
                { label: 'B-deals',  val: data?.classB   ?? 0, color: 'text-amber-400' },
                { label: 'Pipeline', val: data?.pipeline ?? 0, color: 'text-violet-400' },
              ].map(s => (
                <div key={s.label} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-2.5 text-center">
                  <p className={`text-base font-bold ${s.color}`}>{data ? s.val : '—'}</p>
                  <p className="text-[9px] text-white/38 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {id === 'inbox' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {(data?.inbox ?? []).slice(0, 10).map(deal => {
                const cls = deal.class ?? 'C'
                const [tc, bg, bc] = (CLASS_COLOR[cls] ?? CLASS_COLOR.C).split(' ')
                return (
                  <div key={deal.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Home size={13} className="text-white/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-white/75 font-medium truncate">
                        {deal.straat ?? deal.stad ?? 'Onbekend adres'}
                      </p>
                      <p className="text-[10px] text-white/35 flex items-center gap-1">
                        <MapPin size={9} />
                        {deal.stad ?? '—'}{deal.provincie ? `, ${deal.provincie}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {cls && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${tc} ${bg} ${bc}`}>{cls}</span>}
                      <span className="text-[10px] text-white/40">{fmtEur(deal.vraagprijs)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {id === 'pipeline' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {(data?.active ?? []).map(deal => (
                <div key={deal.id} className="flex items-center gap-3 px-4 py-3">
                  <TrendingUp size={14} className="text-violet-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/75 font-medium truncate">
                      {deal.straat ?? deal.stad ?? 'Onbekend'}
                    </p>
                    <p className="text-[10px] text-white/35 capitalize">
                      {deal.pipeline_fase?.replace('_', ' ') ?? '—'}
                    </p>
                  </div>
                  <span className="text-[10px] text-white/40">{fmtEur(deal.vraagprijs)}</span>
                </div>
              ))}
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
