'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Video, ChevronLeft, RefreshCw, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type ContentItem = {
  id: string
  title: string | null
  hook: string | null
  duration_seconds: number | null
  status: string
  output_url: string | null
  retention_fetched_at: string | null
  retention_analysis: {
    analysis?: string
    sparkline?: string | null
    drop_offs?: Array<{ i: number; drop: number }>
    avg_retention?: number
    hook_retention?: number
    fetched_at?: string
  } | null
}

type Sample = { second_index: number; retention_pct: number; drop_off_marker: boolean }

export default function RetentionLabPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [samples, setSamples] = useState<Sample[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [fetchMsg, setFetchMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/media-holding/content-items?status=published&limit=100')
      if (r.ok) {
        const j = await r.json()
        setItems(j.items ?? [])
      }
    } finally { setLoading(false) }
  }, [])

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    setSamples([])
    try {
      const r = await fetch(`/api/media-holding/retention-lab/curves/${id}`)
      if (r.ok) {
        const j = await r.json()
        setSamples(j.samples ?? [])
      }
    } finally { setDetailLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (selectedId) loadDetail(selectedId) }, [selectedId, loadDetail])

  async function fetchRetention(id: string) {
    setFetching(true); setFetchMsg('')
    try {
      const r = await fetch(`/api/media-holding/retention-lab/fetch/${id}`, { method: 'POST' })
      if (r.ok) {
        const j = await r.json()
        setFetchMsg(`Retention fetch dispatched — task ${j.task_id?.slice(0, 8)}… (poll na 30s)`)
        setTimeout(() => { load(); if (selectedId === id) loadDetail(id) }, 30_000)
      } else {
        const j = await r.json().catch(() => ({}))
        setFetchMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setFetching(false) }
  }

  const selected = items.find((i) => i.id === selectedId)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Video size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Retention Lab</h1>
          <p className="text-xs text-white/50">Audience retention curves uit YouTube Analytics + AI pattern analyse.</p>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Video size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen gepubliceerde content.</p>
          <p className="text-[11px] text-white/40 mt-1">Atlas upload eerst content naar YouTube. Daarna kan Echo retention fetchen.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2 md:col-span-1">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => setSelectedId(it.id)}
                className={clsx(
                  'w-full text-left bg-white/[0.06] border rounded-lg p-3 transition-colors',
                  selectedId === it.id ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/5 hover:bg-white/[0.10]',
                )}
              >
                <p className="text-xs text-white/90 line-clamp-2">{it.title ?? '(geen titel)'}</p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/45">
                  <span>{it.duration_seconds}s</span>
                  {it.retention_fetched_at ? (
                    <span className="text-emerald-300">curve gefetcht</span>
                  ) : (
                    <span className="text-white/40">geen data</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="md:col-span-2 space-y-4">
            {!selected ? (
              <div className="p-10 text-center text-xs text-white/40 bg-white/[0.04] border border-white/5 rounded-xl">
                Selecteer een content-item links om retention data te zien.
              </div>
            ) : (
              <>
                <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{selected.title}</p>
                      {selected.hook && <p className="text-[11px] text-white/55 italic mt-1">&quot;{selected.hook}&quot;</p>}
                    </div>
                    <button
                      onClick={() => fetchRetention(selected.id)}
                      disabled={fetching}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg shrink-0"
                    >
                      <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
                      {selected.retention_fetched_at ? 'Refresh' : 'Fetch curve'}
                    </button>
                  </div>
                  {fetchMsg && <p className="text-[11px] text-white/65 mt-2">{fetchMsg}</p>}
                </div>

                {detailLoading ? (
                  <div className="p-6 text-center text-xs text-white/40">Laden…</div>
                ) : samples.length > 0 ? (
                  <>
                    {selected.retention_analysis && (
                      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
                        <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">AI analyse</p>
                        <p className="text-xs text-white/85 whitespace-pre-wrap mb-3">{selected.retention_analysis.analysis}</p>
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5 text-xs">
                          <div>
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Hook retentie (eerste 5%)</p>
                            <p className="text-emerald-300 font-semibold">{selected.retention_analysis.hook_retention?.toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-white/40 uppercase tracking-wider">Avg retentie</p>
                            <p className="text-white/85 font-semibold">{selected.retention_analysis.avg_retention?.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-2">Curve ({samples.length} buckets)</p>
                      {selected.retention_analysis?.sparkline && (
                        <pre className="text-[10px] font-mono text-indigo-300 mb-3 leading-tight overflow-x-auto">{selected.retention_analysis.sparkline}</pre>
                      )}
                      <div className="flex items-end gap-0.5 h-32 mb-2">
                        {samples.map((s) => (
                          <div
                            key={s.second_index}
                            title={`${s.second_index}%: ${Number(s.retention_pct).toFixed(1)}%`}
                            className={clsx(
                              'flex-1 rounded-t transition-all',
                              s.drop_off_marker ? 'bg-red-500/60' : 'bg-indigo-500/60',
                            )}
                            style={{ height: `${Math.max(2, Number(s.retention_pct))}%` }}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-white/40">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100% video duration</span>
                      </div>
                    </div>

                    {(selected.retention_analysis?.drop_offs?.length ?? 0) > 0 && (
                      <div className="bg-red-500/[0.04] border border-red-500/20 rounded-xl p-4">
                        <p className="text-[10px] text-red-300/80 uppercase tracking-wider mb-2">Top drop-offs</p>
                        <ul className="space-y-1">
                          {selected.retention_analysis?.drop_offs?.map((d) => (
                            <li key={d.i} className="text-xs text-white/75 flex items-center justify-between">
                              <span>bucket {d.i} ({d.i}% van video)</span>
                              <span className="text-red-300 font-semibold">-{d.drop.toFixed(1)}%</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : selected.retention_analysis?.analysis ? (
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-xs text-amber-200">{selected.retention_analysis.analysis}</p>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-white/40 bg-white/[0.04] border border-white/5 rounded-xl">
                    Nog geen retention data. Klik &quot;Fetch curve&quot; om YouTube Analytics op te halen.
                  </div>
                )}

                {selected.output_url && (
                  <a
                    href={selected.output_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-[11px] text-indigo-300 hover:text-indigo-200"
                  >
                    <ExternalLink size={11} /> Source video
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
