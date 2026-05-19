'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Users, X, Cpu, GitFork, Shield, Wrench, Clock, Archive,
  Building, Wallet, FileText, Receipt, Video, MessageCircle,
  Scale, Search, TrendingUp, Activity, Layers, Crown, UserCheck, Eye,
  LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'

type Persona = {
  id: string
  name: string
  persona_type: 'core' | 'business' | 'specialist' | 'human'
  role: string
  authority: 'root' | 'supervisor' | 'operator' | 'observer'
  description: string | null
  icon: string | null
  capabilities: string[]
  status: 'available' | 'busy' | 'offline' | 'disabled'
}

type ActiveTask = {
  id: string
  titel: string
  status: string
  priority: string
  due_date: string | null
  project: { id: string; name: string } | null
}

const ICON_MAP: Record<string, LucideIcon> = {
  Cpu, GitFork, Shield, Wrench, Clock, Archive,
  Building, Wallet, FileText, Receipt, Video, MessageCircle,
  Scale, Search, TrendingUp, Activity, Layers, Crown, UserCheck, Eye,
}

const TYPE_LABELS: Record<Persona['persona_type'], string> = {
  core: 'Core',
  business: 'Business',
  specialist: 'Specialist',
  human: 'Human',
}

const TYPE_COLORS: Record<Persona['persona_type'], string> = {
  core:       'bg-indigo-500/10 border-indigo-500/20 text-indigo-300',
  business:   'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  specialist: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  human:      'bg-rose-500/10 border-rose-500/20 text-rose-300',
}

const AUTHORITY_COLORS: Record<Persona['authority'], string> = {
  root:       'bg-red-500/10 text-red-400',
  supervisor: 'bg-orange-500/10 text-orange-400',
  operator:   'bg-blue-500/10 text-blue-400',
  observer:   'bg-white/[0.08] text-white/65',
}

const STATUS_COLORS: Record<Persona['status'], string> = {
  available: 'bg-green-500/10 text-green-400',
  busy:      'bg-amber-500/10 text-amber-400',
  offline:   'bg-white/[0.08] text-white/50',
  disabled:  'bg-red-500/10 text-red-400',
}

export default function AgentIdentityPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [activeType, setActiveType] = useState<'Alle' | Persona['persona_type']>('Alle')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Persona | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<ActiveTask[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/agents/personas')
      if (res.ok) {
        const j = await res.json()
        setPersonas(j.personas ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function openDetail(persona: Persona) {
    setSelected(persona)
    setSelectedTasks([])
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/agents/personas/${encodeURIComponent(persona.name)}`)
      if (res.ok) {
        const j = await res.json()
        setSelectedTasks((j.tasks ?? []) as ActiveTask[])
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const filtered = activeType === 'Alle'
    ? personas
    : personas.filter(p => p.persona_type === activeType)

  const counts = {
    core:       personas.filter(p => p.persona_type === 'core').length,
    business:   personas.filter(p => p.persona_type === 'business').length,
    specialist: personas.filter(p => p.persona_type === 'specialist').length,
    human:      personas.filter(p => p.persona_type === 'human').length,
  }

  const tabs: Array<{ key: 'Alle' | Persona['persona_type']; label: string; count: number }> = [
    { key: 'Alle',       label: 'Alle',       count: personas.length },
    { key: 'core',       label: 'Core',       count: counts.core },
    { key: 'business',   label: 'Business',   count: counts.business },
    { key: 'specialist', label: 'Specialist', count: counts.specialist },
    { key: 'human',      label: 'Human',      count: counts.human },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Users size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Agent Identity</h1>
          <p className="text-xs text-white/50">Persona&apos;s als leesbare laag bovenop alle workflow-agents.</p>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1 bg-white/[0.06] border border-white/5 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveType(tab.key)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
              activeType === tab.key
                ? 'bg-indigo-600 text-white'
                : 'text-white/65 hover:text-white/70'
            )}
          >
            {tab.label}
            <span className={clsx(
              'text-[10px] px-1.5 rounded',
              activeType === tab.key ? 'bg-white/20' : 'bg-white/[0.06]',
            )}>{tab.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-xs text-white/40">Geen personas in deze categorie.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((p) => {
            const Icon = (p.icon && ICON_MAP[p.icon]) || Users
            return (
              <button
                key={p.id}
                onClick={() => openDetail(p)}
                className={clsx(
                  'text-left rounded-xl border p-4 transition-colors',
                  TYPE_COLORS[p.persona_type],
                  'hover:scale-[1.01] hover:brightness-110',
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.08] border border-white/10 flex items-center justify-center">
                    <Icon size={18} />
                  </div>
                  <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', AUTHORITY_COLORS[p.authority])}>
                    {p.authority}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-0.5">{p.name}</h3>
                <p className="text-[11px] text-white/60 mb-3">{p.role}</p>
                <div className="flex items-center justify-between">
                  <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[p.status])}>
                    {p.status}
                  </span>
                  <span className="text-[10px] text-white/40">{TYPE_LABELS[p.persona_type]}</span>
                </div>
                {p.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-white/5">
                    {p.capabilities.slice(0, 4).map((c) => (
                      <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.05] text-white/60">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-white/5">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = (selected.icon && ICON_MAP[selected.icon]) || Users
                  return (
                    <div className={clsx(
                      'w-10 h-10 rounded-lg border flex items-center justify-center',
                      TYPE_COLORS[selected.persona_type],
                    )}>
                      <Icon size={18} />
                    </div>
                  )
                })()}
                <div>
                  <h2 className="text-sm font-semibold text-white">{selected.name}</h2>
                  <p className="text-[11px] text-white/50">{selected.role}</p>
                </div>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', AUTHORITY_COLORS[selected.authority])}>
                  {selected.authority}
                </span>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[selected.status])}>
                  {selected.status}
                </span>
              </div>
              <button onClick={() => setSelected(null)}><X size={16} className="text-white/50 hover:text-white" /></button>
            </div>

            <div className="p-5 space-y-5">
              {selected.description && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Beschrijving</p>
                  <p className="text-xs text-white/80">{selected.description}</p>
                </div>
              )}

              {selected.capabilities.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Capabilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.capabilities.map((c) => (
                      <span key={c} className="text-[11px] px-2 py-1 rounded bg-white/[0.06] border border-white/10 text-white/75">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Actieve taken</p>
                {detailLoading ? (
                  <p className="text-xs text-white/40">Laden…</p>
                ) : selectedTasks.length === 0 ? (
                  <p className="text-xs text-white/40 italic">Geen taken toegewezen aan {selected.name}.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {selectedTasks.map((t) => (
                      <li key={t.id} className="flex items-center justify-between bg-white/[0.04] border border-white/5 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 text-xs">
                          <span className={clsx(
                            'px-1.5 py-0.5 rounded text-[10px]',
                            t.priority === 'urgent' ? 'bg-red-500/10 text-red-400' :
                            t.priority === 'hoog'   ? 'bg-orange-500/10 text-orange-400' :
                                                      'bg-white/[0.08] text-white/60',
                          )}>{t.priority}</span>
                          <span className="text-white/80">{t.titel}</span>
                          {t.project && <span className="text-white/40">— {t.project.name}</span>}
                        </div>
                        <span className="text-[10px] text-white/40">{t.status}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
