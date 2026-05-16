import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import MappingClient from '@/components/mail/MappingClient'

export const metadata: Metadata = { title: 'Mail Mapping — Mail OS' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MappingPage() {
  const supabase = await createClient()

  const [{ data: rules }, { data: accountMappings }] = await Promise.all([
    supabase
      .from('mail_routing_rules')
      .select('*')
      .order('priority', { ascending: false }),
    supabase
      .from('mail_account_mappings')
      .select('*, mail_accounts(email, display_name)')
      .order('company'),
  ])

  return (
    <MappingClient
      initialRules={rules ?? []}
      accountMappings={accountMappings ?? []}
    />
  )
}
