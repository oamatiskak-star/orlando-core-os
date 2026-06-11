import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createClient } from '@/lib/supabase/server'
import { claude } from '@/lib/ai/client'

export const revalidate = 0
export const maxDuration = 60

type Cand = { item_a_id: string; item_b_id: string; item_a_title: string; item_b_title: string; similarity: number }

// Consolidation-engine — PROPOSE ONLY (aanscherping 3).
// AI doet voorstellen (duplicaten + programma's); mergt NOOIT automatisch.
// Bij ontbrekende/defecte AI (Anthropic €0) → deterministische pg_trgm-fallback.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const entity: string = (body?.entity ?? 'all').toString()

  // entity → company_id (null bij 'all')
  let entityId: string | null = null
  if (entity !== 'all') {
    const { data: c } = await supabase.from('companies').select('id').eq('slug', entity).maybeSingle()
    entityId = c?.id ?? null
  }

  // deterministische kandidaten (server-side pg_trgm)
  const { data: candData, error: candErr } = await supabase
    .rpc('build_consolidation_candidates', { p_entity: entity, p_threshold: 0.45 })
  if (candErr) return NextResponse.json({ error: candErr.message }, { status: 500 })
  const candidates = (candData ?? []) as Cand[]

  // run-rij aanmaken
  const { data: run, error: runErr } = await supabase
    .from('build_consolidation_runs')
    .insert({ entity_id: entityId, status: 'ok', detail: { entity } })
    .select('id').single()
  if (runErr) return NextResponse.json({ error: runErr.message }, { status: 500 })
  const runId = run.id

  let status: 'ok' | 'deterministic_fallback' = 'ok'
  let model: string | null = null
  let aiVerdicts: Record<string, { is_duplicate: boolean; confidence: number; merge_title: string; program: string }> = {}
  let proposedPrograms: { label: string; description: string }[] = []

  // ── AI-pad (propose-only) ─────────────────────────────────────────────────
  if (candidates.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      const list = candidates.slice(0, 20)
        .map((c, i) => `${i}. "${c.item_a_title}"  ⟷  "${c.item_b_title}" (trgm=${c.similarity})`).join('\n')
      const prompt =
`Je consolideert de build-roadmap van entiteit "${entity}". Hieronder kandidaat-paren van mogelijk
overlappende/duplicate roadmap-items (trgm = tekstsimilariteit). Beoordeel per paar of het echt
hetzelfde doel is, en stel optioneel master-programma's voor die items groeperen.
Antwoord UITSLUITEND met JSON, exact dit schema, geen extra tekst:
{"pairs":[{"index":0,"is_duplicate":true,"confidence":0.0,"merge_title":"...","program":"..."}],
 "programs":[{"label":"AQUIER MASTER ROADMAP","description":"..."}]}

Paren:
${list}`
      const { text } = await generateText({
        model: claude.sonnet, maxOutputTokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      })
      const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
      for (const p of json.pairs ?? []) {
        const c = list ? candidates[p.index] : undefined
        if (!c) continue
        aiVerdicts[`${c.item_a_id}|${c.item_b_id}`] = {
          is_duplicate: !!p.is_duplicate,
          confidence: Number(p.confidence) || c.similarity,
          merge_title: p.merge_title ?? '',
          program: p.program ?? '',
        }
      }
      proposedPrograms = (json.programs ?? []).slice(0, 6)
        .map((p: { label?: string; description?: string }) => ({ label: p.label ?? 'Programma', description: p.description ?? '' }))
      model = 'claude-sonnet-4-6'
    } catch {
      status = 'deterministic_fallback' // o.a. Anthropic €0 → nooit hard falen
    }
  } else if (candidates.length > 0) {
    status = 'deterministic_fallback'
  }

  // ── kandidaten wegschrijven (altijd PENDING — geen auto-merge) ─────────────
  const rows = candidates.map((c) => {
    const v = aiVerdicts[`${c.item_a_id}|${c.item_b_id}`]
    return {
      run_id: runId, entity_id: entityId,
      item_a_id: c.item_a_id, item_b_id: c.item_b_id,
      item_a_title: c.item_a_title, item_b_title: c.item_b_title,
      similarity: c.similarity,
      confidence: v ? v.confidence : c.similarity,
      source_reason: v ? 'ai' : 'title_fuzzy',
      ai_verdict: v ? (v.is_duplicate ? 'duplicate' : 'distinct') : null,
      proposed_merge_title: v?.merge_title || null,
      proposed_program: v?.program || null,
      status: 'pending' as const,
    }
  })
  if (rows.length > 0) await supabase.from('build_duplicate_candidates').insert(rows)

  // ── programma-voorstellen (is_proposed=true; NIET aan projecten gekoppeld) ─
  let programsInserted = 0
  if (entityId && proposedPrograms.length > 0) {
    const pr = proposedPrograms.map((p, i) => ({
      entity_id: entityId, program_key: p.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60),
      label: p.label, description: p.description, is_proposed: true, sort_order: i,
      source_docs: JSON.stringify([{ via: 'consolidation', run: runId }]),
    }))
    const { data: ins } = await supabase.from('build_programs')
      .upsert(pr, { onConflict: 'entity_id,program_key', ignoreDuplicates: true }).select('id')
    programsInserted = ins?.length ?? 0
  }

  await supabase.from('build_consolidation_runs').update({
    status, model,
    duplicates_found: rows.filter((r) => r.ai_verdict === 'duplicate' || (!r.ai_verdict && r.similarity >= 0.6)).length,
    merges_proposed: programsInserted,
    detail: { entity, candidates: rows.length, programs_proposed: programsInserted, ai: status === 'ok' },
  }).eq('id', runId)

  return NextResponse.json({
    run_id: runId, status, model,
    candidates: rows.length, programs_proposed: programsInserted,
    note: status === 'deterministic_fallback'
      ? 'AI niet beschikbaar — deterministische pg_trgm-voorstellen (propose-only).'
      : 'AI-voorstellen aangemaakt (propose-only, status pending).',
  })
}
