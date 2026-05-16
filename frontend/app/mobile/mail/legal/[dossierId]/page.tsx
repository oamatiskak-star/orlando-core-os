import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LegalDossierDetailClient from '@/components/mail/LegalDossierDetailClient'

export const metadata: Metadata = { title: 'Dossier — Juridisch' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LegalDossierDetailPage({
  params,
}: {
  params: Promise<{ dossierId: string }>
}) {
  const { dossierId } = await params
  const supabase = await createClient()

  const { data: dossier } = await supabase
    .from('mail_legal_dossiers')
    .select('*, mail_messages(subject, received_at, from_email, from_name, body_text, company)')
    .eq('id', dossierId)
    .single()

  if (!dossier) notFound()

  const [{ data: deadlines }, { data: draftData }] = await Promise.all([
    supabase
      .from('mail_legal_deadlines')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('deadline_at', { ascending: true }),
    supabase
      .from('mail_drafts')
      .select('id, body, subject, status, ai_confidence, ai_reasoning, to_email')
      .eq('message_id', dossier.message_id)
      .in('status', ['pending', 'sandbox', 'modified'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return (
    <LegalDossierDetailClient
      dossier={dossier}
      deadlines={deadlines ?? []}
      draft={draftData ?? null}
    />
  )
}
