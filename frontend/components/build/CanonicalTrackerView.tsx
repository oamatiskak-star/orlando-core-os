'use client'

import { useState } from 'react'
import { RefreshCw, GitCommit, CheckCircle2, Clock, Ban, ListChecks, AlertTriangle } from 'lucide-react'

export type TrackerItem = {
  id: string
  section: 'A' | 'B' | 'C' | 'D' | 'E'
  item_rank: number
  title: string
  detail: string | null
  status_tag: string | null
  blocker_code: string | null
  owner: string | null
  repo: string | null
  route: string | null
  evidence: string | null
  deploy_allowed: boolean | null
}

export type TrackerDocument = {
  id: string
  source_file: string | null
  source_repo: string | null
  source_branch: string | null
  source_commit: string | null
  synced_by: string | null
  synced_at: string | null
} | null

const SECTIONS: { key: TrackerItem['section']; label: string; color: string; Icon: typeof CheckCircle2 }[] = [
  { key: 'A', label: 'Klaar en bewezen',   color: '#34d399', Icon: CheckCircle2 },
  { key: 'B', label: 'Klaar, niet live',   color: '#22d3ee', Icon: Clock },
  { key: 'C', label: 'Open blockers',      color: '#f87171', Icon: AlertTriangle },
  { key: 'D', label: 'Niet opnieuw doen',  color: '#fbbf24', Icon: Ban },
  { key: 'E', label: 'Volgende 10 acties', color: '#60a5fa', Icon: ListChecks },
]

function fmtDateTime(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function CanonicalTrackerView({ document, items, showMeta = true }: { document: TrackerDocument; items: TrackerItem[]; showMeta?: boolean }) {
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function requestSync() {
    setSyncing(true); setMsg(null)
    try {
      const res = await fetch('/api/build/tracker', { method: 'POST' })
      const j = await res.json()
      setMsg(res.ok ? 'Sync aangevraagd — host draait de parser bij de volgende cyclus.' : `Fout: ${j.error ?? 'onbekend'}`)
    } catch {
      setMsg('Fout: netwerk/host onbereikbaar.')
    } finally {
      setSyncing(false)
    }
  }

  if (!document) {
    return (
      <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
        <ListChecks size={28} className="text-white/15 mx-auto mb-3" />
        <p className="text-[12px] text-white/40">Nog geen sync van BUILD_TRACKER.md</p>
        <p className="text-[10px] text-white/25 mt-1">Draai op de host: <code className="text-white/40">npm run sync:tracker</code> (in <code className="text-white/40">local-agent/</code>)</p>
        <button onClick={requestSync} disabled={syncing}
          className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-all text-[11px] text-white/70 hover:text-white disabled:opacity-50">
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} /> Sync aanvragen
        </button>
        {msg && <p className="text-[10px] text-white/40 mt-2">{msg}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Sync-metabalk — verborgen wanneer CanonicalTrackerMeta de balk levert */}
      {showMeta && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-[10.5px] text-white/50">
            <span className="flex items-center gap-1.5">
              <GitCommit size={12} />
              <code className="text-white/70">{document.source_commit ?? '?'}</code>
              <span className="text-white/35">{document.source_branch ? `(${document.source_branch})` : ''}</span>
            </span>
            <span>{document.source_repo ?? document.source_file}</span>
            <span className="flex items-center gap-1.5"><Clock size={12} /> laatste sync {fmtDateTime(document.synced_at)} · {document.synced_by ?? '?'}</span>
            <button onClick={requestSync} disabled={syncing}
              className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] transition-all text-white/65 hover:text-white disabled:opacity-50">
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> Sync aanvragen
            </button>
          </div>
          {msg && <p className="text-[10px] text-white/45 -mt-3 px-1">{msg}</p>}
        </>
      )}

      {SECTIONS.map(({ key, label, color, Icon }) => {
        const secItems = items.filter((i) => i.section === key)
        return (
          <div key={key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color }}>
                <Icon size={13} /> {key}. {label}
              </span>
              <span className="text-[10px] text-white/35">{secItems.length}</span>
            </div>
            {secItems.length === 0 ? (
              <p className="text-[10.5px] text-white/30 pl-1">—</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {secItems.map((it) => (
                  <div key={it.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3"
                    style={{ borderLeft: `2px solid ${color}66` }}>
                    <div className="flex items-start gap-2">
                      {it.blocker_code && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ background: `${color}26`, color }}>{it.blocker_code}</span>
                      )}
                      <p className="text-[12px] text-white/90 font-medium leading-tight">{it.title}</p>
                    </div>
                    {it.detail && <p className="text-[10px] text-white/50 mt-1 leading-snug line-clamp-3">{it.detail}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-[9.5px] text-white/45">
                      {it.status_tag && <span className="px-1.5 py-0.5 rounded bg-white/[0.06]">{it.status_tag}</span>}
                      {it.owner && <span>👤 {it.owner}</span>}
                      {it.repo && <span>📦 {it.repo}</span>}
                      {it.route && <code className="text-white/40">{it.route}</code>}
                      {it.deploy_allowed === true && <span className="text-emerald-400">deploy: ja</span>}
                      {it.deploy_allowed === false && <span className="text-red-400">deploy: nee</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
