import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import LivePanel from './LivePanel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function LiveSetupPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params
  const supabase = await createClient()

  const { data: program } = await supabase
    .from('affiliate_programs')
    .select('id, name, account_status')
    .eq('id', programId)
    .maybeSingle()

  if (!program) notFound()

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/dashboard/account-setup/accounts"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
      >
        <ChevronLeft className="h-4 w-4" /> Terug naar accounts
      </Link>

      <h1 className="text-xl font-semibold text-zinc-100">Live setup — {program.name}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        De agent vult de velden in op de Mac mini (echte Chrome). Volg hier mee en keur verzending goed.
        CAPTCHA/2FA doe je in dat Chrome-venster.
      </p>

      <LivePanel
        programId={program.id}
        programName={program.name}
        accountStatus={program.account_status ?? 'not_started'}
      />
    </div>
  )
}
