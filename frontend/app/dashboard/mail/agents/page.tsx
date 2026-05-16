import { createClient } from '@/lib/supabase/server'
import MailAgentsClient from '@/components/mail/dashboard/MailAgentsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MailAgentsPage() {
  const supabase = await createClient()
  const { data: agents } = await supabase
    .from('mail_agents')
    .select('*')
    .order('name')

  return <MailAgentsClient initialAgents={agents ?? []} />
}
