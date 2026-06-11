import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'
import TimelineView from '@/components/build-war-room/TimelineView'

export const dynamic = 'force-dynamic'

export default async function BuildTimelinePage() {
  const supabase = await createClient()
  const slug = await getActiveCompanyId()
  const { data, error } = await supabase.from('v_build_timeline').select('*').eq('entity_slug', slug).order('ts', { ascending: false })
  if (error) {
    return <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">Kon timeline niet laden: {error.message}</div>
  }
  return <TimelineView events={(data ?? []) as never[]} />
}
