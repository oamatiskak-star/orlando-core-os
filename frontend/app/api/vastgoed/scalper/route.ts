import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cls       = searchParams.get('class')
  const province  = searchParams.get('province')
  const q         = searchParams.get('q')?.trim()
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)

  const supabase = await createClient()

  // Filtered counts per class
  const baseCountQuery = () => {
    let q2 = supabase.from('deals').select('id', { count: 'exact', head: true })
    if (province) q2 = q2.eq('province', province)
    if (q) q2 = q2.or(`address.ilike.%${q}%,city.ilike.%${q}%`)
    return q2
  }

  const [countA, countB, countC, countTotal] = await Promise.all([
    baseCountQuery().is('pipeline_fase', null).eq('class', 'A'),
    baseCountQuery().is('pipeline_fase', null).eq('class', 'B'),
    baseCountQuery().is('pipeline_fase', null).eq('class', 'C'),
    baseCountQuery().is('pipeline_fase', null),
  ])

  const counts = {
    A: countA.count ?? 0,
    B: countB.count ?? 0,
    C: countC.count ?? 0,
    total: countTotal.count ?? 0,
  }

  // Province deal counts (for filter badge)
  const { data: provinceCounts } = await supabase
    .from('deals')
    .select('province')
    .is('pipeline_fase', null)
    .not('province', 'is', null)

  const provinceMap: Record<string, number> = {}
  for (const row of provinceCounts ?? []) {
    if (row.province) provinceMap[row.province] = (provinceMap[row.province] ?? 0) + 1
  }

  // Fetch deals
  let dealsQuery = supabase
    .from('deals')
    .select('id, address, city, province, asking_price, sqm, price_per_sqm, potential_profit, roi_percentage, deal_score, class, source, energy_label, funda_url, created_at')
    .is('pipeline_fase', null)
    .order('deal_score', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cls && ['A', 'B', 'C'].includes(cls)) dealsQuery = dealsQuery.eq('class', cls)
  if (province) dealsQuery = dealsQuery.eq('province', province)
  if (q) dealsQuery = dealsQuery.or(`address.ilike.%${q}%,city.ilike.%${q}%`)

  const { data, error } = await dealsQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deals: data ?? [], counts, provinceCounts: provinceMap })
}
