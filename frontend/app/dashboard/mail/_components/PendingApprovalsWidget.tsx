'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, CheckCircle, XCircle, Edit2, ArrowUpRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

interface PendingDraft {
  id: string
  to_email: string
  subject: string
  status: 'pending' | 'sandbox' | 'approved' | 'sent' | 'rejected'
  ai_confidence: number
  from_email: string
  priority: string
  company: string | null
  category: string | null
}

export function PendingApprovalsWidget() {
  const [drafts, setDrafts] = useState<PendingDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const { data, error: err } = await supabase
          .from('mail_drafts')
          .select(`
            id,
            to_email,
            subject,
            status,
            ai_confidence,
            message_id,
            mail_messages(from_email, priority, company, category)
          `)
          .eq('status', 'pending')
          .order('ai_confidence', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10)

        if (err) {
          console.error('Error fetching drafts:', err)
          setError(err.message)
          return
        }

        const formattedDrafts = (data ?? []).map((draft: any) => ({
          id: draft.id,
          to_email: draft.to_email,
          subject: draft.subject,
          status: draft.status,
          ai_confidence: draft.ai_confidence,
          from_email: draft.mail_messages?.from_email || 'Unknown',
          priority: draft.mail_messages?.priority || 'normal',
          company: draft.mail_messages?.company,
          category: draft.mail_messages?.category,
        }))

        setDrafts(formattedDrafts)
      } catch (e) {
        console.error('Error:', e)
        setError('Failed to fetch pending approvals')
      } finally {
        setLoading(false)
      }
    }

    fetchDrafts()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('mail_drafts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mail_drafts',
          filter: `status=eq.pending`,
        },
        () => {
          fetchDrafts()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [supabase])

  const confidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500/10 text-green-400 border-green-500/20'
    if (confidence >= 0.6) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    return 'bg-red-500/10 text-red-400 border-red-500/20'
  }

  const confidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return '🟢 Auto-approve Ready'
    if (confidence >= 0.6) return '🟡 Review Suggested'
    return '🔴 Manual Review'
  }

  const priorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'text-red-400'
      case 'high':
        return 'text-amber-400'
      case 'normal':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  const handleApprove = async (draftId: string) => {
    try {
      const response = await fetch(`/api/mail/drafts/${draftId}/approve/fast`, {
        method: 'POST',
      })
      if (response.ok) {
        // Remove from local state
        setDrafts(drafts.filter(d => d.id !== draftId))
      }
    } catch (e) {
      console.error('Error approving draft:', e)
    }
  }

  const handleReject = async (draftId: string) => {
    try {
      const response = await fetch(`/api/mail/drafts/${draftId}/reject`, {
        method: 'POST',
      })
      if (response.ok) {
        setDrafts(drafts.filter(d => d.id !== draftId))
      }
    } catch (e) {
      console.error('Error rejecting draft:', e)
    }
  }

  return (
    <div className="bg-white/[0.06] border border-white/5 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <Mail size={16} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">📧 Pending Approvals</h2>
            <p className="text-[11px] text-white/50 mt-0.5">AI-generated responses awaiting your approval</p>
          </div>
        </div>
        <Link
          href="/dashboard/mail/approvals"
          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          View All <ArrowUpRight size={11} />
        </Link>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-8 flex items-center justify-center">
          <p className="text-xs text-white/40">Loading pending approvals...</p>
        </div>
      ) : error ? (
        <div className="py-6 flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <Mail size={24} className="text-white/15" />
          <p className="text-xs text-white/40">No pending approvals</p>
          <p className="text-[11px] text-white/30">All caught up! ✓</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="bg-white/[0.03] border border-white/5 rounded-lg p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all"
            >
              {/* Row 1: From + Company + Confidence */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/60 truncate">From: {draft.from_email}</p>
                  {draft.company && (
                    <p className="text-[10px] text-white/40 mt-1">
                      Company: <span className="text-white/60">{draft.company}</span>
                    </p>
                  )}
                </div>
                <div
                  className={clsx(
                    'px-2.5 py-1.5 rounded-lg border text-[10px] font-medium flex-shrink-0 whitespace-nowrap',
                    confidenceColor(draft.ai_confidence)
                  )}
                >
                  {Math.round(draft.ai_confidence * 100)}%
                </div>
              </div>

              {/* Row 2: Subject */}
              <p className="text-xs text-white/80 font-medium mb-2 line-clamp-2">{draft.subject}</p>

              {/* Row 3: Category + Priority + Confidence Label */}
              <div className="flex items-center gap-2 mb-3 text-[10px] text-white/50 flex-wrap">
                {draft.category && (
                  <span className="px-2 py-0.5 bg-white/5 rounded border border-white/10">
                    {draft.category}
                  </span>
                )}
                {draft.priority && draft.priority !== 'normal' && (
                  <span className={clsx('px-2 py-0.5 bg-white/5 rounded border border-white/10', priorityColor(draft.priority))}>
                    {draft.priority}
                  </span>
                )}
                <span className="text-[10px]">{confidenceLabel(draft.ai_confidence)}</span>
              </div>

              {/* Row 4: Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(draft.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors text-[11px] font-medium"
                >
                  <CheckCircle size={14} />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(draft.id)}
                  className="flex items-center justify-center px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-[11px] font-medium"
                >
                  <XCircle size={14} />
                </button>
                <Link
                  href={`/dashboard/mail/draft/${draft.id}`}
                  className="flex items-center justify-center px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors text-[11px] font-medium"
                >
                  <Edit2 size={14} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {drafts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
          <p className="text-[11px] text-white/50">{drafts.length} pending approvals</p>
          <Link
            href="/dashboard/mail/approvals"
            className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Manage all →
          </Link>
        </div>
      )}
    </div>
  )
}
