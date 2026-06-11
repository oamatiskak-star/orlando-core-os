import { createClient } from '@/lib/supabase/server'
import ConsolidationPanel from '@/components/build-war-room/ConsolidationPanel'

export const dynamic = 'force-dynamic'

export default async function BuildConsolidationPage() {
  const supabase = await createClient()
  const [entRes, candRes, progRes] = await Promise.all([
    supabase.from('companies').select('slug,name').not('slug', 'is', null).order('name'),
    supabase.from('build_duplicate_candidates').select('*').eq('status', 'pending').order('confidence', { ascending: false }).limit(100),
    supabase.from('build_programs').select('id,entity_id,label,description,is_proposed').order('sort_order'),
  ])

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/45">
        Consolidation-engine — voegt meerdere businessplannen/roadmaps per entiteit samen tot één master-roadmap.
        AI doet alléén voorstellen (propose-only); jij beslist. Lage-confidence voorstellen zijn gemarkeerd.
      </p>
      <ConsolidationPanel
        entities={(entRes.data ?? []) as never[]}
        candidates={(candRes.data ?? []) as never[]}
        programs={(progRes.data ?? []) as never[]}
      />
    </div>
  )
}
