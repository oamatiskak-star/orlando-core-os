import { GitCommit, Clock, ListChecks, Ban, Database } from 'lucide-react'
import CanonicalTrackerRefreshButton from './CanonicalTrackerRefreshButton'
import type { CanonicalDocument, CanonicalCounts } from '@/lib/canonical-tracker'

function fmtDateTime(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// Canonieke metadata-balk: bron, laatste sync, items, conflicts + refresh-knop.
// Verschijnt op elke Build Tracker-weergave (canoniek + per-BV).
export default function CanonicalTrackerMeta({
  document,
  counts,
  scopeLabel,
  recompute = false,
}: {
  document: CanonicalDocument
  counts: CanonicalCounts
  scopeLabel?: string
  recompute?: boolean
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-white/50">
        <span className="flex items-center gap-1.5 text-white/65">
          <Database size={12} /> Canonical source: <code className="text-white/80">BUILD_TRACKER.md</code>
        </span>
        {scopeLabel && (
          <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white/60">scope: {scopeLabel}</span>
        )}
        <span className="flex items-center gap-1.5">
          <GitCommit size={12} />
          <code className="text-white/70">{document?.source_commit ?? '?'}</code>
          <span className="text-white/35">{document?.source_branch ? `(${document.source_branch})` : ''}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock size={12} /> Last sync {fmtDateTime(document?.synced_at ?? null)}
          {document?.synced_by ? ` · ${document.synced_by}` : ''}
        </span>
        <span className="flex items-center gap-1.5">
          <ListChecks size={12} /> Items <span className="text-white/75">{counts.items_count}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Ban size={12} /> Conflicts <span className="text-white/75">{counts.conflicts_count}</span>
        </span>
        <span className="ml-auto">
          <CanonicalTrackerRefreshButton recompute={recompute} />
        </span>
      </div>
    </div>
  )
}
