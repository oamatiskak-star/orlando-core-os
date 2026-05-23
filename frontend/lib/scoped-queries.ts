import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompanyId } from '@/lib/active-company-server'

// React cache: deduplicates within één request, vers per nieuwe request.
const getSlugToUuidMap = cache(async (): Promise<Record<string, string>> => {
  const supabase = await createClient()
  const { data } = await supabase.from('companies').select('id, slug').not('slug', 'is', null)
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.slug) map[row.slug] = row.id
  }
  return map
})

export async function getActiveCompanyDbId(): Promise<string | null> {
  const slug = await getActiveCompanyId()
  const map = await getSlugToUuidMap()
  return map[slug] ?? null
}
