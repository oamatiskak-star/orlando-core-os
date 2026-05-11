'use client'

import { Users, UserPlus, Pencil, Trash2, Shield } from 'lucide-react'

const roles = [
  { role: 'SUPER_ADMIN', color: 'bg-indigo-500/10 text-indigo-400', desc: 'Volledige toegang tot alle modules, BVs en systeeminstellingen.' },
  { role: 'ADMIN', color: 'bg-sky-500/10 text-sky-400', desc: 'Toegang tot alle modules binnen toegewezen BV, geen systeeminstellingen.' },
  { role: 'PROJECT_MANAGER', color: 'bg-emerald-500/10 text-emerald-400', desc: 'Projecten, taken en planning beheren. Geen financiële toegang.' },
  { role: 'ACCOUNTING', color: 'bg-amber-500/10 text-amber-400', desc: 'Financiën, facturen en administratie inzien en bewerken.' },
  { role: 'CLIENT', color: 'bg-purple-500/10 text-purple-400', desc: 'Alleen kopersportaal en eigen documenten inzien.' },
  { role: 'AGENT', color: 'bg-pink-500/10 text-pink-400', desc: 'AI-agent entiteit. Geen UI-toegang, alleen API-acties.' },
  { role: 'EXECUTOR', color: 'bg-orange-500/10 text-orange-400', desc: 'Executor-systeem. Voert taken uit vanuit de task queue.' },
]

export default function GebruikersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users size={16} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Gebruikers</h1>
            <p className="text-xs text-white/30">Gebruikersbeheer, rollen en rechten per bedrijf.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <UserPlus size={13} />
          Gebruiker uitnodigen
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Actieve gebruikers</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Gebruiker</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">E-mail</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Rol</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Bedrijf</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Laatste login</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Acties</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-[11px] font-semibold text-white">O</div>
                    <span className="text-xs text-white font-medium">Orlando</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-white/50">o.amatiskak@icloud.com</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400">
                    SUPER_ADMIN
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-white/50">Alle BV&apos;s</td>
                <td className="px-4 py-3 text-xs text-white/50">Vandaag</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-colors">
                      <Pencil size={11} />
                    </button>
                    <button className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-red-400 hover:border-red-500/30 transition-colors">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Roles & Permissions */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={14} className="text-white/40" />
          <h2 className="text-sm font-semibold text-white">Rollen &amp; Rechten</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roles.map((r) => (
            <div key={r.role} className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
              <span className={`self-start px-2 py-0.5 rounded-full text-[10px] font-semibold ${r.color}`}>
                {r.role}
              </span>
              <p className="text-[11px] text-white/40 leading-relaxed">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
