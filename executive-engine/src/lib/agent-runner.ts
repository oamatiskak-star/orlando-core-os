import { supabase } from './supabase'
import { anthropic, estimateCostUsd, extractJson } from './anthropic'
import { logger } from './logger'
import type { AgentDefinition, AgentKey, RecommendationDraft, ReportKind } from './types'

export type RunOptions = {
  agentKey: AgentKey
  scope?: Record<string, unknown>
  inputSnapshot: Record<string, unknown>
  userPrompt: string
}

export type RunResult = {
  runId: string
  output: Record<string, unknown>
  rawText: string
  tokensIn: number
  tokensOut: number
  costUsd: number
}

export async function loadAgent(agentKey: AgentKey): Promise<AgentDefinition> {
  const { data, error } = await supabase
    .from('executive_agents')
    .select('agent_key,name,role_persona,system_prompt,model,max_tokens,enabled')
    .eq('agent_key', agentKey)
    .single()
  if (error || !data) throw new Error(`Agent ${agentKey} not found: ${error?.message}`)
  return data as AgentDefinition
}

export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const agent = await loadAgent(opts.agentKey)
  if (!agent.enabled) {
    logger.warn(`Agent ${opts.agentKey} disabled — skipping`)
    throw new Error(`Agent ${opts.agentKey} disabled`)
  }

  const { data: runRow, error: insertErr } = await supabase
    .from('executive_agent_runs')
    .insert({
      agent_key: opts.agentKey,
      status: 'running',
      input_snapshot: opts.inputSnapshot,
      scope: opts.scope ?? {},
    })
    .select('id')
    .single()
  if (insertErr || !runRow) throw new Error(`Failed to insert run: ${insertErr?.message}`)
  const runId = runRow.id as string

  await supabase
    .from('executive_agents')
    .update({ last_run_at: new Date().toISOString(), last_run_status: 'running' })
    .eq('agent_key', opts.agentKey)

  try {
    const response = await anthropic.messages.create({
      model: agent.model,
      max_tokens: agent.max_tokens,
      system: agent.system_prompt,
      messages: [{ role: 'user', content: opts.userPrompt }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const tokensIn = response.usage.input_tokens
    const tokensOut = response.usage.output_tokens
    const costUsd = estimateCostUsd(agent.model, tokensIn, tokensOut)

    let output: Record<string, unknown> = {}
    try {
      output = extractJson<Record<string, unknown>>(rawText)
    } catch (parseErr) {
      logger.warn(`Agent ${opts.agentKey} returned non-JSON output`, { runId, parseErr })
      output = { raw: rawText }
    }

    await supabase
      .from('executive_agent_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'completed',
        output,
        tokens_in: tokensIn,
        tokens_out: tokensOut,
        cost_usd: costUsd,
      })
      .eq('id', runId)

    await supabase
      .from('executive_agents')
      .update({ last_run_status: 'completed' })
      .eq('agent_key', opts.agentKey)

    logger.info(`Agent ${opts.agentKey} completed`, { runId, tokensIn, tokensOut, costUsd: costUsd.toFixed(4) })
    return { runId, output, rawText, tokensIn, tokensOut, costUsd }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('executive_agent_runs')
      .update({ finished_at: new Date().toISOString(), status: 'failed', error: message })
      .eq('id', runId)
    await supabase
      .from('executive_agents')
      .update({ last_run_status: 'failed' })
      .eq('agent_key', opts.agentKey)
    logger.error(`Agent ${opts.agentKey} failed`, { runId, message })
    throw err
  }
}

export async function persistReport(input: {
  reportKind: ReportKind
  periodStart: Date
  periodEnd: Date
  title: string
  summaryMd: string
  sections: unknown[]
  generatedByAgent: AgentKey
  generatedRunId: string
  scope?: Record<string, unknown>
}): Promise<string> {
  const { data, error } = await supabase
    .from('executive_reports')
    .insert({
      report_kind: input.reportKind,
      period_start: input.periodStart.toISOString(),
      period_end: input.periodEnd.toISOString(),
      title: input.title,
      summary_md: input.summaryMd,
      sections: input.sections,
      generated_by_agent: input.generatedByAgent,
      generated_run_id: input.generatedRunId,
      scope: input.scope ?? {},
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`Failed to persist report: ${error?.message}`)
  return data.id as string
}

export async function persistRecommendations(
  reportId: string,
  recs: RecommendationDraft[]
): Promise<number> {
  if (recs.length === 0) return 0
  const rows = recs.map(r => ({
    report_id: reportId,
    action_kind: r.action_kind,
    target_kind: r.target_kind,
    target_id: r.target_id ?? null,
    priority: Math.max(1, Math.min(5, Math.round(r.priority))),
    rationale: r.rationale,
    payload: r.payload ?? {},
  }))
  const { error } = await supabase.from('executive_recommendations').insert(rows)
  if (error) throw new Error(`Failed to persist recommendations: ${error.message}`)
  return rows.length
}
