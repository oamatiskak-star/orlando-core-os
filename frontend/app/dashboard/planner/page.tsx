'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CalendarClock, ChevronLeft, Power, Circle } from 'lucide-react'

type Block = {
  block_key: string; label: string; window_start: string; window_end: string
  days: number[]; weight: number; color: string; sort: number; enabled: boolean
}
type Engine = {
  engine_key: string; grp: string; label: string; engine_enabled: boolean
  block_key: string | null; block_label: string | null
  window_start: string | null; window_end: string | null
  color: string | null; window_open_now: boolean
}

const GRP_LABEL: Record<string, string> = {
  scraper_config: 'NL scrapers', vastgoed: 'Vastgoed (internationaal)',
  acq: 'Acquisitie AI-motoren', youtube: 'YouTube / Media',
}

function toMin(t: string): number { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
function segs(b: Block): { left: number; width: number }[] {
  const s = toMin(b.window_start), e = toMin(b.window_end) === 0 ? 1440 : toMin(b.window_end)
  if (e > s) return [{ left: (s / 1440) * 100, width: ((e - s) / 1440) * 100 }]
  return [ // over middernacht
    { left: (s / 1440) * 100, width: ((1440 - s) / 1440) * 100 },
    { left: 0, width: (e / 1440) * 100 },
  ]
}

export default function PlannerPage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [engines, setEngines] = useState<Engine[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  function load() {
    return fetch('/api/engine-planner').then(r => r.json()).then(j => {
      setBlocks(j.blocks ?? []); setEngines(j.engines ?? []); setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  async function post(payload: Record<string, unknown>, key: string) {
    setBusy(key)
    try {
      await fetch('/api/engine-planner', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      await load()
    } finally { setBusy(null) }
  }

  const enginesByBlock = useMemo(() => {
    const m: Record<string, Engine[]> = {}
    for (const e of engines) { const k = e.block_key ?? '_none'; (m[k] ??= []).push(e) }
    return m
  }, [engines])

  // Overlap-detectie tussen blokken (waarschuwing)
  const overlaps = useMemo(() => {
    const on = blocks.filter(b => b.enabled)
    const warn: string[] = []
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
      const a = on[i], b = on[j]
      const as = toMin(a.window_start), ae = toMin(a.window_end) || 1440
      const bs = toMin(b.window_start), be = toMin(b.window_end) || 1440
      if (as < be && bs < ae) warn.push(`${a.label} ↔ ${b.label}`)
    }
    return warn
  }, [blocks])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-white/40 hover:text-white/70"><ChevronLeft size={16} /></Link>
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <CalendarClock size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Engine Planner</h1>
          <p className="text-xs text-white/50">Niet-overlappende tijdblokken (NL-tijd) — scrapers & motoren draaien nooit als één grote batch.</p>
        </div>
      </div>

      {overlaps.length > 0 && (
        <div className="text-[11px] px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
          ⚠ Overlappende blokken: {overlaps.join(' · ')} — pas vensters aan voor strikte scheiding.
        </div>
      )}

      {/* 24-uurs tijdlijn */}
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
        <div className="flex justify-between text-[9px] text-white/30 mb-1">
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map(h => <span key={h}>{String(h).padStart(2, '0')}</span>)}
        </div>
        <div className="space-y-1.5">
          {blocks.map(b => (
            <div key={b.block_key} className="flex items-center gap-2">
              <span className="w-40 shrink-0 text-[11px] text-white/60 truncate">{b.label}</span>
              <div className="relative flex-1 h-5 rounded bg-white/[0.04] overflow-hidden">
                {segs(b).map((s, i) => (
                  <div key={i} className="absolute top-0 h-full rounded flex items-center justify-center text-[9px] text-white/90 font-medium"
                    style={{ left: `${s.left}%`, width: `${s.width}%`, background: b.enabled ? b.color : '#3f3f46', opacity: b.enabled ? 0.85 : 0.4 }}
                    title={`${b.window_start}–${b.window_end}`}>
                    {s.width > 8 ? `${b.window_start}–${b.window_end}` : ''}
                  </div>
                ))}
              </div>
              <span className="w-10 shrink-0 text-right text-[10px] text-white/40">{(enginesByBlock[b.block_key] ?? []).length}×</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per blok: vensters + engines */}
      <div className="space-y-3">
        {blocks.map(b => {
          const list = enginesByBlock[b.block_key] ?? []
          return (
            <div key={b.block_key} className="bg-white/[0.03] border border-white/8 rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5" style={{ background: `${b.color}14` }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
                <span className="text-sm font-medium text-white">{b.label}</span>
                <input type="time" value={b.window_start.slice(0, 5)} disabled={busy !== null}
                  onChange={e => post({ action: 'update_block', block_key: b.block_key, window_start: e.target.value }, b.block_key)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white/80" />
                <span className="text-white/30 text-xs">–</span>
                <input type="time" value={b.window_end.slice(0, 5)} disabled={busy !== null}
                  onChange={e => post({ action: 'update_block', block_key: b.block_key, window_end: e.target.value }, b.block_key)}
                  className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-white/80" />
                <span className="text-[10px] text-white/35">{list.length} engines</span>
                <button onClick={() => post({ action: 'update_block', block_key: b.block_key, enabled: !b.enabled }, b.block_key)}
                  className={`ml-auto text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${b.enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/40'}`}>
                  <Power size={10} /> {b.enabled ? 'actief' : 'uit'}
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
                {list.map(e => (
                  <div key={e.engine_key} className="flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0f]">
                    <Circle size={7} className={e.window_open_now ? 'text-emerald-400 fill-emerald-400' : 'text-white/20 fill-white/10'} />
                    <span className="text-[11px] text-white/75 truncate flex-1" title={e.engine_key}>{e.label}</span>
                    <span className="text-[8px] text-white/30 uppercase">{GRP_LABEL[e.grp]?.split(' ')[0] ?? e.grp}</span>
                    <select value={e.block_key ?? ''} disabled={busy !== null}
                      onChange={ev => post({ action: 'assign', engine_key: e.engine_key, block_key: ev.target.value || null }, e.engine_key)}
                      className="bg-white/5 border border-white/10 rounded px-1 py-0.5 text-[9px] text-white/60 max-w-[90px]">
                      {blocks.map(bb => <option key={bb.block_key} value={bb.block_key}>{bb.label}</option>)}
                    </select>
                    <button onClick={() => post({ action: 'toggle_engine', engine_key: e.engine_key, enabled: !e.engine_enabled }, e.engine_key)}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${e.engine_enabled ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-white/35'}`}>
                      {e.engine_enabled ? 'aan' : 'uit'}
                    </button>
                  </div>
                ))}
                {list.length === 0 && <div className="px-3 py-2 text-[10px] text-white/25 bg-[#0a0a0f]">Geen engines in dit blok</div>}
              </div>
            </div>
          )
        })}
      </div>

      {loading && <div className="py-10 text-center text-xs text-white/40">Laden…</div>}
    </div>
  )
}
