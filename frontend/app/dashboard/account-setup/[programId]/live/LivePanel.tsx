'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { Play, Check, X, RefreshCw, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { startBrowserRegistration, resolveHumanAction } from '../../actions'

const BUCKET = 'account-setup-artifacts'
const POLL_MS = 2500

type RunRow = { id: string; status: string; started_at: string | null }
type StepRow = {
  id: string; order_idx: number; step_kind: string; status: string
  output: Record<string, unknown> | null; started_at: string | null
}
type GateRow = {
  id: string; action_kind: string; title: string; description: string | null
  status: string; metadata: Record<string, unknown> | null
}

const GATE_KINDS = ['approve_submit', 'approve_action', 'captcha']

function pathFrom(obj: Record<string, unknown> | null): string | null {
  const p = obj?.['screenshot_path']
  return typeof p === 'string' ? p : null
}

export default function LivePanel({
  programId, programName, accountStatus,
}: { programId: string; programName: string; accountStatus: string }) {
  const supabase = createClient()
  const [run, setRun] = useState<RunRow | null>(null)
  const [steps, setSteps] = useState<StepRow[]>([])
  const [gate, setGate] = useState<GateRow | null>(null)
  const [shotUrl, setShotUrl] = useState<string | null>(null)
  const [starting, startTransition] = useTransition()
  const [resolving, setResolving] = useState(false)

  const refresh = useCallback(async () => {
    const { data: runs } = await supabase
      .from('account_setup_runs')
      .select('id, status, started_at')
      .eq('program_id', programId)
      .eq('run_kind', 'browser_registration')
      .order('started_at', { ascending: false })
      .limit(1)
    const latest = (runs?.[0] as RunRow) ?? null
    setRun(latest)
    if (!latest) { setSteps([]); setGate(null); setShotUrl(null); return }

    const { data: stepRows } = await supabase
      .from('account_setup_run_steps')
      .select('id, order_idx, step_kind, status, output, started_at')
      .eq('run_id', latest.id)
      .order('order_idx', { ascending: true })
    const allSteps = (stepRows as StepRow[]) ?? []
    setSteps(allSteps)

    const { data: gates } = await supabase
      .from('account_setup_human_actions')
      .select('id, action_kind, title, description, status, metadata')
      .eq('program_id', programId)
      .in('status', ['open', 'in_progress'])
      .in('action_kind', GATE_KINDS)
      .order('created_at', { ascending: false })
      .limit(1)
    const openGate = (gates?.[0] as GateRow) ?? null
    setGate(openGate)

    // screenshot: voorkeur voor het gate-screenshot, anders de laatste capture-stap
    let path = openGate ? pathFrom(openGate.metadata) : null
    if (!path) {
      const lastShot = [...allSteps].reverse().find(s => pathFrom(s.output))
      path = lastShot ? pathFrom(lastShot.output) : null
    }
    if (path) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60)
      setShotUrl(signed?.signedUrl ?? null)
    } else {
      setShotUrl(null)
    }
  }, [supabase, programId])

  useEffect(() => {
    // Eerste fetch via timer (niet synchroon in de effect-body) + daarna pollen.
    const first = setTimeout(refresh, 0)
    const t = setInterval(refresh, POLL_MS)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [refresh])

  function handleStart() {
    const fd = new FormData()
    fd.set('program_id', programId)
    startTransition(async () => { await startBrowserRegistration(fd); await refresh() })
  }

  async function decide(decision: 'resolved' | 'dismissed') {
    if (!gate) return
    setResolving(true)
    try {
      const fd = new FormData()
      fd.set('action_id', gate.id)
      fd.set('decision', decision)
      await resolveHumanAction(fd)
      await refresh()
    } finally {
      setResolving(false)
    }
  }

  const running = run && ['queued', 'running', 'awaiting_approval', 'awaiting_action'].includes(run.status)

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Live view */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">Live weergave</span>
          <button onClick={refresh} className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
            <RefreshCw className="h-3.5 w-3.5" /> Ververs
          </button>
        </div>
        {shotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shotUrl} alt="Live screenshot" className="w-full rounded-lg border border-zinc-800" />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-500">
            {running ? 'Wachten op eerste screenshot…' : 'Nog geen actieve sessie'}
          </div>
        )}

        {/* Goedkeur-gate */}
        {gate && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-amber-200">{gate.title}</p>
            {gate.description && <p className="mt-1 text-xs text-amber-100/80">{gate.description}</p>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => decide('resolved')}
                disabled={resolving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {resolving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Goedkeuren &amp; verzenden
              </button>
              <button
                onClick={() => decide('dismissed')}
                disabled={resolving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Afkeuren
              </button>
            </div>
          </div>
        )}

        {!running && (
          <button
            onClick={handleStart}
            disabled={starting}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Live setup starten
          </button>
        )}
      </div>

      {/* Step-tijdlijn */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-300">Stappen</span>
          <span className="text-xs text-zinc-500">
            {run ? `status: ${run.status}` : `status: ${accountStatus}`}
          </span>
        </div>
        {steps.length === 0 ? (
          <p className="text-sm text-zinc-500">Nog geen stappen voor {programName}.</p>
        ) : (
          <ol className="space-y-2">
            {steps.map(s => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <span
                  className={
                    s.status === 'completed' ? 'text-emerald-400'
                    : s.status === 'failed' ? 'text-red-400'
                    : s.status === 'skipped' ? 'text-zinc-500'
                    : 'text-amber-400'
                  }
                >
                  ●
                </span>
                <span className="flex-1">
                  <span className="text-zinc-300">{s.step_kind}</span>
                  {typeof s.output?.['field'] === 'string' && (
                    <span className="text-zinc-500"> — {String(s.output['field'])}</span>
                  )}
                  <span className="ml-1 text-xs text-zinc-600">{s.status}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
