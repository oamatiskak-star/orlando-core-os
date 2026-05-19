'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Hammer, ChevronLeft, X, ExternalLink, Film, Play as PlayIcon } from 'lucide-react'
import clsx from 'clsx'

type ContentBrief = {
  titel?: string
  hook?: string
  beschrijving?: string
  visual_prompt?: string
  audio_prompt?: string
  duration_target?: number
  suggested_kind?: string
  hashtags?: string[]
  hook_pattern?: string
  retention_strategy?: string
  replay_friendly?: boolean
}

type ContentItem = {
  id: string
  kind: string
  title: string | null
  hook: string | null
  duration_seconds: number | null
  status: string
  scheduled_at: string | null
  created_at: string
  language: string
  content_brief: ContentBrief | null
  output_url: string | null
  render_model: string | null
  render_job_id: string | null
  render_logs: string | null
  render_started_at: string | null
  channel: { id: string; name: string; niche: string } | null
  source_opportunity: { id: string; title: string; channel_name: string; virality_score: number } | null
}

const RENDER_MODELS = [
  { value: 'minimax/video-01',    label: 'minimax/video-01 (~€0.50/6s)' },
  { value: 'google/veo-3-fast',   label: 'google/veo-3-fast (~€1.20/6s, premium)' },
  { value: 'wan-2.2-i2v-fast',    label: 'wan-2.2-i2v-fast (~€0.30/6s, img→vid)' },
] as const

const STATUS_COLORS: Record<string, string> = {
  pending:   'bg-white/[0.08] text-white/55',
  rendering: 'bg-amber-500/10 text-amber-300',
  ready:     'bg-emerald-500/10 text-emerald-300',
  published: 'bg-indigo-500/10 text-indigo-300',
  failed:    'bg-red-500/10 text-red-400',
  archived:  'bg-white/[0.06] text-white/40',
}

export default function ContentFactoryPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const url = statusFilter ? `/api/media-holding/content-items?status=${statusFilter}` : '/api/media-holding/content-items'
      const r = await fetch(url)
      if (r.ok) {
        const j = await r.json()
        setItems(j.items ?? [])
      }
    } finally { setLoading(false) }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/media-holding" className="text-white/40 hover:text-white">
            <ChevronLeft size={16} />
          </Link>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Hammer size={16} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Content Factory</h1>
            <p className="text-xs text-white/50">Persona: <span className="text-indigo-300">Forge</span> — genereert content briefs voor render pipeline. Render zelf in Phase 2.5.</p>
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        >
          <option value="">Alle statussen</option>
          <option value="pending">pending</option>
          <option value="rendering">rendering</option>
          <option value="ready">ready</option>
          <option value="published">published</option>
          <option value="failed">failed</option>
        </select>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-white/40">Laden…</div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center bg-white/[0.04] border border-white/5 rounded-xl">
          <Hammer size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/65">Nog geen content briefs.</p>
          <p className="text-[11px] text-white/40 mt-1">Ga naar <Link href="/dashboard/media-holding/viral-intelligence" className="text-indigo-300 hover:text-indigo-200 underline">Viral Intelligence</Link> en klik &quot;Genereer brief&quot; op een viral kans.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((it) => (
            <button
              key={it.id}
              onClick={() => setSelectedItem(it)}
              className="text-left bg-white/[0.06] border border-white/5 rounded-xl p-4 hover:bg-white/[0.10] transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-white/40">{it.kind}</span>
                <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[it.status] ?? STATUS_COLORS.pending)}>
                  {it.status}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">{it.title ?? '(geen titel)'}</h3>
              {it.hook && (
                <p className="text-[11px] text-white/55 line-clamp-2 mb-2 italic">&quot;{it.hook}&quot;</p>
              )}
              <div className="flex items-center gap-3 text-[10px] text-white/40">
                {it.duration_seconds && <span>{it.duration_seconds}s</span>}
                <span>{it.language}</span>
                {it.channel && <span>{it.channel.name}</span>}
                {it.source_opportunity && <span>score {it.source_opportunity.virality_score}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onReload={load} />
      )}
    </div>
  )
}

