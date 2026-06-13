import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import ProgramDetailPanel from './ProgramDetailPanel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ActivationProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/account-setup/activation" className="text-white/40 hover:text-white">
          <ChevronLeft size={16} />
        </Link>
        <h1 className="text-base font-semibold text-white">Affiliate onboarding</h1>
      </div>
      <ProgramDetailPanel programId={programId} />
    </div>
  )
}
