import { createClient } from '@/lib/supabase/server'
import {
  listTasks,
  listUnresolvedEvents,
  listWorkers,
  recentErrors,
  systemState,
} from '@/lib/orchestrator/queries'
import OrchestratorClient from './_components/OrchestratorClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OrchestratorPage() {
  const supabase = await createClient()

  const [counters, workers, errors, events, hoog, normaal, laag, waiting] = await Promise.all([
    systemState(supabase),
    listWorkers(supabase),
    recentErrors(supabase, 10),
    listUnresolvedEvents(supabase, 10),
    listTasks(supabase, { priority_band: 'hoog',    limit: 5, status: ['open', 'retry', 'running', 'paused'] }),
    listTasks(supabase, { priority_band: 'normaal', limit: 5, status: ['open', 'retry', 'running', 'paused'] }),
    listTasks(supabase, { priority_band: 'laag',    limit: 5, status: ['open', 'retry', 'running', 'paused'] }),
    listTasks(supabase, { status: 'waiting', limit: 10 }),
  ])

  return (
    <OrchestratorClient
      initialCounters={counters}
      initialWorkers={workers}
      initialErrors={errors}
      initialEvents={events}
      initialLanes={{ hoog, normaal, laag }}
      initialWaiting={waiting}
    />
  )
}
