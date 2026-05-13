'use client'

import { useState } from 'react'
import { CalendarDays, X, Zap, Clock, ChevronRight, CheckCircle, Film, Scissors } from 'lucide-react'

type SummaryItem = {
  naam: string
  priority: string
  created: number
  shorts: number
  longform: number
  horizonDays: number
  perDay: number
}

const PREVIEW = [
  {
    naam: 'VermogenTv',
    priority: 'high',
    perDay: 10,
    longform: 6,
    shorts: 4,
    horizonDays: 60,
    schedule: [
      { hour: '06:00', type: 'longform' }, { hour: '08:00', type: 'longform' },
      { hour: '09:00', type: 'short' },   { hour: '11:00', type: 'longform' },
      { hour: '13:00', type: 'short' },   { hour: '15:00', type: 'longform' },
      { hour: '16:00', type: 'short' },   { hour: '18:00', type: 'longform' },
      { hour: '19:00', type: 'short' },   { hour: '21:00', type: 'longform' },
    ],
  },
  {
    naam: 'PropertyInvestorTv',
    priority: 'high',
    perDay: 10,
    longform: 6,
    shorts: 4,
    horizonDays: 60,
    schedule: [
      { hour: '07:00', type: 'longform' }, { hour: '09:00', type: 'longform' },
      { hour: '10:00', type: 'short' },   { hour: '12:00', type: 'longform' },
      { hour: '14:00', type: 'short' },   { hour: '16:00', type: 'longform' },
      { hour: '17:00', type: 'short' },   { hour: '19:00', type: 'longform' },
      { hour: '20:00', type: 'short' },   { hour: '22:00', type: 'longform' },
    ],
  },
  { naam: 'VastgoedTv',     priority: 'normal', perDay: 1, longform: 1, shorts: 0, horizonDays: 30, schedule: [{ hour: '10:00', type: 'longform' }] },
  { naam: 'SpaarTv',        priority: 'normal', perDay: 1, longform: 1, shorts: 0, horizonDays: 30, schedule: [{ hour: '11:00', type: 'longform' }] },
  { naam: 'CryptoVermogen', priority: 'normal', perDay: 1, longform: 1, shorts: 0, horizonDays: 30, schedule: [{ hour: '12:00', type: 'longform' }] },
  { naam: 'BeleggingsTv',   priority: 'normal', perDay: 1, longform: 1, shorts: 0, horizonDays: 30, schedule: [{ hour: '14:00', type: 'longform' }] },
] as const

const TOTAL_SLOTS = PREVIEW.reduce((s, c) => s + c.perDay * c.horizonDays, 0)

export default function PlanningButton() {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ created: number; summary: SummaryItem[]; message?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setOpen(true)
    setResult(null)
    setError(null)
    setExpanded(null)
  }

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/youtube/planning/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Onbekende fout'); return }
      setResult(data)
    } catch {
      setError('Netwerk fout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg text-xs text-violet-400 hover:bg-violet-500/20 transition-all"
      >
        <CalendarDays size={12} />
        Maak Planning
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0f0f14] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between p-5 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <CalendarDays size={15} className="text-violet-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Upload Planning Genereren</h2>
                  <p className="text-[11px] text-white/50">Automatische slots voor alle 6 kanalen · max {TOTAL_SLOTS} slots</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3 overflow-y-auto flex-1">
              {!result ? (
                <>
                  <div className="space-y-2">
                    {PREVIEW.map(ch => (
                      <div key={ch.naam} className={`rounded-xl border overflow-hidden ${ch.priority === 'high' ? 'border-amber-500/20' : 'border-white/5'}`}>
                        <button
                          onClick={() => setExpanded(expanded === ch.naam ? null : ch.naam)}
                          className={`w-full flex items-center justify-between p-3 text-left ${ch.priority === 'high' ? 'bg-amber-500/5' : 'bg-white/[0.02]'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            {ch.priority === 'high'
                              ? <Zap size={12} className="text-amber-400 flex-shrink-0" />
                              : <Clock size={12} className="text-white/45 flex-shrink-0" />}
                            <div className="text-left">
                              <p className={`text-xs font-semibold flex items-center gap-1.5 ${ch.priority === 'high' ? 'text-amber-300' : 'text-white/80'}`}>
                                {ch.naam}
                                {ch.priority === 'high' && (
                                  <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">PRIO · NOOIT STILSTAND</span>
                                )}
                              </p>
                              <p className="text-[10px] text-white/50 mt-0.5 flex items-center gap-2">
                                <span className="flex items-center gap-1"><Film size={9} />{ch.longform}× long-form</span>
                                {ch.shorts > 0 && <span className="flex items-center gap-1"><Scissors size={9} className="text-pink-400" /><span className="text-pink-400">{ch.shorts}× Shorts</span></span>}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-white">{ch.perDay}× per dag</p>
                            <p className="text-[10px] text-white/50">
                              {ch.horizonDays}d → <span className="text-white/50 font-semibold">{ch.perDay * ch.horizonDays} slots</span>
                            </p>
                          </div>
                        </button>

                        {expanded === ch.naam && (
                          <div className="px-3 pb-3 pt-1 flex flex-wrap gap-1.5 border-t border-white/5">
                            {ch.schedule.map(s => (
                              <span
                                key={s.hour}
                                className={`text-[10px] px-2 py-1 rounded-md font-mono font-semibold ${
                                  s.type === 'short'
                                    ? 'bg-pink-500/10 border border-pink-500/20 text-pink-400'
                                    : 'bg-white/5 border border-white/10 text-white/50'
                                }`}
                              >
                                {s.hour}
                                {s.type === 'short' && <span className="ml-1 text-[9px] opacity-70">S</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-white/38 text-center">Klik op een kanaal om het dagschema te zien · Bestaande slots worden overgeslagen</p>

                  {error && (
                    <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    onClick={generate}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-500/20 border border-violet-500/30 rounded-xl text-sm font-semibold text-violet-300 hover:bg-violet-500/30 transition-all disabled:opacity-50"
                  >
                    {loading
                      ? <span className="animate-pulse">Planning genereren…</span>
                      : <><CalendarDays size={13} /> Genereer Planning <ChevronRight size={13} /></>}
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-white">{result.created}</p>
                    <p className="text-sm text-white/65 mt-1">
                      {result.created === 0 ? (result.message ?? 'Alle slots al ingepland') : 'upload slots aangemaakt'}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {(result.summary ?? []).map(s => (
                      <div key={s.naam} className="px-3 py-2 bg-white/[0.02] rounded-lg border border-white/5 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={s.priority === 'high' ? 'text-amber-300 font-semibold' : 'text-white/60'}>
                            {s.priority === 'high' && <Zap size={10} className="inline mr-1 text-amber-400" />}
                            {s.naam}
                          </span>
                          <span className="text-white/65 tabular-nums">{s.created} slots · {s.horizonDays}d</span>
                        </div>
                        {(s.shorts > 0 || s.longform > 0) && (
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-white/50 flex items-center gap-1"><Film size={9} />{s.longform} long-form</span>
                            {s.shorts > 0 && <span className="text-pink-400/70 flex items-center gap-1"><Scissors size={9} />{s.shorts} Shorts</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setOpen(false)}
                    className="w-full py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  >
                    Sluiten
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
