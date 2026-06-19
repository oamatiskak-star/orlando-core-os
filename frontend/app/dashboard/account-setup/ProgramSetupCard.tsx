'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Copy, Check, ExternalLink, ListChecks, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { AccountStatusBadge } from '@/lib/affiliate-programs/badges'
import type { ProgramOverviewRow } from '@/lib/affiliate-programs/types'
import type { ProgramSetup } from '@/lib/affiliate-programs/setup-data'
import ContinueInClaude from '@/components/build/ContinueInClaude'
import type { ContinuePromptContext } from '@/lib/continue-prompt'

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function CopyButton({ value, label = 'Kopieer' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors',
        copied
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white/85 hover:border-white/20'
      )}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Gekopieerd' : label}
    </button>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wide text-white/35">{label}</p>
      <p className="text-[11px] text-white/80 leading-snug break-words">{value}</p>
    </div>
  )
}

type Props = {
  program: ProgramOverviewRow
  setup: ProgramSetup | null
  detailHref: string
}

export function ProgramSetupCard({ program, setup, detailHref }: Props) {
  const [open, setOpen] = useState(false)
  const hasSetup = setup !== null

  const agentContext: ContinuePromptContext | null = setup
    ? {
        tracker: 'Affiliate & Revenue — Program Registry',
        itemType: 'affiliate-signup',
        name: `Affiliate signup: ${program.name}`,
        route: '/dashboard/account-setup',
        description:
          `Kijk live mee terwijl Orlando zich aanmeldt bij ${program.name} en help de aanmeldvragen beantwoorden. ` +
          'Gebruik de voorbereide gegevens (promotie-tekst, audience, payout/tax, in te vullen velden) uit ' +
          'affiliate_programs.metadata (signup_pack/setup/registration) en lib/affiliate-programs/setup-data.ts. ' +
          'Site = aquier.com, entiteit = Modiwerijo Financial Management BV (KvK 97494380, BTW NL868076314B01).',
        extra: [
          { label: 'Aanmeld-URL', value: setup.signupUrl },
          { label: 'Netwerk', value: setup.network },
          { label: 'Approval', value: setup.approval },
          { label: 'In te vullen velden', value: setup.requiredFields.join(' · ') },
        ],
      }
    : null

  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[13px] text-white/90 font-medium leading-tight truncate">{program.name}</span>
          <AccountStatusBadge status={program.account_status} size="xs" />
        </div>

        <div className="flex items-center gap-3 text-[10px] text-white/40">
          {Number(program.monthly_revenue) > 0 && (
            <span className="text-emerald-300/80 tabular-nums">{fmtMoney(Number(program.monthly_revenue))}/mo</span>
          )}
          {program.open_human_actions > 0 && (
            <span className="text-red-300/80">{program.open_human_actions} action{program.open_human_actions === 1 ? '' : 's'}</span>
          )}
          {program.active_runs > 0 && (
            <span className="text-blue-300/80">{program.active_runs} run{program.active_runs === 1 ? '' : 's'}</span>
          )}
          {program.required_docs > 0 && (
            <span className="text-amber-300/80">{program.required_docs} doc{program.required_docs === 1 ? '' : 's'}</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-2.5">
          {hasSetup ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-200/90 hover:text-violet-100 transition-colors"
            >
              {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              Setup-info
            </button>
          ) : (
            <span className="text-[10px] text-white/25">Setup nog niet voorbereid</span>
          )}
          <Link href={detailHref} className="text-[10px] text-white/45 hover:text-white/80 transition-colors">
            Beheer →
          </Link>
        </div>
      </div>

      {hasSetup && open && setup && (
        <div className="border-t border-white/[0.06] bg-white/[0.015] p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={setup.signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.10] px-2.5 py-1.5 text-[11px] font-semibold text-violet-100 hover:bg-violet-500/[0.18] transition-colors"
            >
              <ExternalLink size={12} />
              Open aanmeldpagina
            </a>
            {agentContext && <ContinueInClaude context={agentContext} size="xs" label="Agent meekijken" />}
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <Fact label="Netwerk" value={setup.network} />
            <Fact label="Approval" value={setup.approval} />
            <Fact label="Drempel" value={setup.threshold} />
            <Fact label="Cookie" value={setup.cookie} />
            <Fact label="Commissie" value={setup.commission} />
            <Fact label="Payout" value={setup.payout} />
          </div>

          {setup.kyc && (
            <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-1.5">
              <AlertTriangle size={12} className="text-amber-300 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-200/90 leading-snug">KYC / extra stap: {setup.kyc}</p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <ListChecks size={12} className="text-white/40" />
              <p className="text-[10px] uppercase tracking-wide text-white/40">Velden om in te vullen</p>
            </div>
            <ul className="space-y-0.5">
              {setup.requiredFields.map((field) => (
                <li key={field} className="flex items-start gap-1.5 text-[11px] text-white/70 leading-snug">
                  <span className="text-white/25 mt-0.5">•</span>
                  <span>{field}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-white/40">Plak-teksten</p>
            {setup.answers.map((answer) => (
              <div key={answer.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-medium text-white/55">{answer.label}</span>
                  <CopyButton value={answer.value} />
                </div>
                <p className="text-[11px] text-white/75 leading-snug whitespace-pre-wrap break-words">{answer.value}</p>
              </div>
            ))}
          </div>

          {setup.note && (
            <p className="text-[10px] text-white/45 leading-snug border-t border-white/[0.05] pt-2">{setup.note}</p>
          )}
        </div>
      )}
    </div>
  )
}
