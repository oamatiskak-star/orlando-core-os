'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, FileText, Inbox, Link2, Loader2, RefreshCw, Sparkles, X } from 'lucide-react'

type DilDoc = {
  id: string
  local_path: string | null
  source: string
  classification_path: string | null
  confidence: number | null
  summary: string | null
  state: string
  page_count: number | null
  created_at: string
  synced_at: string
  mail_message_id?: string | null
  entities?: Record<string, unknown> | null
}

type Payload = {
  dossier: { id: string; title: string; wederpartij: string | null }
  linked: DilDoc[]
  suggested: DilDoc[]
}

const TAX_COLOR: Record<string, string> = {
  LEGAL: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  ADMINISTRATIE: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  MAIL: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  OVERIG: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
}

function taxonomyClass(path: string | null): string {
  if (!path) return TAX_COLOR.OVERIG
  const top = path.split('/', 1)[0]
  return TAX_COLOR[top] ?? TAX_COLOR.OVERIG
}

export function DilDocumentsPanel({ dossierId }: { dossierId: string }) {
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/advocaat/dossiers/${dossierId}/dil-documents`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [dossierId])

  useEffect(() => { load() }, [load])

  const link = useCallback(async (dilId: string) => {
    setLinking(dilId)
    try {
      const res = await fetch(`/api/advocaat/dossiers/${dossierId}/dil-documents`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dil_document_id: dilId }),
      })
      const json = await res.json()
      if (!res.ok && res.status !== 207) throw new Error(json.error ?? `HTTP ${res.status}`)
      await load()
    } catch (e) {
      alert(`Koppelen mislukt: ${(e as Error).message}`)
    } finally {
      setLinking(null)
    }
  }, [dossierId, load])

  const unlink = useCallback(async (dilId: string) => {
    if (!confirm('Document loskoppelen van dossier?')) return
    try {
      const res = await fetch(
        `/api/advocaat/dossiers/${dossierId}/dil-documents?dil_document_id=${dilId}`,
        { method: 'DELETE' },
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      await load()
    } catch (e) {
      alert(`Loskoppelen mislukt: ${(e as Error).message}`)
    }
  }, [dossierId, load])

  return (
    <div className="p-4 rounded border border-purple-500/20 bg-purple-500/[0.03] space-y-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Centraal ingelezen documenten (DIL)</h2>
        </div>
        <button onClick={load} className="p-1.5 border border-white/10 rounded hover:bg-white/5"
                title="Vernieuwen">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {error && (
        <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 p-2 rounded">
          {error}
        </div>
      )}

      <section>
        <div className="text-xs uppercase text-zinc-400 mb-2 flex items-center gap-2">
          <CheckCircle className="w-3 h-3" /> Gekoppeld ({data?.linked.length ?? 0})
        </div>
        {(!data || data.linked.length === 0) && !loading && (
          <div className="text-xs text-zinc-500">Nog niets gekoppeld.</div>
        )}
        <div className="space-y-2">
          {data?.linked.map(d => (
            <DocRow key={d.id} doc={d} variant="linked" onAction={() => unlink(d.id)} actionLoading={false} />
          ))}
        </div>
      </section>

      <section>
        <div className="text-xs uppercase text-zinc-400 mb-2 flex items-center gap-2">
          <Sparkles className="w-3 h-3" /> Voorgestelde matches ({data?.suggested.length ?? 0})
        </div>
        {(!data || data.suggested.length === 0) && !loading && (
          <div className="text-xs text-zinc-500">
            Geen ongekoppelde LEGAL documenten gevonden die matchen op wederpartij of e-mail.
          </div>
        )}
        <div className="space-y-2">
          {data?.suggested.map(d => (
            <DocRow
              key={d.id}
              doc={d}
              variant="suggested"
              onAction={() => link(d.id)}
              actionLoading={linking === d.id}
            />
          ))}
        </div>
      </section>

      <footer className="text-[10px] text-zinc-500 pt-2 border-t border-white/5">
        Documenten worden centraal ingelezen via scan-inbox, mail-bijlagen of upload-portaal. Classificatie via Claude Sonnet/Haiku, embeddings via sentence-transformers. Auto-link draait elke 5 minuten op nieuwe LEGAL/* documenten.
      </footer>
    </div>
  )
}

function DocRow({
  doc, variant, onAction, actionLoading,
}: {
  doc: DilDoc
  variant: 'linked' | 'suggested'
  onAction: () => void
  actionLoading: boolean
}) {
  const name = doc.local_path?.split('/').pop() ?? doc.id
  const conf = doc.confidence != null ? Math.round(doc.confidence * 100) : null
  const tax = doc.classification_path ?? 'OVERIG/onbekend'

  return (
    <div className="p-3 rounded border border-white/10 bg-white/[0.02] hover:bg-white/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-sm text-white truncate">{name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${taxonomyClass(tax)}`}>{tax}</span>
            {conf != null && <span className="text-[10px] text-zinc-500">{conf}%</span>}
          </div>
          {doc.summary && (
            <div className="text-xs text-zinc-300 mt-1 line-clamp-2">{doc.summary}</div>
          )}
          <div className="text-[10px] text-zinc-500 mt-1 flex gap-3">
            <span>bron: {doc.source}</span>
            {doc.page_count != null && <span>{doc.page_count} pag.</span>}
            <span>{doc.synced_at?.slice(0, 16) ?? doc.created_at.slice(0, 16)}</span>
          </div>
        </div>
        <button
          onClick={onAction}
          disabled={actionLoading}
          className={`shrink-0 text-xs px-2.5 py-1 rounded flex items-center gap-1 ${
            variant === 'linked'
              ? 'border border-white/10 text-zinc-400 hover:text-red-300 hover:border-red-500/30'
              : 'bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50'
          }`}
        >
          {actionLoading
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : variant === 'linked'
              ? <><X className="w-3 h-3" /> Loskoppelen</>
              : <><Link2 className="w-3 h-3" /> Koppel</>}
        </button>
      </div>
    </div>
  )
}
