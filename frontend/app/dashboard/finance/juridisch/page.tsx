'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FinLegalCase } from '@/lib/finance/types'
import { Download } from 'lucide-react'

function fmt(amount: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    in_behandeling: 'bg-amber-500/10 text-amber-400',
    ingediend: 'bg-blue-500/10 text-blue-400',
    vonnis: 'bg-green-500/10 text-green-400',
    verloren: 'bg-red-500/10 text-red-400',
    gesloten: 'bg-white/5 text-white/40',
  }
  return (
    <span className={`${map[status] ?? 'bg-white/5 text-white/40'} px-2 py-0.5 rounded-full text-[10px] font-medium`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default function JuridischPage() {
  const [cases, setCases] = useState<FinLegalCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('fin_legal_cases')
          .select('*')
          .order('started_at', { ascending: false })

        if (error || !data) {
          setCases([])
        } else {
          setCases(data as FinLegalCase[])
        }
      } catch {
        setCases([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const inBehandeling = cases.filter((c) => c.status === 'in_behandeling').length
  const ingediend = cases.filter((c) => c.status === 'ingediend').length
  const vonnissen = cases.filter((c) => c.status === 'vonnis').length
  const totalClaimed = cases.reduce((s, c) => s + c.amount_claimed, 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Juridische Dossiers</h1>
          <p className="text-xs text-white/30 mt-0.5">{cases.length} dossiers</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'In behandeling', value: inBehandeling.toString(), color: 'text-amber-400' },
          { label: 'Ingediend', value: ingediend.toString(), color: 'text-blue-400' },
          { label: 'Vonnissen', value: vonnissen.toString(), color: 'text-green-400' },
          { label: 'Totaal gevorderd', value: fmt(totalClaimed), color: 'text-white' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
            <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-1">{s.label}</p>
            <p className={`text-xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-white/30">Laden...</div>
        ) : cases.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-white/40 mb-1">Geen juridische dossiers</p>
            <p className="text-xs text-white/20">Juridische zaken worden aangemaakt vanuit incasso dossiers</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Zaak #', 'Klant', 'Bedrag', 'Advocaat', 'Status', 'Gestart', 'Actie'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs text-indigo-400 font-medium">{c.case_nr ?? c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-xs text-white/70">—</td>
                  <td className="px-4 py-3 text-xs font-semibold text-red-400">{fmt(c.amount_claimed)}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{c.lawyer ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-xs text-white/40">{c.started_at}</td>
                  <td className="px-4 py-3">
                    <button className="border border-white/10 text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                      <Download size={11} />
                      Exporteer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
