import { redirect } from 'next/navigation'

// Routing rules staan al in /mobile/mail/mapping — redirect naar die pagina
// maar voor desktop laden we een volwaardige desktop view
import { createClient } from '@/lib/supabase/server'
import MailRulesDashboardClient from '@/components/mail/dashboard/MailRulesDashboardClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MailRulesPage() {
  const supabase = await createClient()

  const [{ data: rules }, { data: accounts }] = await Promise.all([
    supabase
      .from('mail_routing_rules')
      .select('*')
      .order('priority', { ascending: false }),
    supabase
      .from('mail_accounts')
      .select('id, email, display_name'),
  ])

  return <MailRulesDashboardClient initialRules={rules ?? []} accounts={accounts ?? []} />
}
