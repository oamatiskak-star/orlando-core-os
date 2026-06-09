import { Flag, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getActiveCompany } from '@/lib/active-company-server'
import DagPrioriteitSection from '@/components/build/DagPrioriteitSection'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DagPrioriteitPage() {
  const company = await getActiveCompany()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/build-tracker" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
          <Flag size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Dagprioriteit</h1>
          <p className="text-xs text-white/50">{company.name} — Hermes bepaalt de startvolgorde, teruggeleid naar het Master Businessplan</p>
        </div>
      </div>

      <DagPrioriteitSection companySlug={company.id} heading="Vandaag eerst starten" />
    </div>
  )
}
