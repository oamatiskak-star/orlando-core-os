'use client'

import { useState } from 'react'
import { Lightbulb, Sparkles } from 'lucide-react'
import { WINNER_LABEL, WINNER_COLOR, type WinnerStatus } from '@/lib/war-room/scoring'
import type { Preview } from '@/lib/war-room/preview'
import CreativePreview from './CreativePreview'
import CreativeDetailPanel from './CreativeDetailPanel'

export type HookCreative = { id: string; name: string; preview: Preview }
export type HookRow = {
  id: string
  text: string
  channel: string | null
  winner: WinnerStatus | null
  score: number | null
  variantCount: number
  views: number | null
  ctr: number | null
  revenue: number | null
  creatives: HookCreative[]
}

type Advice = { label: string; color: string }
function hookAdvice(w: WinnerStatus | null): Advice {
  switch (w) {
    case 'top_1pct': case 'top_5pct': case 'winner': return { label: 'SCALE', color: '#22c55e' }
    case 'runner_up': return { label: 'TEST VARIANT', color: '#f59e0b' }
    case 'underperforming': return { label: 'REWRITE', color: '#f97316' }
    case 'loser': return { label: 'STOP', color: '#ef4444' }
    default: return { label: 'VERZAMEL DATA', color: '#64748b' }
  }
}

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n)
const eur = (n: number) => Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)

export default function HookLibrary({ hooks }: { hooks: HookRow[] }) {
  const [selected, setSelected] = useState<string | null>(null)

  if (hooks.length === 0) {
    return <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/50">Nog geen hooks.</div>
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {hooks.map((h) => {
        const wc = h.winner ? WINNER_COLOR[h.winner] : '#475569'
        const adv = hookAdvice(h.winner)
        return (
          <div key={h.id} className="rounded-lg border border-white/8 bg-[#0e1525] p-3">
            <div className="flex items-start gap-2">
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="text-[12px] font-medium leading-snug text-white line-clamp-3">{h.text}</div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {h.winner && <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: wc, background: `${wc}1a`, border: `1px solid ${wc}55` }}>{WINNER_LABEL[h.winner]}</span>}
              <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: adv.color, background: `${adv.color}1a`, border: `1px solid ${adv.color}55` }} title="Hermes advies">
                <Sparkles size={8} className="mr-0.5 inline" />{adv.label}
              </span>
              {h.channel && <span className="text-[9px] text-white/40">{h.channel}</span>}
              {h.score != null && <span className="ml-auto text-[9px] font-semibold text-amber-400">score {Math.round(h.score)}</span>}
            </div>

            <div className="mt-2 grid grid-cols-3 gap-1 border-y border-white/5 py-1.5 text-center">
              <M label="views" value={h.views != null ? compact(h.views) : '—'} />
              <M label="ctr" value={h.ctr != null ? `${h.ctr}%` : '—'} color="#34d399" />
              <M label="rev" value={h.revenue != null ? eur(h.revenue) : '—'} color="#22c55e" />
            </div>

            <div className="mt-2 text-[9px] uppercase tracking-wide text-white/35">{h.creatives.length} gekoppelde creative{h.creatives.length === 1 ? '' : 's'}</div>
            {h.creatives.length > 0 && (
              <div className="mt-1 flex gap-1.5 overflow-x-auto">
                {h.creatives.slice(0, 6).map((c) => (
                  <button key={c.id} onClick={() => setSelected(c.id)} title={c.name} className="w-14 shrink-0 overflow-hidden rounded border border-white/10 transition-transform hover:scale-105">
                    <CreativePreview preview={c.preview} ratio="square" rounded="rounded" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {selected && <CreativeDetailPanel key={selected} creativeId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function M({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[7px] uppercase text-white/30">{label}</div>
      <div className="text-[10px] font-semibold tabular-nums" style={{ color: value === '—' ? 'rgba(255,255,255,0.25)' : color ?? '#fff' }}>{value}</div>
    </div>
  )
}
