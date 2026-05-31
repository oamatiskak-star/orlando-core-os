import { createAdminClient } from '@/lib/supabase/admin'
import { ArrowRightLeft } from 'lucide-react'
import DispatchBoard from './DispatchBoard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Host = { host_id: string; label: string; role: string; active: boolean; last_seen_at: string | null }
type Task = {
  id: string; title: string; workstream: string | null; repo: string | null
  target_host: string; priority: number; status: string; claimed_by: string | null
  claimed_at: string | null; created_at: string
}

export default async function DispatchPage() {
  const db = createAdminClient()

  let hosts: Host[] = []
  let tasks: Task[] = []
  let unavailable = false

  try {
    const [hostsRes, tasksRes] = await Promise.all([
      db.schema('hermes').from('hosts').select('host_id,label,role,active,last_seen_at').order('host_id'),
      db.schema('hermes').from('dispatch_queue')
        .select('id,title,workstream,repo,target_host,priority,status,claimed_by,claimed_at,created_at')
        .order('priority', { ascending: true }).order('created_at', { ascending: true }).limit(200),
    ])
    if (hostsRes.error || tasksRes.error) unavailable = true
    hosts = (hostsRes.data as Host[]) ?? []
    tasks = (tasksRes.data as Task[]) ?? []
  } catch {
    unavailable = true
  }

  const count = (s: string) => tasks.filter((t) => t.status === s).length
  const kpis = [
    { label: 'Queued', value: count('queued') },
    { label: 'Claimed', value: count('claimed') },
    { label: 'Running', value: count('running') },
    { label: 'Done', value: count('done') },
    { label: 'Failed', value: count('failed') },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ArrowRightLeft size={16} className="text-emerald-400" />
        <h1 className="text-[15px] font-semibold text-white/90">Hermes Dispatch — CLI-L / CLI-R</h1>
      </div>
      <p className="text-[11px] text-white/55 leading-relaxed max-w-2xl">
        Hermes verdeelt werk over hosts. Geef werk een <code className="text-emerald-400/90">target_host</code>{' '}
        (cli-l / cli-r / any); elke host claimt atomisch zijn werk via <code className="text-emerald-400/90">dispatch_claim</code>.
      </p>

      {unavailable ? (
        <div className="p-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] text-[12px] text-amber-300/90">
          Dispatch-tabellen niet bereikbaar — migratie 110 is nog niet toegepast op deze database.
          Pas <code>110_hermes_dispatch.sql</code> toe; daarna verschijnt het bord hier.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {kpis.map((k) => (
              <div key={k.label} className="bg-white/[0.04] border border-white/[0.06] rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wide text-white/45">{k.label}</div>
                <div className="text-xl font-semibold text-white/90">{k.value}</div>
              </div>
            ))}
          </div>
          <DispatchBoard hosts={hosts} tasks={tasks} />
        </>
      )}
    </div>
  )
}
