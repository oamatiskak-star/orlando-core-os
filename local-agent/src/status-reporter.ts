import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const db = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

const LM_STUDIO_URL = process.env.LM_STUDIO_URL  || 'http://localhost:1234'
const OLLAMA_URL    = process.env.OLLAMA_URL      || 'http://localhost:11434'
const INTERVAL_MS   = 10_000

async function pingLMStudio(): Promise<{
  online: boolean
  loaded_model: string | null
  available_models: { name: string; family: string }[]
  response_ms: number | null
  last_error: string | null
}> {
  const t0 = Date.now()
  try {
    const res = await axios.get(`${LM_STUDIO_URL}/v1/models`, { timeout: 3_000 })
    const models = (res.data?.data ?? []) as { id: string; owned_by?: string }[]
    return {
      online: true,
      loaded_model: models[0]?.id ?? null,
      available_models: models.map(m => ({ name: m.id, family: m.owned_by ?? 'unknown' })),
      response_ms: Date.now() - t0,
      last_error: null,
    }
  } catch (err: any) {
    return {
      online: false,
      loaded_model: null,
      available_models: [],
      response_ms: null,
      last_error: err.code === 'ECONNREFUSED' ? 'Offline' : err.message,
    }
  }
}

async function pingOllama(): Promise<{
  online: boolean
  loaded_model: string | null
  available_models: { name: string; size_gb: string; family: string; quant: string }[]
  running_models: { name: string; size_gb: string }[]
  response_ms: number | null
  last_error: string | null
}> {
  const t0 = Date.now()
  try {
    const [tagsRes, psRes] = await Promise.all([
      axios.get(`${OLLAMA_URL}/api/tags`, { timeout: 3_000 }),
      axios.get(`${OLLAMA_URL}/api/ps`,   { timeout: 3_000 }),
    ])

    const tags = (tagsRes.data?.models ?? []) as {
      name: string
      size: number
      details: { family: string; quantization_level: string; parameter_size: string }
    }[]

    const running = (psRes.data?.models ?? []) as {
      name: string
      size: number
    }[]

    return {
      online: true,
      loaded_model: running[0]?.name ?? tags[0]?.name ?? null,
      available_models: tags.map(m => ({
        name:    m.name,
        size_gb: (m.size / 1e9).toFixed(1),
        family:  m.details?.family ?? 'unknown',
        quant:   m.details?.quantization_level ?? '',
      })),
      running_models: running.map(m => ({
        name:    m.name,
        size_gb: (m.size / 1e9).toFixed(1),
      })),
      response_ms: Date.now() - t0,
      last_error: null,
    }
  } catch (err: any) {
    return {
      online: false,
      loaded_model: null,
      available_models: [],
      running_models: [],
      response_ms: null,
      last_error: err.code === 'ECONNREFUSED' ? 'Offline' : err.message,
    }
  }
}

async function getTodayStats(): Promise<{ requests_today: number; avg_duration_s: number | null }> {
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  const { data } = await db
    .from('agent_tasks')
    .select('started_at, completed_at')
    .eq('task_type', 'generate_content')
    .eq('status', 'completed')
    .gte('completed_at', todayStart.toISOString())

  if (!data?.length) return { requests_today: 0, avg_duration_s: null }

  const durations = data
    .filter(r => r.started_at && r.completed_at)
    .map(r => (new Date(r.completed_at).getTime() - new Date(r.started_at).getTime()) / 1000)

  const avg = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : null

  return { requests_today: data.length, avg_duration_s: avg ? Math.round(avg * 10) / 10 : null }
}

async function report(): Promise<void> {
  const [lm, ol, stats] = await Promise.all([
    pingLMStudio(),
    pingOllama(),
    getTodayStats(),
  ])

  await Promise.all([
    db.from('ai_worker_status').upsert({
      engine:           'lmstudio',
      online:           lm.online,
      loaded_model:     lm.loaded_model,
      available_models: lm.available_models,
      running_models:   [],
      response_ms:      lm.response_ms,
      requests_today:   stats.requests_today,
      avg_duration_s:   stats.avg_duration_s,
      last_error:       lm.last_error,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'engine' }),

    db.from('ai_worker_status').upsert({
      engine:           'ollama',
      online:           ol.online,
      loaded_model:     ol.loaded_model,
      available_models: ol.available_models,
      running_models:   ol.running_models,
      response_ms:      ol.response_ms,
      requests_today:   stats.requests_today,
      avg_duration_s:   stats.avg_duration_s,
      last_error:       ol.last_error,
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'engine' }),
  ])
}

async function main() {
  console.log('[status-reporter] Start — poll elke 10s naar Supabase')
  while (true) {
    try {
      await report()
    } catch (err: any) {
      console.error('[status-reporter] Fout:', err.message)
    }
    await new Promise(r => setTimeout(r, INTERVAL_MS))
  }
}

main()
