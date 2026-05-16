'use client'

import { useCallback, useEffect, useState } from 'react'
import { ReceiptText, Plus, Pencil, Trash2, Send, Euro } from 'lucide-react'
import clsx from 'clsx'

type Payslip = {
  id: string
  employee_id: string
  employee: { id: string; name: string } | null
  period: string
  gross_salary: number | null
  net_salary: number | null
  file_url: string | null
  sent_at: string | null
  notes: string | null
  created_at: string
}

type Employee = { id: string; name: string }

const EMPTY: Partial<Payslip> = {
  employee_id: '', period: '', gross_salary: undefined, net_salary: undefined, file_url: '', notes: '',
}

function fmtPeriod(p: string) {
  const [y, m] = p.split('-')
  const months = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${y}`
}

export default function LoonstrokenPersoneelPage() {
  const [payslips, setPayslips]   = useState<Payslip[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal]         = useState(0)
  const [empFilter, setEmpFilter] = useState('')
  const [modal, setModal]         = useState<Partial<Payslip> | null>(null)
  const [saving, setSaving]       = useState(false)
  const [loading, setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const sp = new URLSearchParams()
    if (empFilter) sp.set('employee_id', empFilter)
    const [pr, er] = await Promise.all([
      fetch(`/api/personeel/payslips${sp.toString() ? `?${sp}` : ''}`, { cache: 'no-store' }),
      fetch('/api/personeel/employees', { cache: 'no-store' }),
    ])
    if (pr.ok) { const d = await pr.json(); setPayslips(d.payslips ?? []); setTotal(d.total ?? 0) }
    if (er.ok) { const d = await er.json(); setEmployees(d.employees ?? []) }
    setLoading(false)
  }, [empFilter])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!modal) return
    setSaving(true)
    const isNew  = !modal.id
    const url    = isNew ? '/api/personeel/payslips' : `/api/personeel/payslips/${modal.id}`
    const method = isNew ? 'POST' : 'PATCH'
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_id:  modal.employee_id,
        period:       modal.period,
        gross_salary: modal.gross_salary ?? null,
        net_salary:   modal.net_salary ?? null,
        file_url:     modal.file_url || null,
        notes:        modal.notes || null,
      }),
    })
    if (r.ok) { setModal(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Loonstrook verwijderen?')) return
    await fetch(`/api/personeel/payslips/${id}`, { method: 'DELETE' })
    load()
  }

  const markSent = async (id: string) => {
    await fetch(`/api/personeel/payslips/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sent_at: new Date().toISOString() }),
    })
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Loonstroken</h1>
          <p className="text-sm text-white/65 mt-0.5">Salarisoverzichten per medewerker</p>
        </div>
        <button onClick={() => setModal({ ...EMPTY })}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-sm">
          <Plus size={14} /> Toevoegen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Totaal', value: total },
          { label: 'Verzonden', value: payslips.filter(p => p.sent_at).length },
          { label: 'Openstaand', value: payslips.filter(p => !p.sent_at).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{value}</p>
            <p className="text-xs text-white/50 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Medewerker filter */}
      <div className="flex gap-2 items-center">
        <span className="text-xs text-white/40 shrink-0">Filter:</span>
        <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50">
          <option value="">Alle medewerkers</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-white/30 text-sm">Laden...</div>
      ) : payslips.length === 0 ? (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl p-10 flex flex-col items-center gap-3">
          <ReceiptText size={32} className="text-white/20" />
          <p className="text-sm text-white/40">Nog geen loonstroken</p>
          <button onClick={() => setModal({ ...EMPTY })} className="text-xs text-indigo-400 hover:text-indigo-300">Eerste loonstrook toevoegen</button>
        </div>
      ) : (
        <div className="bg-white/[0.04] border border-white/8 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Medewerker</th>
                <th className="text-left px-4 py-3 text-xs text-white/40 font-medium">Periode</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium hidden md:table-cell">Bruto</th>
                <th className="text-right px-4 py-3 text-xs text-white/40 font-medium hidden md:table-cell">Netto</th>
                <th className="text-center px-4 py-3 text-xs text-white/40 font-medium">Status</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {payslips.map((p, i) => (
                <tr key={p.id} className={clsx('group hover:bg-white/5 transition-colors', i < payslips.length - 1 && 'border-b border-white/5')}>
                  <td className="px-4 py-3 text-sm text-white">{p.employee?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-white/70">{fmtPeriod(p.period)}</td>
                  <td className="px-4 py-3 text-right text-sm text-white/70 hidden md:table-cell">
                    {p.gross_salary ? `€ ${p.gross_salary.toLocaleString('nl-NL')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-emerald-400 hidden md:table-cell">
                    {p.net_salary ? `€ ${p.net_salary.toLocaleString('nl-NL')}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.sent_at ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">Verzonden</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 border border-amber-500/20 text-amber-400">Openstaand</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                      {!p.sent_at && (
                        <button onClick={() => markSent(p.id)} className="p-1.5 rounded-lg hover:bg-emerald-500/15 text-white/40 hover:text-emerald-400 transition-colors" title="Markeer als verzonden">
                          <Send size={12} />
                        </button>
                      )}
                      <button onClick={() => setModal(p)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => del(p.id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-[#111] border-b border-white/8 px-5 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-white">{modal.id ? 'Loonstrook bewerken' : 'Loonstrook toevoegen'}</h2>
              <button onClick={() => setModal(null)} className="text-white/40 hover:text-white text-xl leading-none">×</button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Medewerker *</label>
                <select value={modal.employee_id ?? ''} onChange={e => setModal(m => ({ ...m, employee_id: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
                  <option value="">— Selecteer medewerker —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Periode (YYYY-MM) *</label>
                <input type="month" value={modal.period ?? ''} onChange={e => setModal(m => ({ ...m, period: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Bruto salaris (€)</label>
                  <input type="number" value={modal.gross_salary ?? ''} onChange={e => setModal(m => ({ ...m, gross_salary: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="3000"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
                <div>
                  <label className="text-xs text-white/50 mb-1 block">Netto salaris (€)</label>
                  <input type="number" value={modal.net_salary ?? ''} onChange={e => setModal(m => ({ ...m, net_salary: e.target.value ? Number(e.target.value) : undefined }))}
                    placeholder="2100"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50" />
                </div>
              </div>

              <div>
                <label className="text-xs text-white/50 mb-1 block">Notities</label>
                <textarea rows={2} value={modal.notes ?? ''} onChange={e => setModal(m => ({ ...m, notes: e.target.value }))}
                  placeholder="Interne notities..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-indigo-500/50 resize-none" />
              </div>
            </div>

            <div className="sticky bottom-0 bg-[#111] border-t border-white/8 px-5 py-4 flex justify-end gap-3">
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors">Annuleren</button>
              <button onClick={save} disabled={saving || !modal.employee_id || !modal.period}
                className="px-4 py-2 rounded-lg text-sm bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 transition-colors disabled:opacity-50">
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
