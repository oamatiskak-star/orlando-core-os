import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' })

const EXECUTOR_SET = ['anthropic', 'ai', 'claude-code', 'director']
const BATCH_SIZE = 3

type OrchestratorTask = {
  id: string
  title: string
  task_type: string
  executor: string
  objective: string[]
  payload: Record<string, unknown>
  priority: number
  attempts: number
  max_attempts: number
}

type Persona = {
  name: string
  role: string
  authority: string | null
  description: string | null
  capabilities: string[] | null
}

async function buildSystemPrompt(personaName: string | null): Promise<string> {
  const base = 'Je bent een AI-assistent binnen het Orlando Core OS ecosysteem. Geef concrete, directe antwoorden in het Nederlands. Geen overbodige uitleg.'

  if (!personaName) return base

  const { data: persona } = await supabase
    .from('agent_personas')
    .select('name, role, authority, description, capabilities')
    .ilike('name', personaName)
    .maybeSingle() as { data: Persona | null }

  if (!persona) return base

  const parts = [
    `Je bent ${persona.name} — ${persona.role}.`,
    persona.authority ? `Autoriteit: ${persona.authority}.` : null,
    persona.description ? persona.description : null,
    persona.capabilities?.length
      ? `Specialisaties: ${persona.capabilities.join(', ')}.`
      : null,
    'Geef concrete, directe antwoorden in het Nederlands. Geen overbodige uitleg.',
  ].filter(Boolean)

  return parts.join(' ')
}

async function executeTask(task: OrchestratorTask): Promise<void> {
  // Claim de taak
  await supabase
    .from('orchestrator_tasks')
    .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', task.id)

  try {
    const personaName = (task.payload?.persona as string | null) ?? null
    const systemPrompt = await buildSystemPrompt(personaName)

    // Bouw user message uit objective array
    const userContent = task.objective?.length > 0
      ? task.objective.join('\n\n')
      : task.title

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const resultText = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')

    await supabase
      .from('orchestrator_tasks')
      .update({
        status:         'completed',
        result_summary: resultText,
        finished_at:    new Date().toISOString(),
        updated_at:     new Date().toISOString(),
        attempts:       task.attempts + 1,
        error:          null,
      })
      .eq('id', task.id)

    // Log succes
    await supabase.from('orchestrator_task_logs').insert({
      task_id: task.id,
      level:   'info',
      message: `Taak voltooid — ${message.usage?.output_tokens ?? 0} output tokens`,
      payload: { model: 'claude-sonnet-4-6', persona: personaName, summary: resultText.slice(0, 300) },
    })

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const newAttempts = task.attempts + 1
    const failed = newAttempts >= (task.max_attempts ?? 3)

    await supabase
      .from('orchestrator_tasks')
      .update({
        status:      failed ? 'failed' : 'open',
        error:       errorMsg,
        attempts:    newAttempts,
        started_at:  null,
        updated_at:  new Date().toISOString(),
      })
      .eq('id', task.id)

    await supabase.from('orchestrator_task_logs').insert({
      task_id: task.id,
      level:   'error',
      message: `Uitvoer mislukt (poging ${newAttempts}/${task.max_attempts ?? 3}): ${errorMsg.slice(0, 200)}`,
      payload: {},
    })
  }
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tasks, error } = await supabase
    .from('orchestrator_tasks')
    .select('id, title, task_type, executor, objective, payload, priority, attempts, max_attempts')
    .in('executor', EXECUTOR_SET)
    .eq('status', 'open')
    .lte('run_at', new Date().toISOString())
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ executed: 0, message: 'Geen taken in queue' })
  }

  const results: { id: string; status: string }[] = []

  for (const task of tasks as OrchestratorTask[]) {
    try {
      await executeTask(task)
      results.push({ id: task.id, status: 'executed' })
    } catch (e) {
      results.push({ id: task.id, status: `error: ${e instanceof Error ? e.message : String(e)}` })
    }
  }

  return NextResponse.json({ executed: results.length, results })
}

// Vercel cron roept GET aan — ook POST ondersteunen voor manuele trigger
export async function POST(req: NextRequest) {
  return GET(req)
}
