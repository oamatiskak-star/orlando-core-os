'use client'

import { useCallback, useEffect, useState } from 'react'
import { Eye, MessageSquarePlus, Star, FlaskConical, Send } from 'lucide-react'
import { statusColor } from '@/lib/war-room/graph'
import CreativeDetailPanel from './CreativeDetailPanel'

type Note = { kind: string; note: string | null; created_at: string }
type Item = {
  id: string
  title: string
  channel: string | null
  stage: string
  status: string | null
  platforms: (string | null)[]
  thumbnail_concept: string | null
  notes: Note[]
}

const STAGES = ['Generated', 'Review Available', 'Scheduled', 'Uploading', 'Uploaded', 'Verified Live']

export default function ReviewQueue() {
  const [items, setItems] = useState<Item[]>([])
  const [notesEnabled, setNotesEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [commenting, setCommenting] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/media-holding/war-room/review', { cache: 'no-store' })
      if (r.ok) { const j = await r.json(); setItems(j.items ?? []); setNotesEnabled(j.notesEnabled ?? true) }
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function addNote(itemId: string, kind: 'comment' | 'interesting' | 'analyze', note?: string) {
    const r = await fetch('/api/media-holding/war-room/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_item_id: itemId, kind, note }),
    })
    if (r.ok) { setFlash('Opgeslagen'); setTimeout(() => setFlash(null), 1500); load() }
    else { const j = await r.json().catch(() => ({})); setFlash(j.code === '42P01' ? 'Notities-tabel nog niet toegepast (migratie 163)' : 'Opslaan mislukt'); setTimeout(() => setFlash(null), 2500) }
    setCommenting(null); setCommentText('')
  }

  if (loading) return <div className="h-40 animate-pulse rounded-lg bg-white/[0.04]" />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-white/45">
          Review Queue — extra controlelaag, <span className="text-white/65">geen approval</span>. De fabriek blijft automatisch draaien. Bekijken · opmerken · markeren.
        </p>
        {flash && <span className="rounded bg-white/10 px-2 py-1 text-[11px] text-white/70">{flash}</span>}
      </div>

      {!notesEnabled && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-200/80">
          Opmerkingen/markeringen worden pas opgeslagen na toepassing van migratie 163 (<code>war_room_review_notes</code>). Bekijken werkt al.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {STAGES.map((stage) => {
          const list = items.filter((i) => i.stage === stage)
          return (
            <div key={stage} className="rounded-lg border border-white/8 bg-[#0b1120] p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/55">{stage}</span>
                <span className="text-[10px] text-white/30">{list.length}</span>
              </div>
              <div className="space-y-2">
                {list.length === 0 && <div className="px-1 py-3 text-center text-[10px] text-white/25">leeg</div>}
                {list.map((it) => (
                  <div key={it.id} className="rounded-lg border border-white/8 bg-[#0e1525] p-2">
                    <div className="flex gap-2">
                      <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-gradient-to-br from-cyan-500/15 to-violet-500/10 p-1 text-center text-[7px] leading-tight text-white/50 border border-white/5">
                        {it.thumbnail_concept ? <span className="line-clamp-3">{it.thumbnail_concept}</span> : '—'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-medium text-white">{it.title}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-white/40">
                          {it.channel && <span className="truncate max-w-[90px]">{it.channel}</span>}
                          {it.platforms.map((p, i) => <span key={i} className="inline-flex items-center gap-0.5"><Send size={8} />{p}</span>)}
                          {it.status && <span style={{ color: statusColor(it.status) }} className="uppercase font-semibold">{it.status}</span>}
                        </div>
                      </div>
                    </div>

                    {it.notes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {it.notes.slice(0, 3).map((n, i) => (
                          <span key={i} className="rounded bg-white/[0.06] px-1 py-0.5 text-[8px] text-white/55">
                            {n.kind === 'interesting' ? '★ interessant' : n.kind === 'analyze' ? '⚗ analyse' : `“${(n.note ?? '').slice(0, 24)}”`}
                          </span>
                        ))}
                      </div>
                    )}

                    {commenting === it.id ? (
                      <div className="mt-1.5 flex gap-1">
                        <input autoFocus value={commentText} onChange={(e) => setCommentText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && commentText.trim()) addNote(it.id, 'comment', commentText.trim()) }}
                          placeholder="Opmerking…" className="min-w-0 flex-1 rounded border border-white/10 bg-[#0b1120] px-1.5 py-1 text-[10px] text-white" />
                        <button onClick={() => commentText.trim() && addNote(it.id, 'comment', commentText.trim())} className="rounded bg-violet-500/20 px-1.5 text-[10px] text-violet-200">OK</button>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-1">
                        <button onClick={() => setSelected(it.id)} className="inline-flex items-center gap-0.5 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-white/60 hover:text-white" title="Bekijk"><Eye size={10} /> Bekijk</button>
                        <button onClick={() => { setCommenting(it.id); setCommentText('') }} className="inline-flex items-center gap-0.5 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-white/60 hover:text-white" title="Opmerking"><MessageSquarePlus size={10} /></button>
                        <button onClick={() => addNote(it.id, 'interesting')} className="inline-flex items-center gap-0.5 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-amber-300/70 hover:text-amber-300" title="Markeer als interessant"><Star size={10} /></button>
                        <button onClick={() => addNote(it.id, 'analyze')} className="inline-flex items-center gap-0.5 rounded bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-sky-300/70 hover:text-sky-300" title="Markeer voor analyse"><FlaskConical size={10} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {selected && <CreativeDetailPanel key={selected} creativeId={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
