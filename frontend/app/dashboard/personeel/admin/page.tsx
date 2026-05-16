'use client'

import { useEffect, useState } from 'react'
import { Users, ScrollText, ReceiptText, FileText, AlertTriangle, CheckCircle, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

type Stats = {
  employees: number
  activeContracts: number
  expiringContracts: number
  unsentPayslips: number
  uboCount: number
}

export default function PersoneelAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [er, cr, pr, ur] = await Promise.all([
        fetch('/api/personeel/employees', { cache: 'no-store' }),
        fetch('/api/personeel/contracts', { cache: 'no-store' }),
        fetch('/api/personeel/payslips', { cache: 'no-store' }),
        fetch('/api/personeel/ubo', { cache: 'no-store' }),
      ])

      const employees  = er.ok  ? (await er.json()).employees  ?? [] : []
      const contracts  = cr.ok  ? (await cr.json()).contracts  ?? [] : []
      const payslips   = pr.ok  ? (await pr.json()).payslips   ?? [] : []
      const uboRecords = ur.ok  ? (await ur.json()).records    ?? [] : []

      const now = Date.now()
      const expiringContracts = contracts.filter((c: { status: string; end_date: string }) => {
        if (!c.end_date || c.status !== 'actief') return false
        const diff = new Date(c.end_date).getTime() - now
        return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000
      }).length

      setStats({
        employees:        employees.filter((e: { status: string }) => e.status === 'actief').length,
        activeContracts:  contracts.filter((c: { status: string }) => c.status === 'actief').length,
        expiringContracts,
        unsentPayslips:   payslips.filter((p: { sent_at: string | null }) => !p.sent_at).length,
        uboCount:         uboRecords.length,
      })
      setLoading(false)
    }
    load()
  }, [])

  const MODULES = [
    { href: '/dashboard/personeel/medewerkers', icon: Users,       label: 'Medewerkers',   desc: 'Actieve medewerkers en ZZP-ers',           color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
    { href: '/dashboard/personeel/contracten',  icon: ScrollText,  label: 'Contracten',    desc: 'Arbeids- en ZZP-contracten beheren',       color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
    { href: '/dashboard/personeel/loonstroken', icon: ReceiptText, label: 'Loonstroken',   desc: 'Salarisoverzichten registreren en versturen', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    { href: '/dashboard/personeel/documenten',  icon: FileText,    label: 'Documenten',    desc: 'VOG, diploma\'s, certificaten en ID',      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    { href: '/dashboard/personeel/ubo',         icon: LinkIcon,    label: 'UBO Register',  desc: 'Wettelijk verplichte eigendomsregistratie', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">HR Administratie</h1>
        <p className="text-sm text-white/65 mt-0.5">Overzicht personeelsbeheer en HR-dossiers</p>
      </div>

      {/* Stats */}
      {!loading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Actieve medewerkers', value: stats.employees,         color: 'text-indigo-400', alert: false },
            { label: 'Actieve contracten',  value: stats.activeContracts,   color: 'text-violet-400', alert: false },
            { label: 'Verloopt binnenkort', value: stats.expiringContracts, color: 'text-amber-400',  alert: stats.expiringContracts > 0 },
            { label: 'Loonstroken open',    value: stats.unsentPayslips,    color: 'text-sky-400',    alert: stats.unsentPayslips > 0 },
            { label: 'UBO registraties',    value: stats.uboCount,          color: 'text-emerald-400',alert: false },
          ].map(({ label, value, color, alert }) => (
            <div key={label} className={clsx('bg-white/[0.06] border rounded-xl p-4', alert && value > 0 ? 'border-amber-500/30' : 'border-white/5')}>
              <div className="flex items-start justify-between">
                <p className={clsx('text-xl font-bold', color)}>{value}</p>
                {alert && value > 0 && <AlertTriangle size={14} className="text-amber-400 mt-0.5" />}
                {(!alert || value === 0) && <CheckCircle size={14} className="text-white/20 mt-0.5" />}
              </div>
              <p className="text-xs text-white/45 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Alerts */}
      {!loading && stats && (stats.expiringContracts > 0 || stats.unsentPayslips > 0) && (
        <div className="space-y-2">
          {stats.expiringContracts > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle size={14} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400/90">
                {stats.expiringContracts} contract(en) verlopen binnen 30 dagen.{' '}
                <Link href="/dashboard/personeel/contracten" className="underline hover:no-underline">Bekijken →</Link>
              </p>
            </div>
          )}
          {stats.unsentPayslips > 0 && (
            <div className="bg-sky-500/5 border border-sky-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <ReceiptText size={14} className="text-sky-400 shrink-0" />
              <p className="text-xs text-sky-400/90">
                {stats.unsentPayslips} loonstrook/loonstroken nog niet verzonden.{' '}
                <Link href="/dashboard/personeel/loonstroken" className="underline hover:no-underline">Bekijken →</Link>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Module links */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MODULES.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}
            className="bg-white/[0.06] border border-white/8 rounded-xl p-5 space-y-2 hover:border-white/15 hover:bg-white/[0.09] transition-colors">
            <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center border', color)}>
              <Icon size={16} />
            </div>
            <p className="text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/65">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
