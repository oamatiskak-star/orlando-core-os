'use client'

import { useState, useEffect } from 'react'
import { GitBranch, Activity, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import SortableSection from '@/components/mobile/SortableSection'
import StatusPill from '@/components/mobile/StatusPill'

type SectionId = 'stats' | 'workflows' | 'runs'

const SECTION_LABELS: Record<SectionId, string> = {
  stats:     'Overzicht',
  workflows: 'Workflows',
  runs:      'Recente runs',
}

const DEFAULT_ORDER: SectionId[] = ['stats', 'workflows', 'runs']
const LS_ORDER     = 'wf-section-order'
const LS_COLLAPSED = 'wf-section-collapsed'

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'Nu'
  if (m < 60) return `${m}m geleden`
  if (m < 1440) return `${Math.floor(m / 60)}u geleden`
  return `${Math.floor(m / 1440)}d geleden`
}

function duration(start: string | null, end: string | null): string {
  if (!start) return '—'
  const ms = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

interface Workflow { id: string; naam: string; status: string; trigger_type: string | null; last_run_at: string | null }
interface Run { id: string; workflow_id: string; status: string; started_at: string | null; finished_at: string | null; error_message: string | null }

interface Data {
  workflows: Workflow[]
  runs24h: number
  failedRuns: number
  recentRuns: Run[]
}

export default function MobileWorkflowsPage() {
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
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const [wf, runs24, failedR, recent] = await Promise.all([
        supabase.from('oc_workflows').select('id,naam,status,trigger_type,last_run_at').order('status').order('naam'),
        supabase.from('oc_workflow_runs').select('id', { count: 'exact', head: true }).gte('started_at', since24h),
        supabase.from('oc_workflow_runs').select('id', { count: 'exact', head: true }).gte('started_at', since24h).eq('status', 'failed'),
        supabase.from('oc_workflow_runs').select('id,workflow_id,status,started_at,finished_at,error_message').order('started_at', { ascending: false }).limit(15),
      ])
      setData({
        workflows:  (wf.data ?? []) as Workflow[],
        runs24h:    runs24.count   ?? 0,
        failedRuns: failedR.count  ?? 0,
        recentRuns: (recent.data   ?? []) as Run[],
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

  const wfMap = Object.fromEntries((data?.workflows ?? []).map(w => [w.id, w.naam]))
  const activeWf      = (data?.workflows ?? []).filter(w => w.status === 'actief').length
  const successRuns   = (data?.runs24h ?? 0) - (data?.failedRuns ?? 0)

  const visibleOrder = order.filter(id => {
    if (id === 'workflows' && (data?.workflows ?? []).length === 0) return false
    if (id === 'runs'      && (data?.recentRuns ?? []).length === 0) return false
    return true
  })

  return (
    <div className="max-w-lg mx-auto px-4 py-5 space-y-6"
      style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <GitBranch size={16} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Workflow Engine</h1>
            <p className="text-[11px] text-white/40">Automatisering & jobs</p>
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
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Actieve workflows', val: activeWf,            icon: Activity,    color: 'text-emerald-400' },
                { label: 'Runs (24u)',         val: data?.runs24h ?? 0,  icon: Clock,       color: 'text-sky-400' },
                { label: 'Geslaagd',           val: successRuns,         icon: CheckCircle, color: 'text-indigo-400' },
                { label: 'Mislukt (24u)',       val: data?.failedRuns ?? 0, icon: XCircle,  color: (data?.failedRuns ?? 0) > 0 ? 'text-red-400' : 'text-white/30' },
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

          {id === 'workflows' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {(data?.workflows ?? []).map(wf => (
                <div key={wf.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${wf.status === 'actief' ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/75 font-medium truncate">{wf.naam}</p>
                    <p className="text-[10px] text-white/35 truncate">
                      {wf.trigger_type ?? '—'}
                      {wf.last_run_at ? ` · ${timeAgo(wf.last_run_at)}` : ''}
                    </p>
                  </div>
                  <StatusPill status={wf.status === 'actief' ? 'online' : 'offline'} size="xs" />
                </div>
              ))}
            </div>
          )}

          {id === 'runs' && (
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
              {(data?.recentRuns ?? []).map(run => (
                <div key={run.id} className="flex items-center gap-3 px-4 py-3">
                  {run.status === 'success' ? (
                    <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                  ) : run.status === 'failed' ? (
                    <XCircle size={13} className="text-red-400 flex-shrink-0" />
                  ) : (
                    <Clock size={13} className="text-sky-400 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/70 font-medium truncate">
                      {wfMap[run.workflow_id] ?? run.workflow_id ?? 'Onbekend'}
                    </p>
                    {run.error_message && (
                      <p className="text-[10px] text-red-400/70 truncate">{run.error_message}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-white/35">{timeAgo(run.started_at)}</p>
                    <p className="text-[10px] text-white/25">{duration(run.started_at, run.finished_at)}</p>
                  </div>
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
