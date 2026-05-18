import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Clock, AlertTriangle, CalendarClock } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const LEGAL_TYPE_LABEL: Record<string, string> = {
  dagvaarding: 'Dagvaarding', sommatiebrief: 'Sommatiebrief',
  ingebrekestelling: 'Ingebrekestelling', faillissement: 'Faillissement',
  curator: 'Curator', incasso: 'Incasso', bezwaar: 'Bezwaar',
  vonnis: 'Vonnis', hoger_beroep: 'Hoger Beroep',
  overeenkomst: 'Overeenkomst', contract: 'Contract', overig: 'Overig',
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000)
}

function fmt(str: string) {
  return new Date(str).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function DeadlinesPage() {
  const supabase = await createClient()

  const { data: deadlines } = await supabase
    .from('mail_legal_deadlines')
    .select('*, mail_legal_dossiers(party_name, company, legal_type)')
    .eq('status', 'open')
    .order('deadline_at', { ascending: true })

  const overdueCount = deadlines?.filter(d => daysUntil(d.deadline_at) < 0).length ?? 0
  const criticalCount = deadlines?.filter(d => { const days = daysUntil(d.deadline_at); return days >= 0 && days <= 2 }).length ?? 0
  const upcomingCount = deadlines?.filter(d => { const days = daysUntil(d.deadline_at); return days > 2 && days <= 7 }).length ?? 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <CalendarClock size={16} className="text-orange-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Deadline Monitor</h1>
          <p className="text-xs text-white/50">Alle openstaande juridische termijnen — oplopend gesorteerd</p>
        </div>
        <Link href="/dashboard/ai-advocaat" className="ml-auto text-[11px] text-indigo-400 hover:text-indigo-300">
          ← Terug
        </Link>
      </div>

      {/* Alert voor verlopen */}
      {overdueCount > 0 && (
        <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl flex items-center gap-3">
          <AlertTriangle size={14} className="text-red-400 flex-shrink-0" />
          <p className="text-[12px] text-red-400 font-semibold">{overdueCount} verlopen termijn{overdueCount > 1 ? 'en' : ''} — directe actie vereist</p>
        </div>
      )}

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {overdueCount > 0 && (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium border text-red-400 bg-red-500/10 border-red-500/20">
            {overdueCount} Verlopen
          </span>
        )}
        {criticalCount > 0 && (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium border text-red-400 bg-red-500/8 border-red-500/15">
            {criticalCount} Binnen 2 dagen
          </span>
        )}
        {upcomingCount > 0 && (
          <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium border text-orange-400 bg-orange-500/10 border-orange-500/20">
            {upcomingCount} Binnen 7 dagen
          </span>
        )}
        <span className="px-2.5 py-1 rounded-lg text-[11px] font-medium border text-white/40 bg-white/5 border-white/5">
          {deadlines?.length ?? 0} totaal open
        </span>
      </div>

      {/* Deadline lijst */}
      {(!deadlines || deadlines.length === 0) ? (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl py-16 text-center">
          <CalendarClock size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[13px] text-white/25">Geen openstaande termijnen</p>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4 space-y-2">
          {deadlines.map((dl) => {
            const days = daysUntil(dl.deadline_at)
            const isOverdue = days < 0
            const isCritical = !isOverdue && days <= 2
            const isUrgent = !isOverdue && !isCritical && days <= 7

            const urgentColor = isOverdue ? 'text-red-500' : isCritical ? 'text-red-400' : isUrgent ? 'text-orange-400' : 'text-white/50'
            const borderBg = isOverdue
              ? 'bg-red-500/8 border-red-500/15'
              : isCritical
              ? 'bg-red-500/5 border-red-500/10'
              : isUrgent
              ? 'bg-orange-500/5 border-orange-500/10'
              : 'bg-white/[0.03] border-white/[0.05]'

            const d = dl.mail_legal_dossiers as { party_name: string; company: string | null; legal_type: string } | null

            return (
              <div key={dl.id} className={`flex items-start gap-3 p-3 rounded-xl border ${borderBg}`}>
                <Clock size={13} className={`${urgentColor} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] text-white/80 font-medium">{dl.title}</p>
                  {d && (
                    <p className="text-[10px] text-white/35 truncate mt-0.5">
                      {d.party_name}
                      {d.company ? ` · ${d.company}` : ''}
                      {' · '}{LEGAL_TYPE_LABEL[d.legal_type] ?? d.legal_type}
                    </p>
                  )}
                  {dl.description && (
                    <p className="text-[10px] text-white/25 mt-0.5 truncate">{dl.description}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-[13px] font-bold ${urgentColor}`}>
                    {isOverdue
                      ? `${Math.abs(days)}d verlopen`
                      : days === 0
                      ? 'VANDAAG'
                      : `${days}d`}
                  </p>
                  <p className="text-[9px] text-white/25">{fmt(dl.deadline_at)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
