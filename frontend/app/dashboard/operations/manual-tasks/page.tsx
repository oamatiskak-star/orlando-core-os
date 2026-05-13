import { createClient } from '@/lib/supabase/server'
import { CheckSquare, Clock, CheckCircle2, AlertCircle } from 'lucide-react'
import { revalidatePath } from 'next/cache'

type ManualJob = {
  id: string
  queue_name: string
  company: string
  job_type: string
  payload: Record<string, unknown>
  status: string
  priority: number
  retry_count: number
  error_message: string | null
  scheduled_at: string | null
  created_at: string
}

async function cancelJob(id: string) {
  'use server'
  const { createClient: create } = await import('@/lib/supabase/server')
  const supabase = await create()
  await supabase.from('oc_queue_jobs').update({ status: 'cancelled' }).eq('id', id)
  revalidatePath('/dashboard/operations/manual-tasks')
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-400 bg-amber-500/10',
  running: 'text-indigo-400 bg-indigo-500/10',
  completed: 'text-green-400 bg-green-500/10',
  failed: 'text-red-400 bg-red-500/10',
  cancelled: 'text-white/38 bg-white/5',
}

export default async function ManualTasksPage() {
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from('oc_queue_jobs')
    .select('*')
    .in('status', ['pending', 'running', 'failed'])
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(100)

  const pending = jobs?.filter(j => j.status === 'pending').length ?? 0
  const running = jobs?.filter(j => j.status === 'running').length ?? 0
  const failed = jobs?.filter(j => j.status === 'failed').length ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
          <CheckSquare size={16} className="text-teal-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Manual Tasks</h1>
          <p className="text-xs text-white/50">Handmatige queue jobs — pending, running en gefaalde taken</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', value: pending, icon: Clock, color: 'text-amber-400', border: 'border-amber-500/20' },
          { label: 'Running', value: running, icon: CheckCircle2, color: 'text-indigo-400', border: 'border-indigo-500/20' },
          { label: 'Failed', value: failed, icon: AlertCircle, color: failed > 0 ? 'text-red-400' : 'text-white/38', border: failed > 0 ? 'border-red-500/20' : 'border-white/5' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className={`bg-white/[0.06] border ${s.border} rounded-xl p-4`}>
              <Icon size={13} className={`${s.color} mb-2`} />
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {(jobs?.length ?? 0) === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white/[0.02] border border-white/5 rounded-xl">
          <CheckCircle2 size={24} className="text-green-400/50" />
          <p className="text-sm text-white/50">Geen openstaande taken</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(jobs as ManualJob[]).map(job => (
            <div key={job.id} className="flex items-center gap-3 px-4 py-3 bg-white/[0.06] border border-white/5 rounded-xl">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-white font-mono">{job.job_type}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${STATUS_COLORS[job.status] ?? 'text-white/50 bg-white/5'}`}>
                    {job.status}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-white/38">{job.queue_name}</span>
                  <span className="text-[10px] text-white/30">{job.company}</span>
                </div>
                {job.error_message && (
                  <p className="text-[10px] text-red-400 mt-0.5 font-mono truncate">{job.error_message}</p>
                )}
                <p className="text-[10px] text-white/25 mt-0.5 font-mono">{job.id.slice(0, 12)} · {new Date(job.created_at).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>

              {(job.status === 'pending' || job.status === 'running') && (
                <form action={cancelJob.bind(null, job.id)}>
                  <button type="submit" className="px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/30 text-xs transition-colors">
                    Annuleer
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
