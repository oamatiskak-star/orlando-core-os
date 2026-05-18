'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, Clock, ChevronDown, ChevronRight, Target } from 'lucide-react'

type OsilSession = {
  id: string
  session_type: string
  title: string
  status: string
  priority: string
  context_snapshot: Record<string, unknown>
  ai_analysis: string
  ai_recommendations: Array<{ priority: string; action: string; category: string }>
  created_at: string
  completed_at: string | null
}

const PRIO_COLORS: Record<string, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/20',
  hoog:    'text-amber-400 bg-amber-500/10 border-amber-500/20',
  normaal: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  laag:    'text-white/45 bg-white/5 border-white/10',
}

function fmt(n: unknown) {
  if (typeof n !== 'number' || n === 0) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function SessionCard({ session }: { session: OsilSession }) {
  const [expanded, setExpanded] = useState(false)
  const snap = session.context_snapshot

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
          <Brain size={14} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-white truncate">{session.title}</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${PRIO_COLORS[session.priority] ?? PRIO_COLORS.normaal}`}>
              {session.priority}
            </span>
          </div>
          <p className="text-[10px] text-white/45 mt-0.5">
            {new Date(session.created_at).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>
        {expanded ? <ChevronDown size={14} className="text-white/38 flex-shrink-0" /> : <ChevronRight size={14} className="text-white/38 flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="border-t border-white/5 p-4 space-y-4">
          {/* Snapshot KPIs */}
          <div>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">Context bij aanvang</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Open AR', value: fmt(snap.ar_open) },
                { label: 'Vervallen AR', value: fmt(snap.ar_overdue) },
                { label: 'Incasso', value: fmt(snap.ar_incasso) },
                { label: 'Projecten', value: String(snap.active_projects ?? '—') },
                { label: 'CFO Alerts', value: String(snap.active_cfo_alerts ?? '—') },
                { label: 'Modus', value: snap.survival_mode ? 'SURVIVAL' : snap.growth_mode ? 'GROEI' : 'BALANS' },
              ].map(k => (
                <div key={k.label} className="bg-white/[0.04] rounded-lg p-2 text-center">
                  <p className="text-[9px] text-white/38">{k.label}</p>
                  <p className="text-xs font-medium text-white/70 mt-0.5">{k.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis */}
          <div>
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">AI Analyse</p>
            <div className="bg-white/[0.03] rounded-lg p-3 space-y-1 max-h-64 overflow-y-auto">
              {session.ai_analysis.split('\n').filter(l => l.trim()).map((line, i) => (
                <p key={i} className={`text-xs leading-relaxed ${
                  line.match(/^\d\./) ? 'text-white/80 font-medium mt-1' :
                  line.startsWith('-') ? 'text-white/60 pl-2' :
                  'text-white/50'
                }`}>{line}</p>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          {session.ai_recommendations?.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">
                <Target size={10} className="inline mr-1" />
                Aanbevolen Acties
              </p>
              <div className="space-y-1.5">
                {session.ai_recommendations.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                      r.priority === 'kritiek' ? 'text-red-400 bg-red-500/10' :
                      r.priority === 'hoog' ? 'text-amber-400 bg-amber-500/10' :
                      'text-indigo-400 bg-indigo-500/10'
                    }`}>{r.priority}</span>
                    <span className="text-white/65">{r.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BoardPage() {
  const [sessions, setSessions] = useState<OsilSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/osil/analyze', { cache: 'no-store' })
      if (res.ok) {
        const d = await res.json()
        setSessions(d.sessions ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Board Sessies</h1>
          <p className="text-xs text-white/50 mt-0.5">Strategische AI board analyses en besluiten</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/45">
          <Clock size={11} />
          {sessions.length} sessies
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-xs text-white/40">Laden...</div>
      ) : sessions.length === 0 ? (
        <div className="py-16 text-center space-y-2">
          <Brain size={28} className="text-violet-400/30 mx-auto" />
          <p className="text-sm text-white/40">Nog geen board sessies</p>
          <p className="text-xs text-white/25">Start een analyse via het OSIL dashboard</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => <SessionCard key={s.id} session={s} />)}
        </div>
      )}
    </div>
  )
}
