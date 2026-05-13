import { createClient } from '@/lib/supabase/server'
import { Package } from 'lucide-react'
import QueueMonitor from './QueueMonitor'

export default async function QueuePage() {
  const supabase = await createClient()

  const { data: jobs } = await supabase
    .from('oc_queue_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Package size={16} className="text-indigo-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Queue Monitor</h1>
          <p className="text-xs text-white/50">Realtime inzicht in alle wachtrijen — annuleer, retry en monitor jobs</p>
        </div>
      </div>

      <QueueMonitor initialJobs={jobs ?? []} />
    </div>
  )
}
