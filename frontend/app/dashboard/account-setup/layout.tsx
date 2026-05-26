import Link from 'next/link'
import {
  UserCheck, LayoutGrid, AlertCircle, Wallet, ShieldCheck,
  Link as LinkIcon, Tv2, Globe, Zap,
} from 'lucide-react'
import { getActiveCompany } from '@/lib/active-company-server'
import type { ReactNode } from 'react'

type SubNavEntry = {
  href: string
  label: string
  icon: typeof UserCheck
  status: 'live' | 'planned'
  phase?: number
}

const SUB_NAV: SubNavEntry[] = [
  { href: '/dashboard/account-setup',                 label: 'Overview',         icon: LayoutGrid,  status: 'live' },
  { href: '/dashboard/account-setup/accounts',        label: 'Accounts',         icon: UserCheck,   status: 'live' },
  { href: '/dashboard/account-setup/requires-action', label: 'Requires Action',  icon: AlertCircle, status: 'live' },
  { href: '/dashboard/account-setup/revenue',         label: 'Revenue',          icon: Wallet,      status: 'live' },
  { href: '/dashboard/account-setup/kyc',             label: 'KYC / Verification',icon: ShieldCheck, status: 'live' },
  { href: '/dashboard/account-setup/links',           label: 'Affiliate Links',  icon: LinkIcon,    status: 'live' },
  { href: '/dashboard/account-setup/youtube',         label: 'YouTube Connector',icon: Tv2,         status: 'planned', phase: 4 },
  { href: '/dashboard/account-setup/aquier',          label: 'Aquier Revenue',   icon: Globe,       status: 'planned', phase: 4 },
  { href: '/dashboard/account-setup/automation',      label: 'Automation',       icon: Zap,         status: 'planned', phase: 3 },
]

export default async function AccountSetupLayout({ children }: { children: ReactNode }) {
  const company = await getActiveCompany()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}
        >
          <UserCheck size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Affiliate &amp; Revenue Infrastructure</h1>
          <p className="text-xs text-white/50">Account Setup Agent · programma-registry, onboarding, KYC, payouts · {company.name}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5 border-b border-white/[0.06] pb-3">
        {SUB_NAV.map((entry) => {
          const Icon = entry.icon
          const isLive = entry.status === 'live'
          return (
            <Link
              key={entry.href}
              href={isLive ? entry.href : '#'}
              aria-disabled={!isLive}
              className={
                isLive
                  ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border border-white/[0.06] transition-colors'
                  : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/[0.02] text-white/25 border border-dashed border-white/10 cursor-not-allowed'
              }
              title={isLive ? entry.label : `Komt in Fase ${entry.phase}`}
            >
              <Icon size={11} />
              <span>{entry.label}</span>
              {!isLive && (
                <span className="text-[9px] uppercase tracking-wide text-white/30 ml-0.5">F{entry.phase}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
