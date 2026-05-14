import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  const supabase = await createClient()

  const [{ data: registry }, { data: aiStatus }] = await Promise.all([
    supabase.from('worker_registry').select('*').order('worker_type'),
    supabase.from('ai_worker_status').select('*'),
  ])

  // Merge ai_worker_status into registry for LM Studio / Ollama
  const merged = (registry ?? []).map(w => {
    const ai = (aiStatus ?? []).find(a => a.engine === (w.id === 'W1' || w.id === 'W2' ? 'lmstudio' : null))
    return { ...w, ai_status: ai ?? null }
  })

  return NextResponse.json({ workers: merged })
}

export async function POST(req: NextRequest) {
  const { worker_id, action } = await req.json()

  if (!worker_id || !action) {
    return NextResponse.json({ error: 'worker_id and action required' }, { status: 400 })
  }

  const ALLOWED_ACTIONS = ['start', 'stop', 'restart', 'pause', 'clear-queue', 'debug']
  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 })
  }

  const supabase = await createClient()

  // Log the override action
  await supabase.from('media_audit_log').insert({
    worker_id,
    action: `worker_${action}`,
    status: 'info',
    message: `Manual ${action} triggered for worker ${worker_id}`,
    metadata: { action, worker_id, triggered_at: new Date().toISOString() },
  })

  // PM2 worker ID mapping (local workers only — Render workers managed via API)
  const PM2_MAP: Record<string, string> = {
    'content-factory': 'content-factory',
    'W1':              'video-worker-1',
    'W2':              'video-worker-2',
    'seo-optimizer':   'seo-optimizer',
    'status-reporter': 'status-reporter',
  }

  const pm2Name = PM2_MAP[worker_id]

  if (pm2Name) {
    // Local PM2 worker — attempt PM2 control via SSH or local exec
    try {
      let cmd: string
      switch (action) {
        case 'start':   cmd = `pm2 start ${pm2Name}`;   break
        case 'stop':    cmd = `pm2 stop ${pm2Name}`;    break
        case 'restart': cmd = `pm2 restart ${pm2Name}`; break
        case 'pause':   cmd = `pm2 stop ${pm2Name}`;    break
        default:        cmd = `pm2 describe ${pm2Name}`; break
      }
      await execAsync(cmd)
    } catch {
      // PM2 may not be accessible from Vercel — update status in registry instead
    }
  }

  // Update worker_registry status based on action
  const statusMap: Record<string, string> = {
    start:   'online',
    stop:    'offline',
    restart: 'online',
    pause:   'offline',
  }

  if (statusMap[action]) {
    await supabase.from('worker_registry').update({
      status: statusMap[action],
      updated_at: new Date().toISOString(),
    }).eq('id', worker_id)
  }

  return NextResponse.json({ ok: true, worker_id, action })
}
