'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import CategoryBadge from './CategoryBadge'

interface MailMessage {
  id: string
  subject: string | null
  from_email: string | null
  from_name: string | null
  company: string | null
  category: string | null
  priority: string
  ai_summary: string | null
  received_at: string | null
  is_read: boolean
  threat_detected: boolean
  moneybird_status: string
}

interface MailCardProps {
  message: MailMessage
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  normal: 'bg-white/30',
  low:    'bg-white/15',
  spam:   'bg-zinc-500',
}

const COMPANY_BADGE: Record<string, string> = {
  STRKBEHEER: 'bg-indigo-500/20 text-indigo-300',
  STRKBOUW:   'bg-amber-500/20 text-amber-300',
  BOUWPROFFS: 'bg-emerald-500/20 text-emerald-300',
  YOUTUBE:    'bg-red-500/20 text-red-300',
  'PRIVÉ':    'bg-purple-500/20 text-purple-300',
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) {
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays < 7) {
    return date.toLocaleDateString('nl-NL', { weekday: 'short' })
  }
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export default function MailCard({ message }: MailCardProps) {
  const dotColor = PRIORITY_DOT[message.priority] ?? PRIORITY_DOT.normal
  const companyClass = message.company ? (COMPANY_BADGE[message.company] ?? '') : ''

  return (
    <Link
      href={`/mobile/mail/${message.id}`}
      className="block px-4 py-3 border-b border-white/[0.05] active:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1.5">
          <div className={`w-2 h-2 rounded-full ${message.is_read ? 'bg-transparent border border-white/20' : dotColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-[12px] font-semibold truncate ${message.is_read ? 'text-white/60' : 'text-white'}`}>
              {message.from_name ?? message.from_email ?? 'Onbekend'}
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {message.threat_detected && (
                <AlertTriangle size={12} className="text-red-400" />
              )}
              {message.moneybird_status === 'uploaded' && (
                <CheckCircle size={12} className="text-emerald-400" />
              )}
              {message.moneybird_status === 'pending' && (
                <Clock size={12} className="text-yellow-400" />
              )}
              <span className="text-[10px] text-white/30">
                {formatTime(message.received_at)}
              </span>
            </div>
          </div>

          <p className={`text-[12px] truncate mb-1 ${message.is_read ? 'text-white/40' : 'text-white/80'}`}>
            {message.subject ?? '(geen onderwerp)'}
          </p>

          {message.ai_summary && (
            <p className="text-[11px] text-white/35 truncate mb-1.5">
              {message.ai_summary}
            </p>
          )}

          <div className="flex items-center gap-1.5">
            {message.company && (
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${companyClass}`}>
                {message.company}
              </span>
            )}
            <CategoryBadge category={message.category} />
            {message.threat_detected && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                THREAT
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
