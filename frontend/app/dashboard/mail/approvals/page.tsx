'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ChevronLeft, Clock, Check, X, Filter } from 'lucide-react'
import clsx from 'clsx'

interface DraftRow {
  id: string
  subject: string
  to_email: string
  ai_confidence: number
  created_at: string
  mail_messages: {
    from_email: string
    category: string
    priority: string
    company: string
  }
}

export default function ApprovalsPage() {
  const [drafts, setDrafts] = useState<DraftRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set())
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    const fetchDrafts = async () => {
      try {
        const { data, error } = await supabase
          .from('mail_drafts')
          .select(
            `
            id,
            subject,
            to_email,
            ai_confidence,
            created_at,
            mail_messages(from_email, category, priority, company)
          `
          )
          .eq('status', 'pending')
          .order('created_at', { ascending: false })

        if (!error && data) {
          setDrafts(data as DraftRow[])
        }
      } catch (e) {
        console.error('Error fetching drafts:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchDrafts()

    // Subscribe to changes
    const subscription = supabase
      .channel('mail_drafts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mail_drafts',
          filter: 'status=eq.pending',
        },
        () => {
          fetchDrafts()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const confidenceColor = (confidence: number) => {
    if (confidence > 0.8) return 'bg-green-500/20 text-green-400'
    if (confidence > 0.5) return 'bg-amber-500/20 text-amber-400'
    return 'bg-red-500/20 text-red-400'
  }

  const confidenceBadge = (confidence: number) => {
    if (confidence > 0.8) return '🟢 Auto-approve Ready'
    if (confidence > 0.5) return '🟡 Review Suggested'
    return '🔴 Manual Review'
  }

  const getConfidenceLevel = (confidence: number): 'high' | 'medium' | 'low' => {
    if (confidence > 0.8) return 'high'
    if (confidence > 0.5) return 'medium'
    return 'low'
  }

  const categories = Array.from(new Set(drafts.map(d => d.mail_messages?.category).filter(Boolean)))
  const companies = Array.from(new Set(drafts.map(d => d.mail_messages?.company).filter(Boolean)))

  const filteredDrafts = drafts.filter(draft => {
    // Apply confidence filter
    if (confidenceFilter !== 'all') {
      const level = getConfidenceLevel(draft.ai_confidence)
      if (level !== confidenceFilter) return false
    }

    // Apply category filter
    if (categoryFilter !== 'all' && draft.mail_messages?.category !== categoryFilter) {
      return false
    }

    // Apply company filter
    if (companyFilter !== 'all' && draft.mail_messages?.company !== companyFilter) {
      return false
    }

    return true
  })

  const handleSelectDraft = (draftId: string) => {
    const newSelected = new Set(selectedDrafts)
    if (newSelected.has(draftId)) {
      newSelected.delete(draftId)
    } else {
      newSelected.add(draftId)
    }
    setSelectedDrafts(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedDrafts.size === filteredDrafts.length) {
      setSelectedDrafts(new Set())
    } else {
      setSelectedDrafts(new Set(filteredDrafts.map(d => d.id)))
    }
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
            <h1 className="text-2xl font-bold text-white">Mail Approvals</h1>
          </div>
          <p className="text-sm text-white/50">Review and approve AI-generated email responses</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-amber-400">{filteredDrafts.length}</p>
          <p className="text-xs text-white/50">Showing {selectedDrafts.size > 0 && `${selectedDrafts.size} selected · `}{filteredDrafts.length} of {drafts.length}</p>
        </div>
      </div>

      {/* Filters */}
      {!loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
            <Filter size={14} />
            <span>Filters</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Confidence Filter */}
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value as any)}
              className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs hover:border-white/20 focus:border-indigo-500/50 focus:outline-none transition-colors"
            >
              <option value="all">All Confidence Levels</option>
              <option value="high">🟢 Auto-approve Ready (&gt;0.8)</option>
              <option value="medium">🟡 Review Suggested (0.5-0.8)</option>
              <option value="low">🔴 Manual Review (&lt;0.5)</option>
            </select>

            {/* Category Filter */}
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs hover:border-white/20 focus:border-indigo-500/50 focus:outline-none transition-colors"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}

            {/* Company Filter */}
            {companies.length > 0 && (
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-xs hover:border-white/20 focus:border-indigo-500/50 focus:outline-none transition-colors"
              >
                <option value="all">All Companies</option>
                {companies.map(comp => (
                  <option key={comp} value={comp}>{comp}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-white/40">Loading approvals...</p>
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 bg-white/[0.03] border border-white/10 rounded-lg">
          <Check size={32} className="text-green-400" />
          <p className="text-white/60">All caught up!</p>
          <p className="text-sm text-white/40">No pending mail approvals</p>
        </div>
      ) : (
        <>
          {/* Bulk Actions Bar */}
          {selectedDrafts.size > 0 && (
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedDrafts.size === filteredDrafts.length}
                  onChange={handleSelectAll}
                  className="rounded border-white/20 accent-indigo-500"
                />
                <span className="text-sm text-white">{selectedDrafts.size} selected</span>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-medium transition-colors">
                  ✓ Approve All
                </button>
                <button className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors">
                  ✕ Reject All
                </button>
              </div>
            </div>
          )}

          {/* Drafts List */}
          <div className="space-y-3">
            {filteredDrafts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 bg-white/[0.03] border border-white/10 rounded-lg">
                <Filter size={32} className="text-white/20" />
                <p className="text-white/60">No drafts match your filters</p>
                <p className="text-sm text-white/40">Try adjusting your filters</p>
              </div>
            ) : (
              filteredDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className={clsx(
                    'p-4 rounded-lg border transition-colors',
                    selectedDrafts.has(draft.id)
                      ? 'bg-indigo-500/20 border-indigo-500/40'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedDrafts.has(draft.id)}
                        onChange={() => handleSelectDraft(draft.id)}
                        className="rounded border-white/20 accent-indigo-500 mt-0.5"
                      />
                      <Link
                        href={`/dashboard/mail/draft/${draft.id}`}
                        className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                      >
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
                      </Link>
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <div className={clsx(
                        'px-3 py-2 rounded-lg font-medium text-sm mb-2',
                        confidenceColor(draft.ai_confidence)
                      )}>
                        {Math.round(draft.ai_confidence * 100)}%
                      </div>
                      <p className="text-[11px] text-white/50 mb-2">
                        {confidenceBadge(draft.ai_confidence)}
                      </p>
                      <p className="text-[10px] text-white/40">
                        {new Date(draft.created_at).toLocaleTimeString('nl-NL', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
