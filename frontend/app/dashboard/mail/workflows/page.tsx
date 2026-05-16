import { createClient } from '@/lib/supabase/server'
import MailWorkflowsClient from '@/components/mail/dashboard/MailWorkflowsClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MailWorkflowsPage() {
  const supabase = await createClient()
  const { data: workflows } = await supabase
    .from('mail_workflows')
    .select('*')
    .order('priority', { ascending: false })

  return <MailWorkflowsClient initialWorkflows={workflows ?? []} />
}
