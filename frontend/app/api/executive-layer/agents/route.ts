import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 0

export async function GET() {
  const admin = createAdminClient()
  const { data: agents, error } = await admin
    .from('executive_agents')
    .select('agent_key,name,role_persona,model,max_tokens,schedule_cron,enabled,last_run_at,last_run_status')
    .order('agent_key')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: runs } = await admin
    .from('executive_agent_runs')
    .select('agent_key,status,started_at,cost_usd,tokens_in,tokens_out')
    .gte('started_at', since)

  const stats: Record<string, { runs: number; completed: number; failed: number; cost_usd: number; tokens_in: number; tokens_out: number }> = {}
  for (const a of agents ?? []) stats[a.agent_key as string] = { runs: 0, completed: 0, failed: 0, cost_usd: 0, tokens_in: 0, tokens_out: 0 }
  for (const r of runs ?? []) {
    const s = stats[r.agent_key as string]
    if (!s) continue
    s.runs += 1
    if (r.status === 'completed') s.completed += 1
    if (r.status === 'failed') s.failed += 1
    s.cost_usd += Number(r.cost_usd ?? 0)
    s.tokens_in += Number(r.tokens_in ?? 0)
    s.tokens_out += Number(r.tokens_out ?? 0)
  }

  return NextResponse.json({
    agents: (agents ?? []).map(a => ({ ...a, stats_7d: stats[a.agent_key as string] })),
  })
}
