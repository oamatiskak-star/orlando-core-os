import { ChevronLeft, Hammer, Calendar, User, Flag, Clock, KeyRound, ArrowRight, Coins } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { accountStatusBadge, fmtMoney, PLACEHOLDER } from '@/lib/account-setup'
import BuildEditPanel from './BuildEditPanel'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Build = {
  id: string
  name: string
  description: string | null
  status: string
  progress_pct: number
  owner: string | null
  current_milestone: string | null
  started_at: string | null
  target_at: string | null
  last_update_at: string | null
  requires_account_setup: boolean
  account_platform: string | null
  account_type: string | null
  expected_revenue_model: string | null
  expected_revenue_amount: number | null
  revenue_currency: string | null
  account_status: string
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planned:   { label: 'Gepland',    color: 'bg-white/10 text-white/60' },
  building:  { label: 'In bouw',    color: 'bg-blue-500/15 text-blue-400' },
  testing:   { label: 'Test',       color: 'bg-violet-500/15 text-violet-400' },
  deploying: { label: 'Deployment', color: 'bg-cyan-500/15 text-cyan-400' },
  live:      { label: 'Live',       color: 'bg-emerald-500/15 text-emerald-400' },
  paused:    { label: 'Gepauzeerd', color: 'bg-amber-500/15 text-amber-400' },
  failed:    { label: 'Mislukt',    color: 'bg-red-500/15 text-red-400' },
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('nl-NL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default async function BuildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const company = await getActiveCompany()
  const supabase = await createClient()

  const { data } = await supabase
    .from('build_tracker')
    .select('id, name, description, status, progress_pct, owner, current_milestone, started_at, target_at, last_update_at, requires_account_setup, account_platform, account_type, expected_revenue_model, expected_revenue_amount, revenue_currency, account_status')
    .eq('id', id)
    .maybeSingle()

  if (!data) notFound()
  const b = data as Build
  const badge = STATUS_BADGE[b.status] ?? STATUS_BADGE.planned

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/build-tracker" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <Hammer size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-white truncate">{b.name}</h1>
          <p className="text-xs text-white/50">{company.name}</p>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-1 rounded ${badge.color}`}>{badge.label}</span>
      </div>

      {/* Progress + milestone */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full"
              style={{ width: `${b.progress_pct}%`, background: `linear-gradient(90deg, ${company.color}, ${company.color}cc)` }}
            />
          </div>
          <span className="text-xs text-white/70 w-10 text-right font-semibold">{b.progress_pct}%</span>
        </div>

        {b.current_milestone && (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: company.color }}>
            <Flag size={13} />
            <span className="font-medium">{b.current_milestone}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-[11px]">
          <div>
            <p className="text-white/35 flex items-center gap-1 mb-0.5"><User size={10} /> Eigenaar</p>
            <p className="text-white/75">{b.owner || '—'}</p>
          </div>
          <div>
            <p className="text-white/35 flex items-center gap-1 mb-0.5"><Calendar size={10} /> Gestart</p>
            <p className="text-white/75">{fmtDate(b.started_at)}</p>
          </div>
          <div>
            <p className="text-white/35 flex items-center gap-1 mb-0.5"><Calendar size={10} /> Deadline</p>
            <p className="text-white/75">{fmtDate(b.target_at)}</p>
          </div>
          <div>
            <p className="text-white/35 flex items-center gap-1 mb-0.5"><Clock size={10} /> Laatste update</p>
            <p className="text-white/75">{fmtDateTime(b.last_update_at)}</p>
          </div>
        </div>
      </div>

      {/* Full task description */}
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5">
        <p className="text-[10px] text-white/35 uppercase tracking-wide mb-2">Taak­omschrijving</p>
        <p className="text-[13px] text-white/80 leading-relaxed whitespace-pre-wrap">
          {b.description?.trim() || 'Geen omschrijving vastgelegd voor deze build.'}
        </p>
      </div>

      {/* Account Setup — alleen tonen als de taak een account vereist */}
      {b.requires_account_setup && (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-white/35 uppercase tracking-wide flex items-center gap-1.5"><KeyRound size={11} /> Account Setup</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${accountStatusBadge(b.account_status).color}`}>
              {accountStatusBadge(b.account_status).label}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div><p className="text-white/35 mb-0.5">Platform</p><p className="text-white/75">{b.account_platform || PLACEHOLDER}</p></div>
            <div><p className="text-white/35 mb-0.5">Accounttype</p><p className="text-white/75">{b.account_type || PLACEHOLDER}</p></div>
            <div><p className="text-white/35 mb-0.5">Verdienmodel</p><p className="text-white/75">{b.expected_revenue_model || PLACEHOLDER}</p></div>
            <div><p className="text-white/35 mb-0.5 flex items-center gap-1"><Coins size={10} /> Verwacht</p><p className="text-white/75">{b.expected_revenue_amount != null ? fmtMoney(b.expected_revenue_amount, b.revenue_currency || 'EUR') : PLACEHOLDER}</p></div>
          </div>
          <Link
            href={`/dashboard/build-tracker/${b.id}/account-setup`}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors"
            style={{ backgroundColor: `${company.color}1a`, borderColor: `${company.color}55`, color: company.color }}
          >
            <KeyRound size={13} /> Maak account aan <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Edit / Ga verder controls */}
      <BuildEditPanel
        id={b.id}
        status={b.status}
        progress={b.progress_pct}
        currentMilestone={b.current_milestone}
        description={b.description}
        companyColor={company.color}
        account={{
          requires_account_setup: b.requires_account_setup,
          account_platform: b.account_platform,
          account_type: b.account_type,
          expected_revenue_model: b.expected_revenue_model,
          expected_revenue_amount: b.expected_revenue_amount,
          revenue_currency: b.revenue_currency,
        }}
      />
    </div>
  )
}
