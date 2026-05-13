import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required')
    _client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _client
}

export interface PlanningTask {
  id: string
  sprint_id: string | null
  milestone_id: string | null
  naam: string
  description: string | null
  agent_type: string | null
  assigned_to: string | null
  machine: string | null
  status: string
  priority: number
  estimated_hours: number | null
  actual_hours: number | null
  start_date: string | null
  due_date: string | null
  completed_at: string | null
  dependencies: string[]
  tags: string[]
  clickup_task_id: string | null
  roi_score: number | null
}

export interface DailyPlan {
  id: string
  plan_date: string
  generated_at: string
  status: string
  agent_missions: Record<string, unknown>
  build_schedule: unknown[]
  critical_path: unknown[]
  revenue_tasks: unknown[]
  deployment_schedule: unknown[]
  completion_pct: number
}

export async function getActiveSprint() {
  const db = getSupabase()
  const { data } = await db
    .from('oc_planning_sprints')
    .select('*')
    .eq('status', 'active')
    .single()
  return data
}

export async function getTodaysPlan(): Promise<DailyPlan | null> {
  const db = getSupabase()
  const today = new Date().toISOString().split('T')[0]
  const { data } = await db
    .from('oc_daily_plans')
    .select('*')
    .eq('plan_date', today)
    .eq('status', 'active')
    .single()
  return data
}

export async function saveDailyPlan(plan: Omit<DailyPlan, 'id' | 'generated_at'>): Promise<void> {
  const db = getSupabase()
  const today = new Date().toISOString().split('T')[0]

  await db.from('oc_daily_plans')
    .update({ status: 'superseded' })
    .eq('plan_date', today)
    .eq('status', 'active')

  await db.from('oc_daily_plans').insert({
    ...plan,
    plan_date: today,
    generated_at: new Date().toISOString(),
    status: 'active',
  })
}

export async function logBottleneck(bottleneck: {
  bottleneck_type: string
  severity: string
  affected_task_id?: string
  description: string
}): Promise<void> {
  const db = getSupabase()
  await db.from('oc_planning_bottlenecks').insert({
    ...bottleneck,
    detected_at: new Date().toISOString(),
  })
}

export async function logSync(entry: {
  machine: string
  sync_type: string
  status: string
  branch?: string
  commit_hash?: string
  details?: Record<string, unknown>
  error?: string
  duration_ms?: number
}): Promise<void> {
  const db = getSupabase()
  await db.from('oc_system_sync_log').insert({
    ...entry,
    created_at: new Date().toISOString(),
  })
}

export async function recordWorkload(entry: {
  machine: string
  agent_slug?: string
  cpu_pct?: number
  ram_pct?: number
  active_tasks?: number
  queue_depth?: number
  tokens_per_hour?: number
  status?: string
}): Promise<void> {
  const db = getSupabase()
  await db.from('oc_workload_metrics').insert({
    ...entry,
    recorded_at: new Date().toISOString(),
  })
}
