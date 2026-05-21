'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TemplateSelector, TemplatePreview } from '../../_components/TemplateSelector'
import { fillTemplate, extractPlaceholdersFromContext } from '@/lib/mail/reply-generator'
import { ChevronLeft, Send, X, Copy } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

interface DraftData {
  id: string
  to_email: string
  subject: string
  body: string
  status: string
  ai_confidence: number
  from_email: string
  priority: string
  company: string | null
  category: string | null
  original_body: string
}

interface Template {
  id: string
  name: string
  category: string
  subject_template: string
  body_template: string
  placeholder_hints: Record<string, string> | null
  sentiment: string
}

export default function DraftEditorPage() {
  const params = useParams()
  const draftId = params.draftId as string
  const [draft, setDraft] = useState<DraftData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [placeholders, setPlaceholders] = useState<Record<string, string>>({})
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const supabase = createClient()

  useEffect(() => {
    const fetchDraft = async () => {
      try {
        const { data, error } = await supabase
          .from('mail_drafts')
          .select(
            `
            id,
            to_email,
            subject,
            body,
            status,
            ai_confidence,
            message_id,
            mail_messages(from_email, priority, company, category, body_text)
          `
          )
          .eq('id', draftId)
          .single()

        if (error || !data) {
          console.error('Error fetching draft:', error)
          return
        }

        const draftData = {
          id: data.id,
          to_email: data.to_email,
          subject: data.subject,
          body: data.body,
          status: data.status,
          ai_confidence: data.ai_confidence,
          from_email: data.mail_messages?.from_email || 'Unknown',
          priority: data.mail_messages?.priority || 'normal',
          company: data.mail_messages?.company,
          category: data.mail_messages?.category,
          original_body: data.mail_messages?.body_text || '',
        }

        setDraft(draftData)
        setSubject(draftData.subject)
        setBody(draftData.body)
      } catch (e) {
        console.error('Error:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchDraft()
  }, [draftId, supabase])

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    // Extract placeholder values from context
    if (template.placeholder_hints) {
      const keys = Object.keys(template.placeholder_hints)
      const extracted = extractPlaceholdersFromContext(
        {
          from_email: draft?.from_email || '',
          subject: draft?.subject || '',
          body: draft?.original_body || '',
          company: draft?.company,
          category: draft?.category,
          priority: draft?.priority,
        },
        keys
      )
      setPlaceholders(extracted)
    }
  }

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return
    const filled = fillTemplate(selectedTemplate, placeholders)
    setSubject(filled.subject)
    setBody(filled.body)
  }

  const handleSave = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('mail_drafts')
        .update({
          subject,
          body,
          status: 'pending',
        })
        .eq('id', draft.id)

      if (error) {
        console.error('Error saving draft:', error)
        return
      }
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!draft) return
    setSaving(true)
    try {
      const response = await fetch(`/api/mail/drafts/${draft.id}/approve/fast`, {
        method: 'POST',
      })
      if (response.ok) {
        // Redirect back to dashboard
        window.location.href = '/dashboard'
      }
    } catch (e) {
      console.error('Error approving:', e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white/40">Loading draft...</p>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-white/40">Draft not found</p>
        <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300">
          Back to dashboard
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300">
          <ChevronLeft size={16} />
          Back
        </Link>
        <h1 className="text-2xl font-bold text-white">Draft Editor</h1>
        <div className="w-20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original Email */}
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <h3 className="text-xs font-semibold text-white/80 mb-3">📧 Original Email</h3>
            <div className="space-y-2 text-xs text-white/60">
              <p>
                <span className="text-white/40">From:</span> {draft.from_email}
              </p>
              <p>
                <span className="text-white/40">Subject:</span> {draft.subject}
              </p>
              <div className="mt-3 pt-3 border-t border-white/10 max-h-48 overflow-y-auto">
                <p className="whitespace-pre-wrap text-white/50">{draft.original_body}</p>
              </div>
            </div>
          </div>

          {/* Draft Editor */}
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-semibold text-white/80">✍️ Your Response</h3>

            <div>
              <label className="text-xs text-white/60 block mb-2">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-white/60 block mb-2">Body</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-indigo-500/50 focus:outline-none resize-none"
              />
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between text-[11px] text-white/50 pt-2 border-t border-white/10">
              <span>Confidence: {Math.round(draft.ai_confidence * 100)}%</span>
              <span>To: {draft.to_email}</span>
            </div>
          </div>
        </div>

        {/* Sidebar: Templates & Actions */}
        <div className="space-y-4">
          {/* Template Selector */}
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <TemplateSelector
              category={draft.category || undefined}
              company={draft.company || undefined}
              onTemplateSelect={handleTemplateSelect}
              selectedTemplateId={selectedTemplate?.id}
            />
          </div>

          {/* Template Preview */}
          {selectedTemplate && (
            <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
              <TemplatePreview
                template={selectedTemplate}
                placeholders={placeholders}
                onPlaceholderChange={(key, value) => {
                  setPlaceholders({ ...placeholders, [key]: value })
                }}
              />
              <button
                onClick={handleApplyTemplate}
                className="w-full mt-3 px-3 py-2 bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/30 rounded text-xs font-medium transition-colors"
              >
                Apply Template
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-2">
            <button
              onClick={handleApprove}
              disabled={saving}
              className={clsx(
                'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded font-medium text-sm transition-colors',
                saving
                  ? 'bg-green-500/10 text-green-400/50 cursor-not-allowed'
                  : 'bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30'
              )}
            >
              <Send size={16} />
              Approve & Send
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              Save Changes
            </button>
            <button
              onClick={() => window.history.back()}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 rounded text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
