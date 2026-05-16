import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import DraftsClient from '@/components/mail/DraftsClient'

export const metadata: Metadata = { title: 'Concepten — Mail OS' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DraftsPage() {
  const supabase = await createClient()

  const { data: drafts } = await supabase
    .from('mail_drafts')
    .select(`
      *,
      mail_messages (
        id,
        subject,
        from_email,
        from_name,
        company,
        category,
        priority,
        received_at,
        provider
      )
    `)
    .in('status', ['pending', 'sandbox', 'modified'])
    .order('created_at', { ascending: false })
    .limit(50)

  const pendingCount = drafts?.filter(d => d.status === 'pending' || d.status === 'modified').length ?? 0

  return <DraftsClient initialDrafts={drafts ?? []} pendingCount={pendingCount} />
}
