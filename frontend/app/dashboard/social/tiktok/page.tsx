'use client'

import { useCallback, useEffect, useState } from 'react'
import { Video, BarChart3, TrendingUp, Plus, Pencil, Trash2, Calendar, Hash, CheckCircle, Clock, XCircle, FileText } from 'lucide-react'
import clsx from 'clsx'

type SocialPost = {
  id: string
  platform: string
  content_type: string
  status: string
  caption: string | null
  hashtags: string | null
  scheduled_at: string | null
  published_at: string | null
  metrics: Record<string, number>
  notes: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  concept:   'text-white/50 bg-white/5 border-white/10',
  scheduled: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  published: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  failed:    'text-red-400 bg-red-500/10 border-red-500/20',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  concept:   <FileText size={11} />,
  scheduled: <Clock size={11} />,
  published: <CheckCircle size={11} />,
  failed:    <XCircle size={11} />,
}

const EMPTY: Partial<SocialPost> = {
  content_type: 'short', caption: '', hashtags: '', scheduled_at: '', notes: '',
}

export default function TikTokPage() {
  const [posts, setPosts]       = useState<SocialPost[]>([])
  const [total, setTotal]       = useState(0)
  const [filter, setFilter]     = useState('')
  const [modal, setModal]       = useState<Partial<SocialPost> | null>(null)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams({ platform: 'tiktok', limit: '100' })
    if (filter) sp.set('status', filter)
    const r = await fetch(`/api/social/posts?${sp}`, { cache: 'no-store' })
    if (r.ok) {
      const d = await r.json()
      setPosts(d.posts ?? [])
      setTotal(d.total ?? 0)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew = !modal.id
    const url    = isNew ? '/api/social/posts' : `/api/social/posts/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      platform:     'tiktok',
      content_type: modal.content_type ?? 'short',
      caption:      modal.caption || null,
      hashtags:     modal.hashtags || null,
      scheduled_at: modal.scheduled_at || null,
      notes:        modal.notes || null,
    }
    if (!isNew) body.status = modal.status
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Video verwijderen?')) return
    await fetch(`/api/social/posts/${id}`, { method: 'DELETE' })
    load()
  }

  const counts = {
    concept:   posts.filter(p => p.status === 'concept').length,
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">TikTok</h1>
          <p className="text-sm text-white/65 mt-0.5">Shorts, analytics en contentplanning</p>
        </div>
        <button
          onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/25 transition-colors text-sm"
        >
          <Plus size={14} /> Nieuwe video
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',       value: total,              icon: Video,        color: 'text-cyan-400   bg-cyan-500/10   border-cyan-500/20' },
          { label: 'Concept',      value: counts.concept,     icon: FileText,     color: 'text-white/50   bg-white/5       border-white/10' },
          { label: 'Ingepland',    value: counts.scheduled,   icon: Clock,        color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
          { label: 'Gepubliceerd', value: counts.published,   icon: CheckCircle,  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center border', color)}>
              <Icon size={14} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{value}</p>
              <p className="text-xs text-white/50">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: '',          l: 'Alle' },
          { v: 'concept',   l: 'Concept' },
          { v: 'scheduled', l: 'Ingepland' },
          { v: 'published', l: 'Gepubliceerd' },
          { v: 'failed',    l: 'Mislukt' },
        ].map(({ v, l }) => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={clsx(
              'px-3 py-1 rounded-lg text-xs transition-colors border',
              filter === v
                ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            )}
          >{l}</button>
        ))}
      </div>

      {/* Videos grid */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : posts.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <Video size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Nog geen TikTok videos</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-cyan-400 hover:text-cyan-300">Eerste video aanmaken</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {posts.map(p => (
            <div key={p.id} className="group bg-white/[0.06] border border-white/5 rounded-xl p-4 space-y-3 hover:border-white/15 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_COLORS[p.status] ?? STATUS_COLORS.concept)}>
                    {STATUS_ICON[p.status]} {p.status}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    {p.content_type}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setModal(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => del(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {p.caption && (
                <p className="text-sm text-white/80 line-clamp-3">{p.caption}</p>
              )}

              {p.hashtags && (
                <div className="flex items-center gap-1.5 text-xs text-cyan-400/70">
                  <Hash size={11} />
                  <span className="line-clamp-1">{p.hashtags}</span>
                </div>
              )}

              {p.scheduled_at && (
                <div className="flex items-center gap-1.5 text-xs text-violet-400/80">
                  <Calendar size={11} />
                  <span>{new Date(p.scheduled_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
              )}

              {Object.keys(p.metrics ?? {}).length > 0 && (
                <div className="flex gap-3 pt-1 border-t border-white/5">
                  {Object.entries(p.metrics).slice(0, 3).map(([k, v]) => (
                    <div key={k} className="text-center">
                      <p className="text-sm font-semibold text-white">{v}</p>
                      <p className="text-[10px] text-white/40 capitalize">{k}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-[#111] border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{modal.id ? 'Video bewerken' : 'Nieuwe video'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Type</label>
                  <select
                    value={modal.content_type ?? 'short'}
                    onChange={e => setModal(m => ({ ...m, content_type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="short">Short</option>
                    <option value="post">Post</option>
                    <option value="story">Story</option>
                  </select>
                </div>
                {modal.id && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Status</label>
                    <select
                      value={modal.status ?? 'concept'}
                      onChange={e => setModal(m => ({ ...m, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                    >
                      <option value="concept">Concept</option>
                      <option value="scheduled">Ingepland</option>
                      <option value="published">Gepubliceerd</option>
                      <option value="failed">Mislukt</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Beschrijving</label>
                <textarea
                  rows={4}
                  value={modal.caption ?? ''}
                  onChange={e => setModal(m => ({ ...m, caption: e.target.value }))}
                  placeholder="Video beschrijving en tekst..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Hashtags</label>
                <input
                  type="text"
                  value={modal.hashtags ?? ''}
                  onChange={e => setModal(m => ({ ...m, hashtags: e.target.value }))}
                  placeholder="#vastgoed #investeren #tiktok"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Inplannen op</label>
                <input
                  type="datetime-local"
                  value={modal.scheduled_at ? modal.scheduled_at.slice(0, 16) : ''}
                  onChange={e => setModal(m => ({ ...m, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Notities</label>
                <textarea
                  rows={2}
                  value={modal.notes ?? ''}
                  onChange={e => setModal(m => ({ ...m, notes: e.target.value }))}
                  placeholder="Interne notities..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-cyan-500/50 resize-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#111] border-t border-white/8 px-5 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Annuleren</button>
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
              >
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
