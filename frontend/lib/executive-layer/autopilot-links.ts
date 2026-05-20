import type { SupabaseClient } from '@supabase/supabase-js'

export type LinkRunResult = { link_key: string; triggered: number; skipped: number; reason?: string }

export async function runAllAutopilotLinks(admin: SupabaseClient): Promise<LinkRunResult[]> {
  const { data: configs } = await admin
    .from('autopilot_config')
    .select('link_key,enabled,threshold')
    .in('link_key', [
      'breakout_to_clone',
      'scale_ready_to_amplify',
      'terminated_to_pause',
      'winner_to_language_expansion',
      'recommendation_to_task',
    ])

  const enabled = new Map<string, number>()
  for (const c of configs ?? []) {
    if (c.enabled) enabled.set(c.link_key as string, Number(c.threshold ?? 0))
  }

  const results: LinkRunResult[] = []

  for (const link_key of ['breakout_to_clone', 'scale_ready_to_amplify', 'terminated_to_pause', 'winner_to_language_expansion', 'recommendation_to_task']) {
    if (!enabled.has(link_key)) {
      results.push({ link_key, triggered: 0, skipped: 0, reason: 'disabled' })
      continue
    }
    const threshold = enabled.get(link_key)!
    let result: LinkRunResult
    switch (link_key) {
      case 'breakout_to_clone':
        result = await runBreakoutToClone(admin)
        break
      case 'scale_ready_to_amplify':
        result = await runScaleReadyToAmplify(admin)
        break
      case 'terminated_to_pause':
        result = await runTerminatedToPause(admin)
        break
      case 'winner_to_language_expansion':
        result = await runWinnerToLanguageExpansion(admin, threshold)
        break
      case 'recommendation_to_task':
        result = await runRecommendationToTask(admin)
        break
      default:
        result = { link_key, triggered: 0, skipped: 0, reason: 'unknown' }
    }
    results.push(result)
  }

  return results
}

async function runBreakoutToClone(admin: SupabaseClient): Promise<LinkRunResult> {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: alerts } = await admin
    .from('executive_alerts')
    .select('id,target_id,payload,detected_at')
    .eq('alert_kind', 'breakout')
    .eq('severity', 'critical')
    .gte('detected_at', since)

  if (!alerts || alerts.length === 0) return { link_key: 'breakout_to_clone', triggered: 0, skipped: 0 }

  let triggered = 0
  for (const a of alerts) {
    const contentItemId = a.target_id as string | null
    if (!contentItemId) continue

    const { data: existing } = await admin
      .from('winner_extraction_jobs')
      .select('id')
      .eq('source_content_id', contentItemId)
      .gte('created_at', since)
      .limit(1)
    if (existing && existing.length > 0) continue

    const { error } = await admin.from('winner_extraction_jobs').insert({
      source_content_id: contentItemId,
      variant_kind: 'remix',
      status: 'queued',
    })
    if (!error) {
      triggered += 1
      await admin.from('autopilot_events').insert({
        link_key: 'breakout_to_clone',
        source_table: 'executive_alerts',
        source_id: a.id,
        target_executor: 'winner_extractor',
        details: { content_item_id: contentItemId },
      })
    }
  }
  return { link_key: 'breakout_to_clone', triggered, skipped: alerts.length - triggered }
}

