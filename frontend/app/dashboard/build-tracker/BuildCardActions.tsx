'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, ArrowRight, X, Flag, Loader2, KeyRound } from 'lucide-react'
import { ActionCTA } from '@/components/executive/ActionCTA'
import { resumeBuild } from './actions'
import { prepareAccountSetup } from '../accounts/actions'
import { accountStatusBadge } from '@/lib/account-setup'

type Props = {
  id: string
  name: string
  status: string
  description: string | null
  currentMilestone: string | null
  progress: number
  companyColor: string
  requiresAccountSetup?: boolean
  accountStatus?: string
}

export default function BuildCardActions({
  id, name, status, description, currentMilestone, progress, companyColor,
  requiresAccountSetup, accountStatus,
}: Props) {
  const router = useRouter()
  const [showPreview, setShowPreview] = useState(false)
  const [pending, startTransition] = useTransition()
  const [acctPending, startAcct] = useTransition()

  const isLive = status === 'live'

  function goDetail() {
    router.push(`/dashboard/build-tracker/${id}`)
  }

  function handleResume() {
    startTransition(async () => {
      await resumeBuild(id)
      router.push(`/dashboard/build-tracker/${id}`)
    })
  }

  // "Maak account aan" → bereid voor (status → voorbereiden) en open de agent.
  function handleAccount() {
    startAcct(async () => {
      await prepareAccountSetup(id)
      router.push(`/dashboard/build-tracker/${id}/account-setup`)
    })
  }

  return (
    <>
      <div className="mt-3 flex items-center gap-2 pt-3 border-t border-white/[0.06]">
        <ActionCTA
          label="Preview"
          intent="neutral"
          size="xs"
          icon={<Eye size={11} />}
          onClick={() => setShowPreview(true)}
        />
        {isLive ? (
          <ActionCTA
            label="Bekijk"
            intent="neutral"
            size="xs"
            icon={<ArrowRight size={11} />}
            onClick={goDetail}
          />
        ) : (
          <ActionCTA
            label={pending ? 'Bezig…' : 'Ga verder'}
            intent="push"
            size="xs"
            disabled={pending}
            icon={pending ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />}
            onClick={handleResume}
          />
        )}
        {requiresAccountSetup && (
          <ActionCTA
            label={acctPending ? 'Bezig…' : 'Maak account aan'}
            intent="amplify"
            size="xs"
            disabled={acctPending}
            icon={acctPending ? <Loader2 size={11} className="animate-spin" /> : <KeyRound size={11} />}
            onClick={handleAccount}
          />
        )}
      </div>

      {requiresAccountSetup && accountStatus && (
        <div className="mt-2">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${accountStatusBadge(accountStatus).color}`}>
            account: {accountStatusBadge(accountStatus).label}
          </span>
        </div>
      )}

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPreview(false)} />
          <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
              <div className="pr-4">
                <p className="text-sm font-semibold text-white leading-tight">{name}</p>
                <p className="text-[10px] text-white/40 mt-0.5">Taak­omschrijving · {progress}% voltooid</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-white/50 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {currentMilestone && (
                <div className="flex items-center gap-2 text-[11px]" style={{ color: companyColor }}>
                  <Flag size={12} />
                  <span className="font-medium">{currentMilestone}</span>
                </div>
              )}
              <div>
                <p className="text-[10px] text-white/35 uppercase tracking-wide mb-1.5">Omschrijving</p>
                <p className="text-[12.5px] text-white/75 leading-relaxed whitespace-pre-wrap">
                  {description?.trim() || 'Geen omschrijving vastgelegd voor deze build.'}
                </p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-white/[0.06]">
                {!isLive && (
                  <button
                    onClick={handleResume}
                    disabled={pending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50 text-xs font-medium py-2 rounded-lg transition-colors"
                  >
                    {pending ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                    Ga verder
                  </button>
                )}
                <button
                  onClick={goDetail}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-white/10 text-white/70 hover:bg-white/[0.06] text-xs font-medium py-2 rounded-lg transition-colors"
                >
                  Open detail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
