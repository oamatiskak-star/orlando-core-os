'use client'

import { useEffect, useState } from 'react'
import { Eye, RefreshCw, Mail } from 'lucide-react'
import { MailDetail } from './_components/MailDetail'
import { ComposePanel } from './_components/ComposePanel'
import { MemorySidebar } from './_components/MemorySidebar'
import type { MailDefenseItem } from '@/lib/advocaat/types'

// ─── Classification config ─────────────────────────────────────────────────

const CLASS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  curator_bericht:    { label: 'Curator',           color: 'text-red-400',    bg: 'bg-red-500/8 border-red-500/25' },
  dagvaarding:        { label: 'Dagvaarding',       color: 'text-red-400',    bg: 'bg-red-500/8 border-red-500/25' },
  ingebrekestelling:  { label: 'Ingebrekestelling', color: 'text-orange-400', bg: 'bg-orange-500/8 border-orange-500/25' },
  vonnis:             { label: 'Vonnis',            color: 'text-red-400',    bg: 'bg-red-500/8 border-red-500/25' },
  incasso:            { label: 'Incasso',           color: 'text-yellow-400', bg: 'bg-yellow-500/8 border-white/[0.06]' },
  juridisch_neutraal: { label: 'Juridisch',         color: 'text-blue-400',   bg: 'bg-blue-500/5 border-blue-500/15' },
  neutraal:           { label: 'Neutraal',          color: 'text-white/40',   bg: 'bg-white/[0.03] border-white/[0.07]' },
}

