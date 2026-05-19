import { createClient } from '@/lib/supabase/server'
import TerminalView from '@/components/car/TerminalView'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CarPage() {
  const supabase = await createClient()

  const { data: workers } = await supabase
    .from('worker_registry')
    .select('id,display_name,worker_type,host,status,cpu_percent,ram_mb,uptime_seconds,current_task_description,last_heartbeat,updated_at')
    .order('worker_type')

  return <TerminalView initialWorkers={workers ?? []} />
}