function DetailModal({ item, onClose, onReload }: { item: ContentItem; onClose: () => void; onReload: () => void }) {
  const brief = item.content_brief
  const [updating, setUpdating] = useState(false)
  const [renderModel, setRenderModel] = useState<string>(item.render_model ?? RENDER_MODELS[0].value)
  const [rendering, setRendering] = useState(false)
  const [renderMsg, setRenderMsg] = useState('')

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    try {
      await fetch(`/api/media-holding/content-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      await onReload()
      onClose()
    } finally { setUpdating(false) }
  }

  async function startRender() {
    setRendering(true); setRenderMsg('')
    try {
      const r = await fetch(`/api/media-holding/content-items/${item.id}/render`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: renderModel }),
      })
      if (r.ok) {
        const j = await r.json()
        setRenderMsg(`Render gestart — task ${j.task_id?.slice(0, 8)}… (poll status van detail modal in ~1-3 min)`)
        await onReload()
      } else {
        const j = await r.json().catch(() => ({}))
        setRenderMsg(`Fout: ${j.error ?? r.status}`)
      }
    } finally { setRendering(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', STATUS_COLORS[item.status] ?? STATUS_COLORS.pending)}>
              {item.status}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/40">{item.kind}</span>
            <h2 className="text-sm font-semibold text-white">{item.title ?? '(geen titel)'}</h2>
          </div>
          <button onClick={onClose}><X size={16} className="text-white/50 hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-5">
          {item.hook && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Hook</p>
              <p className="text-sm text-white/90 italic">&quot;{item.hook}&quot;</p>
              {brief?.hook_pattern && <p className="text-[11px] text-white/50 mt-1">Pattern: {brief.hook_pattern}</p>}
            </div>
          )}

          {brief?.beschrijving && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Beschrijving / caption</p>
              <p className="text-xs text-white/80 whitespace-pre-wrap">{brief.beschrijving}</p>
            </div>
          )}

          {brief?.visual_prompt && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Visual prompt</p>
              <pre className="text-[11px] text-emerald-300/85 whitespace-pre-wrap font-mono bg-white/[0.03] border border-white/5 rounded-lg p-3">{brief.visual_prompt}</pre>
            </div>
          )}

          {brief?.audio_prompt && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Audio prompt</p>
              <pre className="text-[11px] text-amber-300/85 whitespace-pre-wrap font-mono bg-white/[0.03] border border-white/5 rounded-lg p-3">{brief.audio_prompt}</pre>
            </div>
          )}

          {brief?.retention_strategy && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Retention strategy</p>
              <p className="text-xs text-white/80">{brief.retention_strategy}</p>
            </div>
          )}

          {brief?.hashtags && brief.hashtags.length > 0 && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Hashtags</p>
              <div className="flex flex-wrap gap-1.5">
                {brief.hashtags.map((h) => (
                  <span key={h} className="text-[11px] px-2 py-1 rounded bg-white/[0.06] border border-white/10 text-white/75">#{h}</span>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Duur</p>
              <p className="text-white/80">{item.duration_seconds ?? '—'}s</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Taal</p>
              <p className="text-white/80">{item.language}</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Replay friendly</p>
              <p className="text-white/80">{brief?.replay_friendly ? 'ja' : 'nee'}</p>
            </div>
          </div>

          {item.source_opportunity && (
            <div>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1.5">Geïnspireerd door</p>
              <div className="bg-white/[0.04] border border-white/5 rounded-lg p-3 text-xs">
                <p className="text-white/85">{item.source_opportunity.title}</p>
                <p className="text-white/45 mt-0.5">{item.source_opportunity.channel_name} · score {item.source_opportunity.virality_score}</p>
              </div>
            </div>
          )}

          <div className="border-t border-white/5 pt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                <Film size={11} /> Render pipeline (Replicate)
              </p>
              {item.output_url && (
                <a href={item.output_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200">
                  Bekijk video <ExternalLink size={11} />
                </a>
              )}
            </div>

            {item.output_url ? (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-xs space-y-1">
                <p className="text-emerald-300">Video klaar voor upload</p>
                <p className="text-[10px] text-white/55 font-mono break-all">{item.output_url}</p>
                {item.render_model && <p className="text-[10px] text-white/45">model: {item.render_model}</p>}
              </div>
            ) : item.status === 'rendering' ? (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs">
                <p className="text-amber-300">Render in progress…</p>
                {item.render_job_id && <p className="text-[10px] text-white/45 mt-1">job: {item.render_job_id}</p>}
                {item.render_model && <p className="text-[10px] text-white/45">model: {item.render_model}</p>}
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={renderModel}
                  onChange={(e) => setRenderModel(e.target.value)}
                  className="w-full bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  {RENDER_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <button
                  onClick={startRender}
                  disabled={rendering}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium py-2.5 rounded-lg"
                >
                  <PlayIcon size={13} /> {rendering ? 'Dispatchen…' : 'Render video'}
                </button>
                {renderMsg && <p className="text-[11px] text-white/65">{renderMsg}</p>}
              </div>
            )}

            {item.render_logs && (
              <details className="mt-2">
                <summary className="text-[10px] text-white/40 cursor-pointer hover:text-white/70">Render logs</summary>
                <pre className="text-[10px] text-white/55 whitespace-pre-wrap font-mono bg-white/[0.03] border border-white/5 rounded-lg p-2 mt-1 max-h-48 overflow-y-auto">{item.render_logs}</pre>
              </details>
            )}
          </div>

          <div className="flex gap-3 pt-2 border-t border-white/5">
            <button
              onClick={() => updateStatus('rendering')}
              disabled={updating || item.status === 'rendering'}
              className="flex-1 bg-amber-600/20 border border-amber-500/30 hover:bg-amber-600/30 disabled:opacity-50 text-amber-300 text-xs font-medium py-2.5 rounded-lg"
            >
              → Rendering
            </button>
            <button
              onClick={() => updateStatus('published')}
              disabled={updating || item.status === 'published'}
              className="flex-1 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 disabled:opacity-50 text-indigo-300 text-xs font-medium py-2.5 rounded-lg"
            >
              → Published
            </button>
            <button
              onClick={() => updateStatus('archived')}
              disabled={updating || item.status === 'archived'}
              className="flex-1 bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] disabled:opacity-50 text-white/65 text-xs font-medium py-2.5 rounded-lg"
            >
              Archiveer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