async function runScaleReadyToAmplify(admin: SupabaseClient): Promise<LinkRunResult> {
  const { data: decisions } = await admin
    .from('executive_decisions')
    .select('id,channel_id,decided_at,status')
    .eq('status', 'scale_ready')
    .gte('decided_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())

  if (!decisions || decisions.length === 0) return { link_key: 'scale_ready_to_amplify', triggered: 0, skipped: 0 }

  let triggered = 0
  const seen = new Set<string>()
  for (const d of decisions) {
    const cid = d.channel_id as string
    if (seen.has(cid)) continue
    seen.add(cid)

    const { data: channel } = await admin
      .from('media_holding_channels')
      .select('upload_strategy')
      .eq('id', cid)
      .single()
    if (!channel) continue

    const strategy = (channel.upload_strategy as Record<string, unknown>) ?? {}
    const shortsPerDay = Number((strategy.shorts_per_day as number) ?? 1)
    const newShortsPerDay = Math.min(shortsPerDay + 1, 6)
    if (newShortsPerDay === shortsPerDay) continue

    const newStrategy = { ...strategy, shorts_per_day: newShortsPerDay }
    const { error } = await admin
      .from('media_holding_channels')
      .update({ upload_strategy: newStrategy, updated_at: new Date().toISOString() })
      .eq('id', cid)
    if (!error) {
      triggered += 1
      await admin.from('autopilot_events').insert({
        link_key: 'scale_ready_to_amplify',
        source_table: 'executive_decisions',
        source_id: d.id,
        target_executor: 'media-holding-channels',
        details: { channel_id: cid, from: shortsPerDay, to: newShortsPerDay },
      })
    }
  }
  return { link_key: 'scale_ready_to_amplify', triggered, skipped: decisions.length - triggered }
}

async function runTerminatedToPause(admin: SupabaseClient): Promise<LinkRunResult> {
  const { data: decisions } = await admin
    .from('executive_decisions')
    .select('id,channel_id,decided_at')
    .eq('status', 'terminated')
    .gte('decided_at', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString())

  if (!decisions || decisions.length === 0) return { link_key: 'terminated_to_pause', triggered: 0, skipped: 0 }

  let triggered = 0
  const seen = new Set<string>()
  for (const d of decisions) {
    const cid = d.channel_id as string
    if (seen.has(cid)) continue
    seen.add(cid)

    const { data: channel } = await admin
      .from('media_holding_channels')
      .select('status')
      .eq('id', cid)
      .single()
    if (!channel || channel.status === 'paused' || channel.status === 'killed') continue

    const { error } = await admin
      .from('media_holding_channels')
      .update({ status: 'paused', updated_at: new Date().toISOString() })
      .eq('id', cid)
    if (!error) {
      triggered += 1
      await admin.from('autopilot_events').insert({
        link_key: 'terminated_to_pause',
        source_table: 'executive_decisions',
        source_id: d.id,
        target_executor: 'media-holding-channels',
        details: { channel_id: cid, from: channel.status, to: 'paused' },
      })
    }
  }
  return { link_key: 'terminated_to_pause', triggered, skipped: decisions.length - triggered }
}

async function runWinnerToLanguageExpansion(admin: SupabaseClient, threshold: number): Promise<LinkRunResult> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: metrics } = await admin
    .from('media_holding_metrics')
    .select('content_item_id,views,snapshot_at')
    .gte('snapshot_at', since)
    .gte('views', threshold)
    .order('views', { ascending: false })
    .limit(20)

  if (!metrics || metrics.length === 0) return { link_key: 'winner_to_language_expansion', triggered: 0, skipped: 0 }

  let triggered = 0
  const seenItems = new Set<string>()
  for (const m of metrics) {
    const itemId = m.content_item_id as string
    if (!itemId || seenItems.has(itemId)) continue
    seenItems.add(itemId)

    const { data: existing } = await admin
      .from('language_expansion_targets')
      .select('id')
      .eq('content_item_id', itemId)
      .limit(1)
    if (existing && existing.length > 0) continue

    const targets = ['en', 'es', 'de'].map(lang => ({
      content_item_id: itemId,
      target_lang: lang,
      status: 'queued' as const,
    }))
    const { error } = await admin.from('language_expansion_targets').insert(targets)
    if (!error) {
      triggered += targets.length
      await admin.from('autopilot_events').insert({
        link_key: 'winner_to_language_expansion',
        source_table: 'media_holding_metrics',
        source_id: itemId,
        target_executor: 'language_expander',
        details: { content_item_id: itemId, langs: ['en', 'es', 'de'] },
      })
    }
  }
  return { link_key: 'winner_to_language_expansion', triggered, skipped: metrics.length - seenItems.size }
}

async function runRecommendationToTask(admin: SupabaseClient): Promise<LinkRunResult> {
  const { data: recs } = await admin
    .from('executive_recommendations')
    .select('id,action_kind,target_kind,target_id,priority,rationale,payload')
    .eq('status', 'approved')
    .is('executed_at', null)
    .order('priority', { ascending: false })
    .limit(20)

  if (!recs || recs.length === 0) return { link_key: 'recommendation_to_task', triggered: 0, skipped: 0 }

  const executorMap: Record<string, string> = {
    clone_winner: 'winner_extractor',
    amplify_variant: 'winner_extractor',
    create_variant_wave: 'winner_extractor',
    launch_expansion: 'language_expander',
    push_variants: 'content_factory',
    generate_better_hook: 'content_factory',
    increase_upload_frequency: 'media-holding-channels',
    increase_production: 'content_factory',
    scale_channel: 'media-holding-channels',
    pause_channel: 'media-holding-channels',
    launch_swarm: 'content_factory',
    activate_swarm_mode: 'content_factory',
    launch_new_channel: 'media-holding-channels',
  }

  let triggered = 0
  for (const r of recs) {
    const executor = executorMap[r.action_kind as string]
    if (!executor) continue
    const { error } = await admin.from('orchestrator_tasks').insert({
      title: `Executive recommendation: ${r.action_kind}`,
      task_type: 'executive_action',
      executor,
      priority: r.priority ?? 3,
      status: 'open',
      objective: r.rationale ?? `Auto-dispatched from executive_recommendation ${r.id}`,
      payload: {
        recommendation_id: r.id,
        action_kind: r.action_kind,
        target_kind: r.target_kind,
        target_id: r.target_id,
        ...(r.payload as Record<string, unknown> ?? {}),
      },
    })
    if (!error) {
      triggered += 1
      await admin.from('executive_recommendations').update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        executed_by: 'autopilot:recommendation_to_task',
      }).eq('id', r.id)
      await admin.from('autopilot_events').insert({
        link_key: 'recommendation_to_task',
        source_table: 'executive_recommendations',
        source_id: r.id,
        target_executor: executor,
        details: { action_kind: r.action_kind },
      })
    }
  }
  return { link_key: 'recommendation_to_task', triggered, skipped: recs.length - triggered }
}
