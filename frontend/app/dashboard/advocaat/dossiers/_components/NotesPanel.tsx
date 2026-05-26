'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Brain, Loader2, MessageSquarePlus, RefreshCw, Send, Tag, Trash2 } from 'lucide-react'

type Note = {
  id: string
  type: string
  subject: string
  content: string
  confidence: number
  tags: string[]
  created_at: string
  updated_at: string
}

const TYPES: { key: string; label: string }[] = [
  { key: 'feit', label: 'Feit' },
  { key: 'strategie', label: 'Strategie' },
  { key: 'risico', label: 'Risico' },
  { key: 'beslissing', label: 'Beslissing' },
  { key: 'partij_info', label: 'Partij info' },
  { key: 'juridisch_standpunt', label: 'Juridisch standpunt' },
  { key: 'deadline', label: 'Deadline' },
  { key: 'tijdlijn', label: 'Tijdlijn' },
]

const TYPE_COLOR: Record<string, string> = {
  feit: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',
  strategie: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  risico: 'text-red-300 bg-red-500/10 border-red-500/30',
  beslissing: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  partij_info: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  juridisch_standpunt: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/30',
  deadline: 'text-orange-300 bg-orange-500/10 border-orange-500/30',
  tijdlijn: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
}

export function NotesPanel({ dossierId }: { dossierId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [draftType, setDraftType] = useState<string>('feit')
  const [sending, setSending] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/advocaat/dossiers/${dossierId}/notes`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setNotes(json.items)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally { setLoading(false) }
  }, [dossierId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [notes])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text) return
    setSending(true)
    try {
      const res = await fetch(`/api/advocaat/dossiers/${dossierId}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: text, type: draftType }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setDraft('')
      await load()
    } catch (e) {
      alert(`Opslaan mislukt: ${(e as Error).message}`)
    } finally { setSending(false) }
  }, [draft, draftType, dossierId, load])

  const remove = useCallback(async (noteId: string) => {
    if (!confirm('Notitie deactiveren? (Niet weggegooid, kan via DB hersteld)')) return
    try {
      const res = await fetch(`/api/advocaat/dossiers/${dossierId}/notes?note_id=${noteId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      load()
    } catch (e) { alert((e as Error).message) }
  }, [dossierId, load])

  return (
    <div className="rounded border border-indigo-500/20 bg-indigo-500/[0.03] flex flex-col h-[600px]">
      <header className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold text-white">Briefing aan AI Advocaat</h2>
          <span className="text-[10px] text-zinc-500">{notes.length} notities</span>
        </div>
        <button onClick={load} className="p-1.5 border border-white/10 rounded hover:bg-white/5"
                title="Vernieuwen">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {error && (
          <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 p-2 rounded">
            {error}
          </div>
        )}
        {!loading && notes.length === 0 && !error && (
          <div className="text-xs text-zinc-500 italic">
            Nog geen context toegevoegd. Voeg hieronder feiten, achtergrond of strategische overwegingen toe die je dossier-documenten missen. Deze worden meegenomen in elke volgende AI-analyse.
          </div>
        )}
        {notes.map(n => (
          <div key={n.id} className="p-3 rounded border border-white/10 bg-white/[0.02] group">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${TYPE_COLOR[n.type] ?? TYPE_COLOR.feit}`}>
                  {n.type}
                </span>
                <span className="text-xs text-zinc-400 truncate">{n.subject}</span>
              </div>
              <button onClick={() => remove(n.id)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 rounded text-zinc-500 hover:text-red-400"
                      title="Deactiveren">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5 text-sm text-zinc-100 whitespace-pre-wrap">{n.content}</div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
              <span>{n.created_at?.slice(0, 16) ?? ''}</span>
              {n.tags?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {n.tags.filter(t => !['user_input', 'chat_note'].includes(t)).join(', ')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 p-3 space-y-2">
        <div className="flex gap-2 flex-wrap">
          {TYPES.map(t => (
            <button key={t.key} onClick={() => setDraftType(t.key)}
                    className={`text-[10px] px-2 py-0.5 rounded border ${draftType === t.key ? TYPE_COLOR[t.key] ?? TYPE_COLOR.feit : 'text-zinc-500 border-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <textarea
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send() }}
            placeholder="Typ context die de advocaat niet uit de documenten kan halen — feiten, achtergrond, strategische keuzes, gesprekken met de wederpartij, mondelinge afspraken, alles wat je wil dat de AI meeneemt."
            rows={3}
            className="flex-1 bg-zinc-900 border border-white/10 rounded px-3 py-2 text-sm resize-y"
          />
          <button onClick={send} disabled={sending || !draft.trim()}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded text-sm flex items-center gap-2 self-stretch">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="text-[10px] text-zinc-500">
          ⌘/Ctrl + Enter om te versturen. Notities verschijnen automatisch in de volgende analyse via het geheugen.
        </div>
      </div>
    </div>
  )
}
