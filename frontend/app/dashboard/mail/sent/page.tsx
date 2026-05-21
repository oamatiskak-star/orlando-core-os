import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ChevronLeft, CheckCircle, Clock, Send } from 'lucide-react'
import clsx from 'clsx'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SentMailPage() {
  const supabase = await createClient()

  const { data: sentDrafts } = await supabase
    .from('mail_drafts')
    .select(
      `
      id,
      subject,
      to_email,
      ai_confidence,
      created_at,
      updated_at,
      status,
      mail_messages(from_email, category, priority, company)
    `
    )
    .in('status', ['approved', 'sent'])
    .order('updated_at', { ascending: false })
    .limit(100)

  const approvalTypeLabel = (status: string) => {
    if (status === 'approved') return '🟢 Auto-approved'
    if (status === 'sent') return '📤 Sent'
    return status
  }

  const confidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'bg-green-500/20 text-green-400'
    if (confidence > 0.5) return 'bg-amber-500/20 text-amber-400'
    return 'bg-red-500/20 text-red-400'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard/mail" className="text-indigo-400 hover:text-indigo-300">
              <ChevronLeft size={16} />
            </Link>
            <h1 className="text-2xl font-bold text-white">Sent Mail</h1>
          </div>
          <p className="text-sm text-white/50">AI-generated and approved email responses</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-400">{sentDrafts?.length ?? 0}</p>
          <p className="text-xs text-white/50">Total</p>
        </div>
      </div>

      {/* Content */}
      {!sentDrafts || sentDrafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 bg-white/[0.03] border border-white/10 rounded-lg">
          <Send size={32} className="text-indigo-400" />
          <p className="text-white/60">No sent mail yet</p>
          <p className="text-sm text-white/40">AI-generated responses will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sentDrafts.map((draft: any) => (
            <Link
              key={draft.id}
              href={`/dashboard/mail/draft/${draft.id}`}
              className="block p-4 bg-white/[0.03] border border-white/10 rounded-lg hover:bg-white/[0.05] hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white mb-2">{draft.subject}</h3>

                  <div className="space-y-1 text-xs text-white/60 mb-3">
                    <p>📧 From: {draft.mail_messages?.from_email}</p>
                    <p>📤 To: {draft.to_email}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {draft.mail_messages?.category && (
                      <span className="px-2 py-1 rounded bg-white/10 text-white/70 text-xs">
                        {draft.mail_messages.category}
                      </span>
                    )}
                    {draft.mail_messages?.priority && (
                      <span className={clsx(
                        'px-2 py-1 rounded text-xs font-medium',
                        draft.mail_messages.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                        draft.mail_messages.priority === 'high' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-white/10 text-white/70'
                      )}>
                        {draft.mail_messages.priority}
                      </span>
                    )}
                    {draft.mail_messages?.company && (
                      <span className="px-2 py-1 rounded bg-indigo-500/20 text-indigo-400 text-xs">
                        {draft.mail_messages.company}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <div className={clsx(
                    'px-3 py-2 rounded-lg font-medium text-sm mb-2',
                    confidenceColor(draft.ai_confidence)
                  )}>
                    {Math.round(draft.ai_confidence * 100)}%
                  </div>
                  <p className="text-[11px] text-white/50 mb-2">
                    {approvalTypeLabel(draft.status)}
                  </p>
                  <p className="text-[10px] text-white/40">
                    {new Date(draft.updated_at || draft.created_at).toLocaleTimeString('nl-NL', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
