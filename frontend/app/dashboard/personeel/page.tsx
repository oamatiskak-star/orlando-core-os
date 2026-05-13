'use client'

import Link from 'next/link'
import { Users, FileText, ScrollText, ReceiptText, Key, UserCheck } from 'lucide-react'

const MODULES = [
  { href: '/dashboard/personeel/medewerkers', icon: UserCheck, label: 'Medewerkers',   desc: 'Actieve medewerkers en ZZP-ers' },
  { href: '/dashboard/personeel/contracten',  icon: ScrollText, label: 'Contracten',    desc: 'Arbeids- en ZZP-contracten' },
  { href: '/dashboard/personeel/loonstroken', icon: ReceiptText, label: 'Loonstroken',  desc: 'Loonstroken en salarisoverzichten' },
  { href: '/dashboard/personeel/admin',       icon: FileText,   label: 'Administratie', desc: 'HR-administratie en dossiers' },
  { href: '/dashboard/personeel/documenten',  icon: FileText,   label: 'Documenten',    desc: 'Personeelsdocumenten en formulieren' },
  { href: '/dashboard/personeel/ubo',         icon: Key,        label: 'UBO Register',  desc: 'Ultimate Beneficial Owners' },
]

export default function PersoneelPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Personeel</h1>
        <p className="text-sm text-white/65 mt-0.5">HR, contracten, loonstroken en medewerkersbeheer</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MODULES.map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}
            className="bg-white/[0.06] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 hover:bg-white/[0.09] transition-colors">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Icon size={16} className="text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/65">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