const URGENCY_COLOR: Record<string, string> = {
  kritiek: 'text-red-400 bg-red-500/10 border-red-500/30',
  hoog:    'text-orange-400 bg-orange-500/10 border-orange-500/25',
  medium:  'text-yellow-400 bg-yellow-500/8 border-white/[0.06]',
  laag:    'text-white/40 bg-white/[0.04] border-white/[0.08]',
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function MailDefensePage() {
  const [items,         setItems]         = useState<MailDefenseItem[]>([])
  const [selected,      setSelected]      = useState<MailDefenseItem | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [mode,          setMode]          = useState<'detail' | 'compose'>('detail')
  const [filterUrgency, setFilterUrgency] = useState('')
  const [filterAction,  setFilterAction]  = useState(false)
  const [dossiers,      setDossiers]      = useState<{ id: string; title: string }[]>([])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filterUrgency) params.set('urgency', filterUrgency)
      if (filterAction)  params.set('action_required', 'true')
      const res = await fetch(`/api/advocaat/mail-defense?${params}`).then(r => r.json())
      setItems(res.items ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  async function loadDossiers() {
    try {
      const res = await fetch('/api/advocaat/dossiers?limit=50').then(r => r.json())
      const list = (res.items ?? res.dossiers ?? []) as { id: string; title: string }[]
      setDossiers(list.map(d => ({ id: d.id, title: d.title })))
    } catch {
      setDossiers([])
    }
  }

  useEffect(() => {
    load()
    loadDossiers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterUrgency, filterAction])

  // ── Derived stats ──────────────────────────────────────────────────────
  const stats = {
    total:   items.length,
    kritiek: items.filter(i => i.urgency === 'kritiek').length,
    action:  items.filter(i => i.action_required && !i.processed).length,
    curator: items.filter(i => i.classification === 'curator_bericht').length,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20">
            <Eye className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Mail Defense Agent</h1>
            <p className="text-xs text-white/40 mt-0.5">
              Juridische mail-analyse · Deadline detectie · Nooit automatisch verzenden
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MemorySidebar defaultDossierId={selected?.dossier_id ?? undefined} />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-[10px] text-red-400 font-medium tracking-wide">NEVER AUTO-SEND</span>
          </div>
          <button
            onClick={load}
            className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-[10px] text-white/40 mt-0.5">Gescand</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{stats.kritiek}</div>
          <div className="text-[10px] text-white/40 mt-0.5">Kritiek</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-400">{stats.action}</div>
          <div className="text-[10px] text-white/40 mt-0.5">Actie vereist</div>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
          <div className="text-2xl font-bold text-red-400">{stats.curator}</div>
          <div className="text-[10px] text-white/40 mt-0.5">Curator mail</div>
        </div>
      </div>

      {/* ── 3-panel layout ── */}
      <div className="grid grid-cols-3 gap-4 items-start">

        {/* ── Left col: mail list (1/3) ── */}
        <div className="col-span-1 bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">

          {/* List header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white">{items.length} gescande mails</span>
            <button
              onClick={load}
              className="p-1 rounded-md hover:bg-white/[0.05] transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-white/30 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Filter row */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/[0.05]">
            <select
              value={filterUrgency}
              onChange={e => setFilterUrgency(e.target.value)}
              className="flex-1 px-2 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white focus:outline-none focus:border-orange-500/40"
            >
              <option value="">Alle urgentie</option>
              <option value="kritiek">Kritiek</option>
              <option value="hoog">Hoog</option>
              <option value="medium">Medium</option>
              <option value="laag">Laag</option>
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={filterAction}
                onChange={e => setFilterAction(e.target.checked)}
                className="accent-orange-500"
              />
              <span className="text-[10px] text-white/50 whitespace-nowrap">Alleen actie vereist</span>
            </label>
          </div>

          {/* Mail list */}
          {loading ? (
            <div className="p-8 text-center text-white/30 text-sm">Laden...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center">
              <Mail className="w-8 h-8 mx-auto mb-2 text-white/10" />
              <p className="text-xs text-white/20">Geen gescande mails gevonden.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[700px] overflow-y-auto">
              {items.map(item => {
                const cc = CLASS_CONFIG[item.classification] ?? CLASS_CONFIG.neutraal
                const dl = daysUntil(item.deadline_detected)
                const isSelected = selected?.id === item.id

                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelected(item); setMode('detail') }}
                    className={[
                      'w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-all',
                      isSelected
                        ? 'bg-orange-500/5 border-l-2 border-l-orange-500'
                        : 'border-l-2 border-l-transparent',
                    ].join(' ')}
                  >
                    {/* Subject + urgency badge */}
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-white/25 shrink-0" />
                      <span className="text-sm text-white truncate flex-1 min-w-0">
                        {item.subject ?? '(Geen onderwerp)'}
                      </span>
                      <span
                        className={[
                          'text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0',
                          URGENCY_COLOR[item.urgency] ?? URGENCY_COLOR.laag,
                        ].join(' ')}
                      >
                        {(item.urgency ?? 'laag').toUpperCase()}
                      </span>
                    </div>

                    {/* Classification + from + date */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-medium ${cc.color}`}>{cc.label}</span>
                      {item.from_name && (
                        <span className="text-[10px] text-white/30 truncate">{item.from_name}</span>
                      )}
                      <span className="text-[10px] text-white/20 ml-auto shrink-0">{fmt(item.received_at)}</span>
                    </div>

                    {/* Action required indicator */}
                    {item.action_required && !item.processed && (
                      <div className="text-[9px] text-orange-400 mt-0.5 font-medium">⚡ Actie vereist</div>
                    )}

                    {/* Deadline warning */}
                    {dl !== null && dl <= 14 && (
                      <div className={`text-[9px] mt-0.5 font-medium ${dl <= 3 ? 'text-red-400' : 'text-orange-400'}`}>
                        ⚠ Deadline over {dl} dag{dl !== 1 ? 'en' : ''}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Right col: detail / compose (2/3) ── */}
        <div className="col-span-2">
          {!selected ? (
            <div className="flex items-center justify-center min-h-[400px] bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <div className="text-center">
                <Mail className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p className="text-sm text-white/20">Selecteer een mail</p>
              </div>
            </div>
          ) : mode === 'detail' ? (
            <MailDetail
              item={selected}
              onCompose={() => setMode('compose')}
              onRefresh={load}
            />
          ) : (
            <ComposePanel
              item={selected}
              dossiers={dossiers}
              onBack={() => setMode('detail')}
              onSaved={(updated) => {
                setSelected(updated)
                setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
              }}
            />
          )}
        </div>

      </div>
    </div>
  )
}
