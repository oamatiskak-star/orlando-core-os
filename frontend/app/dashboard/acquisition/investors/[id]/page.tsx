import { notFound } from 'next/navigation'
import { UserPlus, ArrowLeft, Mail, Phone, TrendingUp } from 'lucide-react'
import { getAcqInvestorById } from '@/lib/supabase/acquisition'

const RISK_COLORS: Record<string, string> = {
  laag: 'text-emerald-400 bg-emerald-500/10',
  midden: 'text-amber-400 bg-amber-500/10',
  hoog: 'text-red-400 bg-red-500/10',
}

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

export default async function InvestorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const investor = await getAcqInvestorById(id)
  if (!investor) notFound()

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <a href="/dashboard/acquisition/investors" className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 mb-3 w-fit">
          <ArrowLeft size={12} /> Investor Match Engine
        </a>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mt-0.5">
              <UserPlus size={16} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white">{investor.name}</h1>
              {investor.company && <p className="text-xs text-white/50 mt-0.5">{investor.company}</p>}
            </div>
          </div>
          <span className={`px-2 py-1 rounded-lg text-xs font-medium shrink-0 ${RISK_COLORS[investor.risk_profile] ?? 'text-white/40 bg-white/5'}`}>
            Risico: {investor.risk_profile}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Investerings Criteria</p>
          <div className="space-y-3">
            <Row label="Min investering" value={fmt(investor.investment_min)} />
            <Row label="Max investering" value={fmt(investor.investment_max)} />
            <Row label="Target rendement" value={investor.return_target_pct ? `${investor.return_target_pct.toFixed(1)}%` : '—'} />
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Contact</p>
          <div className="space-y-2">
            {investor.email && (
              <a href={`mailto:${investor.email}`} className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                <Mail size={13} /> {investor.email}
              </a>
            )}
            {investor.phone && (
              <a href={`tel:${investor.phone}`} className="flex items-center gap-2 text-sm text-white/60 hover:text-white/80 transition-colors">
                <Phone size={13} /> {investor.phone}
              </a>
            )}
            {!investor.email && !investor.phone && <p className="text-xs text-white/30">Geen contactgegevens</p>}
          </div>
        </div>
      </div>

      {Array.isArray(investor.regions) && investor.regions.length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Voorkeurs Regio's</p>
          <div className="flex flex-wrap gap-1.5">
            {investor.regions.map((r: string) => <span key={r} className="px-2 py-1 bg-white/5 text-white/60 rounded-lg text-xs">{r}</span>)}
          </div>
        </div>
      )}

      {Array.isArray(investor.object_types) && investor.object_types.length > 0 && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">Object Types</p>
          <div className="flex flex-wrap gap-1.5">
            {investor.object_types.map((t: string) => <span key={t} className="px-2 py-1 bg-emerald-500/10 text-emerald-400/80 rounded-lg text-xs">{t}</span>)}
          </div>
        </div>
      )}

      {investor.notes && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
          <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-2">Notities</p>
          <p className="text-sm text-white/70 whitespace-pre-wrap">{investor.notes}</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/40">{label}</span>
      <span className="text-xs font-medium text-white">{value}</span>
    </div>
  )
}
