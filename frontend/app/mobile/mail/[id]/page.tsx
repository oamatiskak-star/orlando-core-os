import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import MailDetailClient from '@/components/mail/MailDetailClient'

export const metadata: Metadata = { title: 'Mail' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function MailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: message, error } = await supabase
    .from('mail_messages')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !message) notFound()

  const [contactRes, draftRes, attachmentsRes, agendaRes] = await Promise.allSettled([
    message.from_email
      ? supabase
          .from('mail_contacts')
          .select('*')
          .eq('email', message.from_email)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from('mail_drafts')
      .select('*')
      .eq('message_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('mail_attachments')
      .select('*')
      .eq('message_id', id)
      .order('created_at'),
    supabase
      .from('mail_agenda_suggestions')
      .select('*')
      .eq('message_id', id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const contact = contactRes.status === 'fulfilled' ? contactRes.value.data : null
  const draft = draftRes.status === 'fulfilled' ? draftRes.value.data : null
  const attachments = attachmentsRes.status === 'fulfilled' ? (attachmentsRes.value.data ?? []) : []
  const agenda = agendaRes.status === 'fulfilled' ? agendaRes.value.data : null

  if (!message.is_read) {
    await supabase
      .from('mail_messages')
      .update({ is_read: true })
      .eq('id', id)
  }

  return (
    <MailDetailClient
      message={message}
      contact={contact}
      draft={draft}
      attachments={attachments}
      agendaSuggestion={agenda}
    />
  )
}
