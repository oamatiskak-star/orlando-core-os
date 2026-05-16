import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import LegalDossierListClient from '@/components/mail/LegalDossierListClient'

export const metadata: Metadata = { title: 'Juridisch — Mail OS' }
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LegalPage() {
  const supabase = await createClient()

  const [{ data: dossiers }, { data: deadlines }] = await Promise.all([
    supabase
      .from('mail_legal_dossiers')
      .select('*, mail_messages(subject, received_at, from_email)')
      .in('status', ['open', 'in_behandeling'])
      .order('risk_level', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('mail_legal_deadlines')
      .select('*, mail_legal_dossiers(party_name, company, legal_type)')
      .eq('status', 'open')
      .order('deadline_at', { ascending: true })
      .limit(10),
  ])

  const criticalCount = dossiers?.filter(d => d.risk_level === 'critical').length ?? 0
  const highCount     = dossiers?.filter(d => d.risk_level === 'high').length ?? 0

  return (
    <LegalDossierListClient
      initialDossiers={dossiers ?? []}
      upcomingDeadlines={deadlines ?? []}
      criticalCount={criticalCount}
      highCount={highCount}
    />
  )
}
