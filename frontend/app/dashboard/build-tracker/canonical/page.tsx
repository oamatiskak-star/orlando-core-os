import { ScrollText, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CanonicalTrackerView, { type TrackerDocument, type TrackerItem } from '@/components/build/CanonicalTrackerView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CanonicalTrackerPage() {
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('build_tracker_documents')
    .select('id, source_file, source_repo, source_branch, source_commit, synced_by, synced_at')
    .eq('is_current', true)
    .eq('scope', 'cross-project')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let items: TrackerItem[] = []
  if (doc) {
    const { data } = await supabase
      .from('build_tracker_items')
      .select('id, section, item_rank, title, detail, status_tag, blocker_code, owner, repo, route, evidence, deploy_allowed')
      .eq('document_id', doc.id)
      .order('section', { ascending: true })
      .order('item_rank', { ascending: true })
    items = (data ?? []) as unknown as TrackerItem[]
  }

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

      <CanonicalTrackerView document={(doc ?? null) as TrackerDocument} items={items} />
    </div>
  )
}
