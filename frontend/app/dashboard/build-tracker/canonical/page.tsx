import { ScrollText, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CanonicalTrackerView, { type TrackerDocument, type TrackerItem } from '@/components/build/CanonicalTrackerView'
import CanonicalTrackerMeta from '@/components/build/CanonicalTrackerMeta'
import { getCanonicalSnapshot, CANONICAL_SCOPES, getScope } from '@/lib/canonical-tracker'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CanonicalTrackerPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>
}) {
  const { scope } = await searchParams
  const supabase = await createClient()

  const activeScope = scope && getScope(scope) ? scope : undefined
  const snap = await getCanonicalSnapshot(supabase, activeScope ? [activeScope] : [])

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/build-tracker" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.05] border border-white/[0.08] text-white/70">
          <ScrollText size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Canonieke Tracker</h1>
          <p className="text-xs text-white/50">BUILD_TRACKER.md — Single Source of Truth (Aquier + Orlando Core OS)</p>
        </div>
      </div>

      <CanonicalTrackerMeta
        document={snap.document}
        counts={snap.counts}
        scopeLabel={activeScope ? getScope(activeScope)?.label : undefined}
      />

      {/* Module-scope deeplinks (gefilterde weergaven op canonieke items) */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href="/dashboard/build-tracker/canonical"
          className={`text-[10.5px] px-2.5 py-1 rounded-md border transition-all ${
            !activeScope ? 'bg-white/[0.08] border-white/15 text-white' : 'bg-white/[0.03] border-white/[0.06] text-white/55 hover:text-white'
          }`}
        >
          Alles (cross-project)
        </Link>
        {CANONICAL_SCOPES.map((s) => (
          <Link
            key={s.key}
            href={`/dashboard/build-tracker/canonical?scope=${s.key}`}
            className={`text-[10.5px] px-2.5 py-1 rounded-md border transition-all ${
              activeScope === s.key ? 'bg-white/[0.08] border-white/15 text-white' : 'bg-white/[0.03] border-white/[0.06] text-white/55 hover:text-white'
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {activeScope && snap.items.length === 0 ? (
        <p className="text-[11px] text-white/35 py-8 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          Geen gekoppelde canonieke items voor scope &quot;{getScope(activeScope)?.label}&quot;.
        </p>
      ) : (
        <CanonicalTrackerView
          document={snap.document as TrackerDocument}
          items={snap.items as unknown as TrackerItem[]}
          showMeta={false}
        />
      )}
    </div>
  )
}
