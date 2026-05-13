import { createAdminClient } from '@/lib/supabase/admin'
import AgendaClient from './AgendaClient'

export default async function AgendaPage() {
  const supabase = createAdminClient()
  const { data: conn } = await supabase
    .from('google_calendar_connections')
    .select('id')
    .eq('status', 'connected')
    .limit(1)
    .single()

  return <AgendaClient initialConnected={!!conn} />
}
