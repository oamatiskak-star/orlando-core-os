'use client'

import { useState } from 'react'
import { CheckCircle2, Zap, Circle, AlertTriangle, Clock } from 'lucide-react'

interface Module {
  id: string
  fase_nr: number
  module_key: string
  naam: string
  omschrijving: string | null
  status: 'pending' | 'building' | 'live' | 'blocked'
  route: string | null
  gebouwd_door: string | null
  live_at: string | null
}

const STATUS_CYCLE: Record<string, string> = {
  pending:  'building',
  building: 'live',
  live:     'live',
  blocked:  'building',
}

const STATUS_STYLE: Record<string, string> = {
  live:     'bg-emerald-500/10 border-emerald-500/25 text-emerald-400',
  building: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
  pending:  'bg-white/5 border-white/10 text-white/35',
  blocked:  'bg-red-500/10 border-red-500/25 text-red-400',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  live:     <CheckCircle2 size={11} />,
  building: <Zap size={11} className="animate-pulse" />,
  pending:  <Circle size={11} />,
  blocked:  <AlertTriangle size={11} />,
}

const STATUS_LABEL: Record<string, string> = {
  live:     'Live',
  building: 'Bouwen',
  pending:  'Gepland',
  blocked:  'Geblokkeerd',
}

export default function ModuleStatusGrid({ initialModules }: { initialModules: Module[] }) {
  const [modules, setModules] = useState<Module[]>(initialModules)
  const [updating, setUpdating] = useState<string | null>(null)

  const cycleStatus = async (mod: Module) => {
    if (mod.status === 'live') return
    const newStatus = STATUS_CYCLE[mod.status]
    setUpdating(mod.module_key)

    const res = await fetch(`/api/media-holding/modules/${mod.module_key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })

    if (res.ok) {
      setModules(prev => prev.map(m =>
        m.module_key === mod.module_key
          ? { ...m, status: newStatus as Module['status'], live_at: newStatus === 'live' ? new Date().toISOString() : m.live_at }
          : m
      ))
    }
    setUpdating(null)
  }

  // Group by fase
  const byFase = modules.reduce<Record<number, Module[]>>((acc, m) => {
    if (!acc[m.fase_nr]) acc[m.fase_nr] = []
    acc[m.fase_nr].push(m)
    return acc
  }, {})

  const FASE_NAMES: Record<number, string> = {
    1: 'Cashflow First',
    2: 'Media Division Structuur',
    3: 'Dashboard & UX',
    4: 'AI System Behavior',
    5: 'Infrastructure Rules',
    6: 'Long Term Scale',
  }

  return (
    <div className="space-y-6">
      {Object.entries(byFase).map(([faseNr, mods]) => {
        const live = mods.filter(m => m.status === 'live').length
        return (
          <div key={faseNr}>
            <div className="flex items-center gap-3 mb-3">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">
                Fase {faseNr} — {FASE_NAMES[Number(faseNr)]}
              </p>
              <span className="text-[10px] text-white/35">{live}/{mods.length} live</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {mods.map(mod => (
                <button
                  key={mod.module_key}
                  onClick={() => cycleStatus(mod)}
                  disabled={mod.status === 'live' || updating === mod.module_key}
                  className={`text-left p-3.5 rounded-xl border transition-all ${STATUS_STYLE[mod.status]} ${mod.status !== 'live' ? 'hover:brightness-110 cursor-pointer' : 'cursor-default'} disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
                      {updating === mod.module_key ? <Clock size={11} className="animate-spin" /> : STATUS_ICON[mod.status]}
                      {STATUS_LABEL[mod.status]}
                    </span>
                    {mod.gebouwd_door && (
                      <span className="text-[9px] text-white/25 uppercase">{mod.gebouwd_door}</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white">{mod.naam}</p>
                  {mod.omschrijving && (
                    <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{mod.omschrijving}</p>
                  )}
                  {mod.live_at && (
                    <p className="text-[10px] text-white/25 mt-1.5">
                      {new Date(mod.live_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                  {mod.status !== 'live' && (
                    <p className="text-[10px] text-white/25 mt-1.5">Klik om naar volgende status</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
