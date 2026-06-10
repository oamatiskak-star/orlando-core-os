'use client'

import { useMemo, useState } from 'react'
import { Sparkles } from 'lucide-react'
import CreativePreview from './CreativePreview'
import { resolvePreview } from '@/lib/war-room/preview'
import { WINNER_LABEL, WINNER_COLOR, type WinnerStatus } from '@/lib/war-room/scoring'
import { CAT_LABEL, CAT_COLOR, nicheLabel } from '@/lib/war-room/hooks-intel'

export type HookRow = {
  id: string; youtube_video_id: string | null; title: string; thumbnail_url: string | null
  niche: string; category: string; views: number; ctr: number | null; retention: number | null
  revenue: number | null; hook_score: number | null; winner_status: WinnerStatus; confidence: number; at: string | null
}
export type CatPerf = { niche: string; category: string; n: number; avg_ctr: number; avg_retention: number; avg_hook_score: number }

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)
const WINDOWS = [{ k: '7', d: 7, l: '7 dagen' }, { k: '30', d: 30, l: '30 dagen' }, { k: '90', d: 90, l: '90 dagen' }, { k: 'all', d: 0, l: 'Alles' }]

export default function HookIntelligence({ rows, catPerf, nowMs }: { rows: HookRow[]; catPerf: CatPerf[]; nowMs: number }) {
  const niches = useMemo(() => Array.from(new Set(rows.map((r) => r.niche))).sort(), [rows])
  const [niche, setNiche] = useState<string>(niches[0] ?? 'overig')
  const [win, setWin] = useState<string>('all')

  const filtered = useMemo(() => {
    const days = WINDOWS.find((w) => w.k === win)?.d ?? 0
    const cutoff = days > 0 ? nowMs - days * 86400000 : 0
    return rows
      .filter((r) => r.niche === niche)
      .filter((r) => (cutoff === 0 ? true : r.at && new Date(r.at).getTime() >= cutoff))
      .filter((r) => r.views > 0 || r.ctr != null) // alleen hooks met echte performance
      .sort((a, b) => (b.hook_score ?? 0) - (a.hook_score ?? 0) || b.views - a.views)
      .slice(0, 24)
  }, [rows, niche, win, nowMs])

  // categorie-mix + edge voor "waarom wint deze hook?"
  const nichePerf = useMemo(() => catPerf.filter((c) => c.niche === niche).sort((a, b) => b.avg_hook_score - a.avg_hook_score), [catPerf, niche])
  const nicheAvgCtr = useMemo(() => {
    const all = catPerf.filter((c) => c.niche === niche)
    const tot = all.reduce((s, c) => s + c.avg_ctr * c.n, 0); const n = all.reduce((s, c) => s + c.n, 0)
    return n ? tot / n : 0
  }, [catPerf, niche])
  function whyWins(cat: string): string {
    const cp = nichePerf.find((c) => c.category === cat)
    if (!cp || nicheAvgCtr <= 0) return 'Categorie presteert sterk in deze niche.'
    const edge = cp.avg_ctr / nicheAvgCtr
    return `${CAT_LABEL[cat] ?? cat}-hooks scoren ~${cp.avg_ctr}% CTR in ${nicheLabel(niche)} (${edge.toFixed(1)}× niche-gemiddelde) over ${cp.n} video's.`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-white/40">Niche</label>
          <select value={niche} onChange={(e) => setNiche(e.target.value)} className="rounded border border-white/10 bg-[#0e1525] px-2 py-1 text-xs text-white">
            {niches.map((n) => <option key={n} value={n}>{nicheLabel(n)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] uppercase tracking-wide text-white/40">Periode</label>
          <select value={win} onChange={(e) => setWin(e.target.value)} className="rounded border border-white/10 bg-[#0e1525] px-2 py-1 text-xs text-white">
            {WINDOWS.map((w) => <option key={w.k} value={w.k}>{w.l}</option>)}
          </select>
        </div>
      </div>

      {/* categorie-mix van deze niche */}
      {nichePerf.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {nichePerf.slice(0, 10).map((c) => (
            <span key={c.category} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ color: CAT_COLOR[c.category], background: `${CAT_COLOR[c.category]}14`, border: `1px solid ${CAT_COLOR[c.category]}33` }}
              title={`gem. hook-score ${c.avg_hook_score} · ${c.n} video's`}>
              {CAT_LABEL[c.category]} · {c.n}
            </span>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/45">Geen data beschikbaar voor deze niche/periode.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((h) => {
            const wc = WINNER_COLOR[h.winner_status]; const cc = CAT_COLOR[h.category]
            return (
              <div key={h.id} className="overflow-hidden rounded-lg border border-white/8 bg-[#0e1525]">
                <CreativePreview preview={resolvePreview(null, h.youtube_video_id, h.thumbnail_url)} ratio="video" />
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: cc, background: `${cc}1a` }}>{CAT_LABEL[h.category]}</span>
                    {h.winner_status !== 'insufficient_data' && (
                      <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: wc, background: `${wc}1a` }}>{WINNER_LABEL[h.winner_status]} {h.hook_score}</span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[11px] font-medium leading-snug text-white line-clamp-2">{h.title}</div>
                  <div className="mt-1.5 grid grid-cols-4 gap-1 border-t border-white/5 pt-1.5 text-center">
                    <M label="views" value={compact(h.views)} />
                    <M label="ctr" value={h.ctr != null ? `${h.ctr}%` : '—'} color="#34d399" />
                    <M label="ret" value={h.retention != null ? `${h.retention}%` : '—'} color="#38bdf8" />
                    <M label="conf" value={`${Math.round(h.confidence * 100)}%`} />
                  </div>
                  <div className="mt-1.5 flex items-start gap-1 rounded border border-violet-400/20 bg-violet-500/[0.06] px-1.5 py-1 text-[9px] text-violet-200/90">
                    <Sparkles size={10} className="mt-0.5 shrink-0 text-violet-300" />
                    <span><span className="font-semibold">Waarom wint dit?</span> {whyWins(h.category)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function M({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div><div className="text-[7px] uppercase text-white/30">{label}</div><div className="text-[10px] font-semibold tabular-nums" style={{ color: value === '—' ? 'rgba(255,255,255,0.25)' : color ?? '#fff' }}>{value}</div></div>
}
