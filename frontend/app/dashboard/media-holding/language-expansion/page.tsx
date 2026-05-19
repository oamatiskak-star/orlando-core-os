'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Languages, ChevronLeft, Zap, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

type Target = {
  id: string
  content_item_id: string
  target_lang: string
  status: 'pending'|'translating'|'ready'|'failed'|'skipped'
  output_content_id: string | null
  created_at: string
  updated_at: string
  source: { id: string; title: string | null; kind: string; channel_id: string | null } | null
  output: { id: string; title: string | null; status: string; output_url: string | null } | null
}

type Totals = {
  total: number
  by_lang: Record<string, number>
  by_status: Record<string, number>
}

const STATUS_COLORS: Record<string, string> = {
  pending:     'bg-white/[0.08] text-white/55',
  translating: 'bg-amber-500/10 text-amber-300',
  ready:       'bg-emerald-500/10 text-emerald-300',
  failed:      'bg-red-500/10 text-red-400',
  skipped:     'bg-white/[0.06] text-white/40',
}

const LANG_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  pt: 'Portuguese',
  ar: 'Arabic',
  nl: 'Dutch',
}

const LANG_FLAGS: Record<string, string> = {
  en: 'EN', es: 'ES', de: 'DE', fr: 'FR', pt: 'PT', ar: 'AR', nl: 'NL',
}

function groupBySource(targets: Target[]) {
  const map = new Map<string, { source: Target['source']; targets: Target[] }>()
  for (const t of targets) {
    const key = t.content_item_id
    if (!map.has(key)) map.set(key, { source: t.source, targets: [] })
    map.get(key)!.targets.push(t)
  }
  return map
}

export default function LanguageExpansionPage() {
  const [targets, setTargets] = useState<Target[]>([])
  const [totals, setTotals] = useState<Totals | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanding, setExpanding] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/media-holding/language-expansion/targets?limit=300')
      if (r.ok) {
        const j = await r.json()
        setTargets(j.targets ?? [])
        setTotals(j.totals ?? null)
      }
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function expand(contentItemId: string) {
    setExpanding(true); setMsg('')
    try {
      const r = await fetch(`/api/media-holding/language-expansion/expand/${contentItemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (r.ok) {
        const j = await r.json()
        setMsg(`Fan-out gestart: ${j.target_langs.length} talen (${j.target_langs.join(', ')}). Task ${j.task_id?.slice(0, 8)}…`)
        setTimeout(load, 12_000)
      } else {
        const j = await r.json().catch(() => ({}))
        setMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setExpanding(false) }
  }

  const grouped = groupBySource(targets)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <Languages size={16} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Language Expansion</h1>
          <p className="text-xs text-white/50">Fan-out van viral winnaars naar 6 talen (EN/ES/DE/FR/PT/AR).</p>
        </div>
      </div>

      {totals && totals.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-3">
            <p className="text-[10px] text-white/45 uppercase tracking-wider">Targets</p>
            <p className="text-xl font-semibold text-white mt-0.5">{totals.total}</p>
          </div>
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-3">
            <p className="text-[10px] text-white/45 uppercase tracking-wider">Ready</p>
            <p className="text-xl font-semibold text-emerald-300 mt-0.5">{totals.by_status.ready ?? 0}</p>
          </div>
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-3">
            <p className="text-[10px] text-white/45 uppercase tracking-wider">Translating</p>
            <p className="text-xl font-semibold text-amber-300 mt-0.5">{totals.by_status.translating ?? 0}</p>
          </div>
          <div className="bg-white/[0.06] border border-white/5 rounded-xl p-3">
            <p className="text-[10px] text-white/45 uppercase tracking-wider">Failed</p>
            <p className="text-xl font-semibold text-red-400 mt-0.5">{totals.by_status.failed ?? 0}</p>
          </div>
        </div>
      )}

      {msg && (
        <div className="bg-white/[0.04] border border-white/10 rounded-lg px-4 py-2.5 text-[11px] text-white/70">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : grouped.size === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Languages size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen language expansion targets.</p>
          <p className="text-[11px] text-white/40 mt-1">POST naar /api/media-holding/language-expansion/expand/&lt;content_item_id&gt; om fan-out te triggeren.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([sourceId, group]) => {
            const ready = group.targets.filter((t) => t.status === 'ready').length
            const failed = group.targets.filter((t) => t.status === 'failed').length
            return (
              <div key={sourceId} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white line-clamp-1">{group.source?.title ?? '(source verwijderd)'}</p>
                    <p className="text-[10px] text-white/45 mt-0.5">
                      {group.source?.kind} · {group.targets.length} talen ({ready} ready, {failed} fail)
                    </p>
                  </div>
                  <button
                    onClick={() => expand(sourceId)}
                    disabled={expanding}
                    className="ml-3 flex items-center gap-1 bg-blue-500/20 border border-blue-500/30 hover:bg-blue-500/30 disabled:opacity-50 text-blue-300 text-[11px] font-medium px-2.5 py-1.5 rounded-lg"
                  >
                    <Zap size={11} /> Expand opnieuw
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                  {group.targets.map((t) => (
                    <div key={t.id} className="bg-white/[0.04] border border-white/5 rounded-lg p-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/10 text-blue-300">
                          {LANG_FLAGS[t.target_lang] ?? t.target_lang.toUpperCase()}
                        </span>
                        <span className={clsx('px-1.5 py-0.5 rounded text-[9px]', STATUS_COLORS[t.status])}>
                          {t.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/55">{LANG_LABELS[t.target_lang] ?? t.target_lang}</p>
                      {t.output?.title ? (
                        <p className="text-[10px] text-white/70 line-clamp-2 mt-1">{t.output.title}</p>
                      ) : (
                        <p className="text-[10px] text-white/40 italic mt-1">— wacht op brief —</p>
                      )}
                      {t.output?.output_url && (
                        <a href={t.output.output_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[9px] text-emerald-300 mt-1">
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
