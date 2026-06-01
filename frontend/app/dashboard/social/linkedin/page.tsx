'use client'

import { useCallback, useEffect, useState } from 'react'
import { Linkedin, Plus, Pencil, Trash2, CheckCircle, Clock, XCircle, FileText, Link2 } from 'lucide-react'
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

const TYPE_LABELS: Record<string, string> = {
  post: 'Post', article: 'Artikel', document: 'Document (carousel)', poll: 'Poll', newsletter: 'Newsletter',
}

const EMPTY: Partial<SocialPost> = {
  content_type: 'post', caption: '', hashtags: '', scheduled_at: '', notes: '',
}

const ACCENT = '#0A66C2'

export default function LinkedInPage() {
  const [posts, setPosts]     = useState<SocialPost[]>([])
  const [total, setTotal]     = useState(0)
  const [filter, setFilter]   = useState('')
  const [modal, setModal]     = useState<Partial<SocialPost> | null>(null)
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams({ platform: 'linkedin', limit: '100' })
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
    const isNew  = !modal.id
    const url    = isNew ? '/api/social/posts' : `/api/social/posts/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const body: Record<string, unknown> = {
      platform:     'linkedin',
      content_type: modal.content_type ?? 'post',
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
    if (!confirm('Post verwijderen?')) return
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
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center border" style={{ background: `${ACCENT}1A`, borderColor: `${ACCENT}40` }}>
            <Linkedin size={17} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">LinkedIn</h1>
            <p className="text-sm text-white/65 mt-0.5">Aquier — content planner &amp; publicatieschema</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/dashboard/social/connect"
             className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors text-sm">
            <Link2 size={14} /> Koppeling
          </a>
          <button
            onClick={() => setModal({ ...EMPTY })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors"
            style={{ background: `${ACCENT}26`, borderColor: `${ACCENT}4D`, color: '#7FB2EC' }}
          >
            <Plus size={14} /> Nieuwe post
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Totaal',       value: total,            icon: Linkedin,   color: 'text-sky-400    bg-sky-500/10    border-sky-500/20' },
          { label: 'Concept',      value: counts.concept,   icon: FileText,   color: 'text-white/50   bg-white/5       border-white/10' },
          { label: 'Ingepland',    value: counts.scheduled, icon: Clock,      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
          { label: 'Gepubliceerd', value: counts.published, icon: CheckCircle,color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
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
            className={clsx('px-3 py-1 rounded-lg text-xs transition-colors border',
              filter === v ? 'bg-sky-500/20 border-sky-500/30 text-sky-300'
                           : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80')}
          >{l}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden…</div>
      ) : posts.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <Linkedin size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Nog geen LinkedIn-posts gepland</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-sky-400 hover:text-sky-300">Eerste post toevoegen</button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <div key={p.id} className="group bg-white/[0.06] border border-white/5 rounded-xl p-4 hover:border-white/15 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border', STATUS_COLORS[p.status] ?? STATUS_COLORS.concept)}>
                      {STATUS_ICON[p.status]} {p.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] border border-white/10 text-white/50 bg-white/5">
                      {TYPE_LABELS[p.content_type] ?? p.content_type}
                    </span>
                    {p.scheduled_at && (
                      <span className="text-[11px] text-violet-300/70">
                        {new Date(p.scheduled_at).toLocaleString('nl-NL', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    )}
                  </div>
                  {p.caption && <p className="text-sm text-white/80 line-clamp-3 whitespace-pre-wrap">{p.caption}</p>}
                  {p.hashtags && <p className="text-xs text-sky-400/70 mt-1">{p.hashtags}</p>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={() => setModal(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"><Pencil size={12} /></button>
                  <button onClick={() => del(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-[#111] border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{modal.id ? 'Post bewerken' : 'Nieuwe post'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Type</label>
                  <select
                    value={modal.content_type ?? 'post'}
                    onChange={e => setModal(m => ({ ...m, content_type: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                  >
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                {modal.id && (
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Status</label>
                    <select
                      value={modal.status ?? 'concept'}
                      onChange={e => setModal(m => ({ ...m, status: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
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
                <label className="text-xs text-white/50 mb-1 block">Tekst</label>
                <textarea
                  rows={6}
                  value={modal.caption ?? ''}
                  onChange={e => setModal(m => ({ ...m, caption: e.target.value }))}
                  placeholder="Post-tekst…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-sky-500/50 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Hashtags</label>
                <input
                  type="text"
                  value={modal.hashtags ?? ''}
                  onChange={e => setModal(m => ({ ...m, hashtags: e.target.value }))}
                  placeholder="#realestate #proptech #investing"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Inplannen op</label>
                <input
                  type="datetime-local"
                  value={modal.scheduled_at ? modal.scheduled_at.slice(0, 16) : ''}
                  onChange={e => setModal(m => ({ ...m, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Notities</label>
                <textarea
                  rows={2}
                  value={modal.notes ?? ''}
                  onChange={e => setModal(m => ({ ...m, notes: e.target.value }))}
                  placeholder="Interne notities…"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-sky-500/50 resize-none"
                />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#111] border-t border-white/8 px-5 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Annuleren</button>
              <button onClick={save} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm border transition-colors disabled:opacity-50"
                style={{ background: `${ACCENT}33`, borderColor: `${ACCENT}4D`, color: '#7FB2EC' }}>
                {saving ? 'Opslaan…' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
