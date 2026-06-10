'use client'

import { useState } from 'react'
import { Trophy, Sparkles, Copy, Clapperboard, Tv2, Ruler } from 'lucide-react'
import CreativePreview from './CreativePreview'
import { resolvePreview } from '@/lib/war-room/preview'
import { WINNER_LABEL, WINNER_COLOR, type WinnerStatus } from '@/lib/war-room/scoring'
import { CAT_LABEL, CAT_COLOR, nicheLabel } from '@/lib/war-room/hooks-intel'

export type WinnerRow = {
  id: string; youtube_video_id: string | null; title: string; thumbnail_url: string | null
  niche: string; category: string; views: number; ctr: number | null; retention: number | null
  revenue: number | null; hook_score: number | null; winner_status: WinnerStatus
  channel: string | null; length_bucket: string; duration_seconds: number | null
  has_thumbnail: boolean; why_winner: string | null
}

const compact = (n: number) => Intl.NumberFormat('nl-NL', { notation: 'compact' }).format(n || 0)

export default function WinnerIntelligence({ rows }: { rows: WinnerRow[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  async function makeVariations(w: WinnerRow) {
    setBusy(w.id)
    try {
      const r = await fetch('/api/media-holding/war-room/variations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_video_id: w.id, title: w.title, niche: w.niche, category: w.category, count: 50,
          structure: { hook_category: w.category, length: w.length_bucket, channel: w.channel, niche: w.niche },
        }),
      })
      if (r.ok) setFlash('50 variaties aangevraagd (CF2 produceert zodra aangezet)')
      else { const j = await r.json().catch(() => ({})); setFlash(j.code === '42P01' ? 'variation_requests-tabel nog niet toegepast (migratie 170)' : 'Aanvraag mislukt') }
    } finally { setBusy(null); setTimeout(() => setFlash(null), 3000) }
  }

  if (rows.length === 0) {
    return <div className="rounded-lg border border-white/10 bg-[#0e1525] p-6 text-sm text-white/45">Nog geen winnaars met performance. Geen data beschikbaar.</div>
  }

  return (
    <div className="space-y-3">
      {flash && <div className="rounded bg-white/10 px-3 py-1.5 text-[11px] text-white/75">{flash}</div>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((w) => {
          const wc = WINNER_COLOR[w.winner_status]; const cc = CAT_COLOR[w.category]
          return (
            <div key={w.id} className="overflow-hidden rounded-lg border border-white/8 bg-[#0e1525]">
              <CreativePreview preview={resolvePreview(null, w.youtube_video_id, w.thumbnail_url)} ratio="video" />
              <div className="p-2.5">
                <div className="flex items-center gap-1.5">
                  <Trophy size={12} className="text-amber-400" />
                  <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: wc, background: `${wc}1a` }}>{WINNER_LABEL[w.winner_status]} {w.hook_score}</span>
                  <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase" style={{ color: cc, background: `${cc}1a` }}>{CAT_LABEL[w.category]}</span>
                </div>
                <div className="mt-1.5 text-[11px] font-medium leading-snug text-white line-clamp-2">{w.title}</div>

                {/* element-breakdown */}
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[9px] text-white/45">
                  {w.channel && <span className="inline-flex items-center gap-0.5"><Tv2 size={9} />{w.channel}</span>}
                  <span className="inline-flex items-center gap-0.5"><Ruler size={9} />{w.length_bucket}</span>
                  <span className="inline-flex items-center gap-0.5"><Clapperboard size={9} />{nicheLabel(w.niche)}</span>
                  <span>{compact(w.views)} views</span>
                  {w.ctr != null && <span className="text-emerald-400/70">CTR {w.ctr}%</span>}
                  {w.retention != null && <span className="text-sky-400/70">ret {w.retention}%</span>}
                </div>

                {/* waarom winnaar */}
                <div className="mt-1.5 flex items-start gap-1 rounded border border-violet-400/20 bg-violet-500/[0.06] px-1.5 py-1 text-[9px] text-violet-200/90">
                  <Sparkles size={10} className="mt-0.5 shrink-0 text-violet-300" />
                  <span><span className="font-semibold">Waarom winnaar?</span> {w.why_winner ?? '—'}</span>
                </div>

                <button onClick={() => makeVariations(w)} disabled={busy === w.id}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">
                  <Copy size={12} /> {busy === w.id ? 'Aanvragen…' : 'Maak 50 variaties'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
