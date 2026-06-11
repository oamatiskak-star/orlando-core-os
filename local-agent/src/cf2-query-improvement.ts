import './ws-shim'   // MOET eerst — global WebSocket vóór @supabase (Node20)
import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { generateQueries } from './lib/query-intelligence'

/**
 * CF2.1 QUERY IMPROVEMENT LOOP (FASE 4) + HERMES VISUAL-LEARNING (FASE 8).
 *
 * Voor elke zwakke scene (needs_query_improvement / topic_relevance < 78):
 *   → Query Intelligence Engine genereert betere, intentie-gebaseerde queries
 *   → schrijft cf2_query_feedback (audittrail) + cf2_resource_candidates (status 'pending')
 * Daarna: aggregeert per niche welke query-termen structureel hoog/laag scoorden
 *   → cf2_query_learning_patterns (Hermes leert; voedt toekomstige generatie).
 *
 * GEEN re-source, GEEN nieuwe productie, GEEN publicatie. Alleen analyse + voorstel.
 * Draait NIET vanzelf: vereist CF2_QUERY_IMPROVEMENT_RUN=1.
 */

const log = (...a: unknown[]) => console.log('[cf2-query-improvement]', ...a)
function db(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
}

const STOP = new Set(['the', 'and', 'with', 'for', 'een', 'met', 'van', 'het', 'shock', 'document', 'intro', 'variant'])

/** FASE 8 — leer per niche welke termen hoog/laag scoorden (op echte topic_relevance). */
async function updateLearning(client: SupabaseClient): Promise<number> {
  const { data } = await client.from('cf2_visual_decisions')
    .select('query_used, project_id, video_projects!inner(niche), scene_id')
    .not('query_used', 'is', null)
  const rows = (data ?? []) as any[]
  if (rows.length === 0) return 0

  // topic_relevance per scene ophalen
  const { data: assets } = await client.from('visual_assets').select('scene_id, topic_relevance').not('topic_relevance', 'is', null)
  const topicByScene = new Map<string, number>((assets ?? []).map((a: any) => [a.scene_id, Number(a.topic_relevance)]))

  // per niche: woordfrequentie goed (topic>=78) vs slecht (<78)
  const perNiche = new Map<string, { good: Map<string, number[]>; bad: Map<string, number[]> }>()
  for (const r of rows) {
    const niche = r.video_projects?.niche
    const topic = r.scene_id ? topicByScene.get(r.scene_id) : undefined
    if (!niche || topic == null) continue
    const bucket = perNiche.get(niche) ?? { good: new Map(), bad: new Map() }
    const target = topic >= 78 ? bucket.good : bucket.bad
    for (const w of String(r.query_used).toLowerCase().split(/\s+/).filter((x) => x.length > 3 && !STOP.has(x))) {
      target.set(w, [...(target.get(w) ?? []), topic])
    }
    perNiche.set(niche, bucket)
  }

  let upserts = 0
  for (const [niche, b] of perNiche) {
    const goodTerms = [...b.good.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, 10).map((e) => e[0])
    const badTerms = [...b.bad.entries()].sort((x, y) => y[1].length - x[1].length).slice(0, 10).map((e) => e[0])
    const avg = (m: Map<string, number[]>) => { const all = [...m.values()].flat(); return all.length ? Math.round(all.reduce((s, n) => s + n, 0) / all.length) : null }
    const lesson = badTerms.length
      ? `Niche ${niche}: vermijd abstracte termen (${badTerms.slice(0, 3).join(', ')}); concrete onderwerpen scoren hoger (${goodTerms.slice(0, 3).join(', ') || 'niche-ankers'}).`
      : `Niche ${niche}: concrete onderwerpen werken (${goodTerms.slice(0, 3).join(', ')}).`
    await client.from('cf2_query_learning_patterns').upsert({
      niche, hook_category: null,
      good_query_terms: goodTerms, bad_query_terms: badTerms,
      evidence_count: [...b.good.values(), ...b.bad.values()].flat().length,
      avg_topic_good: avg(b.good), avg_topic_bad: avg(b.bad),
      lesson, updated_at: new Date().toISOString(),
    }, { onConflict: 'niche,hook_category' })
    upserts++
  }
  return upserts
}

export async function runQueryImprovement(): Promise<{ scenes: number; candidates: number; learned: number }> {
  const client = db()
  // zwakke scenes met context
  const { data } = await client.from('video_scenes')
    .select('id, idx, visual_intent, voice_text, search_query, visual_confidence, low_visual_confidence, project_id, video_projects!inner(niche, title)')
    .eq('needs_query_improvement', true)
  const scenes = (data ?? []) as any[]
  log(`mode=analyse · ${scenes.length} zwakke scenes · GEEN re-source/publicatie`)

  // huidige topic_relevance per scene
  const ids = scenes.map((s) => s.id)
  const { data: assets } = ids.length ? await client.from('visual_assets').select('scene_id, topic_relevance').in('scene_id', ids) : { data: [] as any[] }
  const topicByScene = new Map<string, number>((assets ?? []).map((a: any) => [a.scene_id, Number(a.topic_relevance)]))

  let candidates = 0
  for (const s of scenes) {
    const niche = s.video_projects?.niche ?? null
    const oldQuery = s.search_query || s.visual_intent || ''
    const topic = topicByScene.get(s.id) ?? null
    const r = await generateQueries({ title: s.video_projects?.title, sceneIntent: s.visual_intent, scriptText: s.voice_text, niche })
    const predicted = r.variants[0]?.score ?? null

    await client.from('cf2_query_feedback').insert({
      scene_id: s.id, project_id: s.project_id, niche,
      old_query: oldQuery, generated_query: r.best,
      generated_variants: r.variants,
      visual_confidence: s.visual_confidence, topic_relevance: topic, audit_score: topic,
      approved: null, failure_reason: topic != null && topic < 40 ? 'hard_mismatch' : 'low_topic_relevance',
    })
    await client.from('cf2_resource_candidates').insert({
      scene_id: s.id, project_id: s.project_id, niche,
      original_query: oldQuery, improved_query: r.best, improved_keywords: r.keywords,
      intent: r.variants[0]?.intent ?? null,
      current_score: topic, predicted_score: predicted, status: 'pending',
    })
    candidates++
    log(`  scene ${s.idx} (topic ${topic ?? '?'}): "${oldQuery}" → "${r.best}" (voorspeld ${predicted})`)
  }

  const learned = await updateLearning(client)
  log(`klaar — ${candidates} re-source-kandidaten (pending), ${learned} niche-patterns geleerd. GEEN re-source uitgevoerd.`)
  return { scenes: scenes.length, candidates, learned }
}

if (require.main === module && process.env.CF2_QUERY_IMPROVEMENT_RUN === '1') {
  runQueryImprovement()
    .then((r) => { console.log('[cf2-query-improvement]', JSON.stringify(r)); process.exit(0) })
    .catch((e) => { console.error('[cf2-query-improvement] error', e); process.exit(1) })
}
