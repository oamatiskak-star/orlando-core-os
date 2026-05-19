'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { BookOpen, ChevronLeft, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import clsx from 'clsx'

type Hook = {
  id: string
  hook_text: string | null
  hook_visual_ref: string | null
  hook_audio_ref: string | null
  hook_kind: 'text'|'visual'|'audio'|'combo' | null
  pacing: string | null
  replay_friendly: boolean
  success_score: number
  source_opportunity_id: string | null
  source_content_id: string | null
  created_at: string
  source_content: { id: string; title: string | null; status: string } | null
}

export default function HookLibraryPage() {
  const [hooks, setHooks] = useState<Hook[]>([])
  const [loading, setLoading] = useState(true)
  const [minScore, setMinScore] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/media-holding/hook-library?min_score=${minScore}&limit=200`)
      if (r.ok) {
        const j = await r.json()
        setHooks(j.hooks ?? [])
      }
    } finally { setLoading(false) }
  }, [minScore])

  useEffect(() => { load() }, [load])

  async function adjustScore(id: string, delta: number) {
    const hook = hooks.find((h) => h.id === id)
    if (!hook) return
    const newScore = Math.max(0, Math.min(100, hook.success_score + delta))
    await fetch(`/api/media-holding/hook-library/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success_score: newScore }),
    })
    setHooks((prev) => prev.map((h) => h.id === id ? { ...h, success_score: newScore } : h))
  }

  async function removeHook(id: string) {
    if (!confirm('Hook verwijderen?')) return
    await fetch(`/api/media-holding/hook-library/${id}`, { method: 'DELETE' })
    setHooks((prev) => prev.filter((h) => h.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <BookOpen size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Hook Library</h1>
            <p className="text-xs text-white/50">Bewezen viral hook-patterns. Forge gebruikt top hooks (score ≥60) als context bij nieuwe briefs.</p>
          </div>
        </div>
        <select
          value={minScore}
          onChange={(e) => setMinScore(parseInt(e.target.value, 10))}
          className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="0">Alle scores</option>
          <option value="60">≥ 60 (Forge gebruikt deze)</option>
          <option value="70">≥ 70 (proven)</option>
          <option value="85">≥ 85 (top tier)</option>
        </select>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : hooks.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <BookOpen size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Hook library is leeg.</p>
          <p className="text-[11px] text-white/40 mt-1">Forge briefs extracten automatisch hooks. Genereer eerst content briefs in <Link href="/dashboard/media-holding/viral-intelligence" className="text-indigo-300 underline">Viral Intelligence</Link>.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {hooks.map((h) => (
            <div key={h.id} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/90 italic mb-2">&quot;{h.hook_text}&quot;</p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-white/65">{h.hook_kind ?? '—'}</span>
                    {h.pacing && <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300">{h.pacing}</span>}
                    {h.replay_friendly && <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">replay-friendly</span>}
                    {h.source_content && (
                      <Link href={`/dashboard/media-holding/content-factory`} className="px-2 py-0.5 rounded bg-white/[0.04] text-white/55 hover:text-white/80">
                        bron: {h.source_content.title?.slice(0, 40)}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustScore(h.id, -10)}
                      className="text-white/40 hover:text-red-400"
                      title="Score -10"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <span className={clsx(
                      'px-3 py-1 rounded-full text-xs font-bold min-w-[3rem] text-center',
                      h.success_score >= 85 ? 'bg-red-500/15 text-red-300' :
                      h.success_score >= 70 ? 'bg-orange-500/15 text-orange-300' :
                      h.success_score >= 60 ? 'bg-emerald-500/15 text-emerald-300' :
                      h.success_score >= 40 ? 'bg-amber-500/15 text-amber-300' :
                                              'bg-white/[0.08] text-white/55',
                    )}>{h.success_score}</span>
                    <button
                      onClick={() => adjustScore(h.id, +10)}
                      className="text-white/40 hover:text-emerald-400"
                      title="Score +10"
                    >
                      <ArrowUp size={14} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeHook(h.id)}
                    className="text-white/30 hover:text-red-400"
                    title="Verwijder"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
