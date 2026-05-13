'use client'

import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import clsx from 'clsx'

const tabs = ['Alle', 'Urgent', 'Vandaag', 'Deze week', 'Afgerond']

const taken = [
  { prioriteit: 'HOOG', taak: 'Sync scripts testen op Mac Mini 2', bv: 'MODIWÉ', toegewezen: 'Orlando', deadline: 'Vandaag', status: 'In behandeling' },
  { prioriteit: 'HOOG', taak: 'Supabase gebruikers aanmaken', bv: 'MODIWÉ', toegewezen: 'Orlando', deadline: 'Vandaag', status: 'Afgerond' },
  { prioriteit: 'HOOG', taak: 'Vercel productie deployment controleren', bv: 'MODIWÉ', toegewezen: 'Orlando', deadline: 'Vandaag', status: 'Afgerond' },
  { prioriteit: 'MIDDEN', taak: 'VastgoedScalper module bouwen', bv: 'BEHEER', toegewezen: 'Orlando', deadline: '15 mei', status: 'Open' },
  { prioriteit: 'MIDDEN', taak: 'Mail Agent regels configureren', bv: 'MODIWÉ', toegewezen: 'Orlando', deadline: '14 mei', status: 'In behandeling' },
  { prioriteit: 'MIDDEN', taak: 'YouTube Agent upload schema instellen', bv: 'MEDIA', toegewezen: 'Orlando', deadline: '16 mei', status: 'Open' },
  { prioriteit: 'MIDDEN', taak: 'SterkCalc koppeling bouwen', bv: 'BOUW', toegewezen: 'Orlando', deadline: '20 mei', status: 'Open' },
  { prioriteit: 'LAAG', taak: 'CRM contacten importeren', bv: 'BEHEER', toegewezen: 'Orlando', deadline: '31 mei', status: 'Open' },
  { prioriteit: 'LAAG', taak: 'Abonnementen overzicht updaten', bv: 'MODIWÉ', toegewezen: 'Orlando', deadline: '31 mei', status: 'Open' },
  { prioriteit: 'LAAG', taak: 'Documentenmodule mapstructuur inrichten', bv: 'MODIWÉ', toegewezen: 'Orlando', deadline: '31 mei', status: 'Open' },
]

const prioriteitBadge = (p: string) => {
  if (p === 'HOOG') return 'bg-red-500/10 text-red-400'
  if (p === 'MIDDEN') return 'bg-amber-500/10 text-amber-400'
  return 'bg-white/5 text-white/50'
}

const statusBadge = (s: string) => {
  if (s === 'Afgerond') return 'bg-green-500/10 text-green-400'
  if (s === 'In behandeling') return 'bg-amber-500/10 text-amber-400'
  return 'bg-white/[0.08] text-white/65'
}

export default function TakenPage() {
  const [activeTab, setActiveTab] = useState('Alle')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
          <CheckSquare size={16} className="text-yellow-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Taken</h1>
          <p className="text-xs text-white/50">Openstaande taken, acties en prioriteiten over alle BV&apos;s.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open', value: '14', color: 'text-white' },
          { label: 'Urgent', value: '3', color: 'text-red-400' },
          { label: 'Deze week', value: '7', color: 'text-amber-400' },
          { label: 'Afgerond', value: '24', color: 'text-green-400' },
        ].map((s) => (
          <div key={s.label} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
            <p className="text-[11px] text-white/50 mb-1">{s.label}</p>
            <p className={`text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.06] border border-white/5 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              activeTab === tab
                ? 'bg-indigo-600 text-white'
                : 'text-white/65 hover:text-white/70'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tasks Table */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Prioriteit</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Taak</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">BV</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Toegewezen</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Deadline</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/50 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {taken.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-semibold', prioriteitBadge(row.prioriteit))}>
                      {row.prioriteit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/80 max-w-[260px]">{row.taak}</td>
                  <td className="px-4 py-3 text-xs text-white/65">{row.bv}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{row.toegewezen}</td>
                  <td className="px-4 py-3 text-xs text-white/50 whitespace-nowrap">{row.deadline}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-medium', statusBadge(row.status))}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
