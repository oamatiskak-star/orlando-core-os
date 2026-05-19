'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Award, ChevronLeft, Zap, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type Job = {
  id: string
  source_content_id: string
  variant_kind: string
  status: 'pending'|'rendering'|'ready'|'published'|'failed'|'skipped'
  output_content_id: string | null
  notes: string | null
  created_at: string
  source_content: { id: string; title: string | null; kind: string; output_url: string | null } | null
  output_content: { id: string; title: string | null; status: string; output_url: string | null } | null
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-white/[0.08] text-white/55',
  rendering:  'bg-amber-500/10 text-amber-300',
  dispatched: 'bg-amber-500/10 text-amber-300',
  ready:      'bg-emerald-500/10 text-emerald-300',
  published:  'bg-indigo-500/10 text-indigo-300',
  failed:     'bg-red-500/10 text-red-400',
  skipped:    'bg-white/[0.06] text-white/40',
}

const KIND_COLORS: Record<string, string> = {
  remix:        'bg-pink-500/10 text-pink-300',
  loop:         'bg-cyan-500/10 text-cyan-300',
  compilation:  'bg-orange-500/10 text-orange-300',
  slowed:       'bg-violet-500/10 text-violet-300',
  enhanced:     'bg-emerald-500/10 text-emerald-300',
  multilingual: 'bg-blue-500/10 text-blue-300',
  stitched:     'bg-amber-500/10 text-amber-300',
  extended:     'bg-teal-500/10 text-teal-300',
  horizontal:   'bg-fuchsia-500/10 text-fuchsia-300',
  reaction_bait:'bg-red-500/10 text-red-300',
}

function groupBySource(jobs: Job[]) {
  const map = new Map<string, { source: Job['source_content']; jobs: Job[] }>()
  for (const j of jobs) {
    const key = j.source_content_id
    if (!map.has(key)) map.set(key, { source: j.source_content, jobs: [] })
    map.get(key)!.jobs.push(j)
  }
  return map
}

export default function WinnerExtractionPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [extractMsg, setExtractMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/media-holding/winner-extraction/jobs?limit=300')
      if (r.ok) {
        const j = await r.json()
        setJobs(j.jobs ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function startExtraction(contentItemId: string, perKind = 1) {
    setExtracting(true); setExtractMsg('')
    try {
      const r = await fetch(`/api/media-holding/winner-extraction/extract/${contentItemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'content_item', variants_per_kind: perKind }),
      })
      if (r.ok) {
        const j = await r.json()
        setExtractMsg(`Fan-out gestart: ${j.total_variants} variants (${j.variant_kinds.length} kinds × ${j.variants_per_kind}). Task ${j.task_id?.slice(0, 8)}…`)
        setTimeout(load, 15_000)
      } else {
        const j = await r.json().catch(() => ({}))
        setExtractMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setExtracting(false) }
  }

  const grouped = groupBySource(jobs)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Award size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Winner Extraction Engine</h1>
          <p className="text-xs text-white/50">Fan-out van 1 viral asset → 50+ derivatives (10 kinds × variants).</p>
        </div>
      </div>

      {extractMsg && (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">
          {extractMsg}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : grouped.size === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Award size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen winner extraction jobs.</p>
          <p className="text-[11px] text-white/40 mt-1">Ga naar Content Factory en klik &quot;Extract winners&quot; op een viral content_item.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([sourceId, group]) => {
            const completed = group.jobs.filter((j) => j.status === 'ready' || j.status === 'published').length
            const failed    = group.jobs.filter((j) => j.status === 'failed').length
            return (
              <div key={sourceId} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white line-clamp-1">{group.source?.title ?? '(source verwijderd)'}</p>
                    <p className="text-[10px] text-white/45 mt-0.5">{group.source?.kind} · {group.jobs.length} variants ({completed} klaar, {failed} fail)</p>
                  </div>
                  {group.source?.output_url && (
                    <a href={group.source.output_url} target="_blank" rel="noreferrer" className="text-indigo-300 hover:text-indigo-200" title="Source video">
                      <ExternalLink size={13} />
                    </a>
                  )}
                  <button
                    onClick={() => startExtraction(sourceId, 1)}
                    disabled={extracting}
                    className="ml-3 flex items-center gap-1 bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 disabled:opacity-50 text-indigo-300 text-[11px] font-medium px-2.5 py-1.5 rounded-lg"
                  >
                    <Zap size={11} /> + Extract opnieuw
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {group.jobs.map((j) => (
                    <div key={j.id} className="bg-white/[0.04] border border-white/5 rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={clsx('px-1.5 py-0.5 rounded text-[9px] font-medium', KIND_COLORS[j.variant_kind] ?? 'bg-white/[0.06] text-white/55')}>
                          {j.variant_kind}
                        </span>
                        <span className={clsx('px-1.5 py-0.5 rounded text-[9px]', STATUS_COLORS[j.status])}>
                          {j.status}
                        </span>
                      </div>
                      {j.output_content?.title ? (
                        <p className="text-[10px] text-white/70 line-clamp-2">{j.output_content.title}</p>
                      ) : (
                        <p className="text-[10px] text-white/40 italic">— wacht op brief —</p>
                      )}
                      {j.output_content?.output_url && (
                        <a href={j.output_content.output_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-emerald-300 mt-1">
                          video <ExternalLink size={9} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
