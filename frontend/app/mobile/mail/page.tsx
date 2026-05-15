import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import MailInboxClient from '@/components/mail/MailInboxClient'
import MailConnectPrompt from '@/components/mail/MailConnectPrompt'

export const metadata: Metadata = { title: 'Mail OS' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MailPage() {
  const supabase = await createClient()

  const { data: accounts } = await supabase
    .from('mail_accounts')
    .select('id, email, display_name, sync_status, last_sync_at')
    .order('created_at', { ascending: true })

  if (!accounts || accounts.length === 0) {
    return <MailConnectPrompt />
  }

  const { data: messages } = await supabase
    .from('mail_messages')
    .select('*')
    .eq('is_archived', false)
    .order('is_read', { ascending: true })
    .order('received_at', { ascending: false })
    .limit(50)

  const [urgentRes, highRes, unreadRes] = await Promise.allSettled([
    supabase
      .from('mail_messages')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'urgent'),
    supabase
      .from('mail_messages')
      .select('id', { count: 'exact', head: true })
      .eq('priority', 'high'),
    supabase
      .from('mail_messages')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false),
  ])

  const n = (r: PromiseSettledResult<{ count?: number | null }>) =>
    r.status === 'fulfilled' ? (r.value.count ?? 0) : 0

  return (
    <MailInboxClient
      initialMessages={messages ?? []}
      accounts={accounts}
      urgentCount={n(urgentRes as PromiseSettledResult<{ count?: number | null }>)}
      highCount={n(highRes as PromiseSettledResult<{ count?: number | null }>)}
      unreadCount={n(unreadRes as PromiseSettledResult<{ count?: number | null }>)}
    />
  )
}
