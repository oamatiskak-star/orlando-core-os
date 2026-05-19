import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

const ALL_KINDS = [
  'remix','loop','compilation','slowed','enhanced',
  'multilingual','stitched','extended','horizontal','reaction_bait',
] as const

// POST /api/media-holding/winner-extraction/extract/[id]
// Body: {
//   source: 'content_item' | 'viral_opportunity'  (default: 'content_item')
//   variant_kinds?: string[]  (default: alle 10)
//   variants_per_kind?: number (default: 1, max 10 → 100 total)
//   channel_id?: string
// }
//
// Het [id] in de URL is content_item_id (default) of viral_opportunity_id (als source='viral_opportunity').
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: sourceId } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const source = body.source === 'viral_opportunity' ? 'viral_opportunity' : 'content_item'
  const variantKinds = Array.isArray(body.variant_kinds) && body.variant_kinds.length > 0
    ? (body.variant_kinds as string[]).filter((k) => (ALL_KINDS as readonly string[]).includes(k))
    : ALL_KINDS
  const variantsPerKind = Math.max(1, Math.min(10, body.variants_per_kind ?? 1))

  const { data, error } = await supabase
    .from('orchestrator_tasks')
    .insert({
      company_id: 'modiwerijo',
      title: `Winner Extraction — ${variantKinds.length}x${variantsPerKind} variants`,
      task_type: 'winner_extract',
      executor: 'winner_extractor',
      allowed_actions: ['*'],
      priority: 4,
      status: 'open',
      objective: [`Fan-out ${variantKinds.length} types × ${variantsPerKind} = ${variantKinds.length * variantsPerKind} variants.`],
      payload: {
        ...(source === 'content_item'
          ? { source_content_item_id: sourceId }
          : { source_viral_opportunity_id: sourceId }),
        variant_kinds: variantKinds,
        variants_per_kind: variantsPerKind,
        channel_id: body.channel_id ?? null,
        persona: 'Forge',
      },
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    task_id: data.id,
    variant_kinds: variantKinds,
    variants_per_kind: variantsPerKind,
    total_variants: variantKinds.length * variantsPerKind,
  }, { status: 202 })
}
