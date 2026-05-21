'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { ChevronLeft, Library, Zap, Copy } from 'lucide-react'
import clsx from 'clsx'

interface Template {
  id: string
  name: string
  category: string
  company?: string
  subject_template: string
  body_template: string
  placeholder_hints?: Record<string, string>
  sentiment?: string
  confidence_min?: number
  enabled: boolean
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data } = await supabase
          .from('mail_templates')
          .select('*')
          .eq('enabled', true)
          .order('category', { ascending: true })
          .order('confidence_min', { ascending: false })

        if (data) {
          setTemplates(data)
        }
      } catch (e) {
        console.error('Error fetching templates:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [supabase])

  const categories = Array.from(new Set(templates.map(t => t.category)))

  const confidenceMinBadge = (min?: number) => {
    if (!min) return null
    if (min > 0.8) return '🟢 High Confidence'
    if (min > 0.5) return '🟡 Medium Confidence'
    return '🔴 Low Confidence'
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
            <h1 className="text-2xl font-bold text-white">Mail Templates</h1>
          </div>
          <p className="text-sm text-white/50">Pre-designed response templates for common email types</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-indigo-400">{templates.length}</p>
          <p className="text-xs text-white/50">Templates</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-white/40">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 bg-white/[0.03] border border-white/10 rounded-lg">
          <Library size={32} className="text-indigo-400" />
          <p className="text-white/60">No templates available</p>
          <p className="text-sm text-white/40">Contact administrator to add templates</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Template List */}
          <div className="lg:col-span-2 space-y-3">
            {categories.map(category => (
              <div key={category} className="space-y-2">
                <h2 className="text-xs font-semibold text-white/60 uppercase tracking-wider px-1">
                  {category}
                </h2>
                <div className="space-y-2">
                  {templates
                    .filter(t => t.category === category)
                    .map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={clsx(
                          'w-full text-left p-4 rounded-lg border transition-colors',
                          selectedTemplate?.id === template.id
                            ? 'bg-indigo-500/20 border-indigo-500/40'
                            : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-white">{template.name}</h3>
                            {template.company && (
                              <p className="text-xs text-white/50 mt-1">🏢 {template.company}</p>
                            )}
                          </div>
                          {confidenceMinBadge(template.confidence_min) && (
                            <span className="text-[10px] text-white/40 flex-shrink-0">
                              {confidenceMinBadge(template.confidence_min)}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Template Preview */}
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">{selectedTemplate.name}</h3>
                  {selectedTemplate.company && (
                    <p className="text-xs text-white/50">Company: {selectedTemplate.company}</p>
                  )}
                  {selectedTemplate.sentiment && (
                    <p className="text-xs text-white/50">Sentiment: {selectedTemplate.sentiment}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-white/60 block mb-2">Subject Template</label>
                    <div className="p-2 bg-white/[0.05] rounded text-xs text-white/80 font-mono break-words">
                      {selectedTemplate.subject_template}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-white/60 block mb-2">Body Template</label>
                    <div className="p-2 bg-white/[0.05] rounded text-xs text-white/80 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                      {selectedTemplate.body_template}
                    </div>
                  </div>

                  {selectedTemplate.placeholder_hints && Object.keys(selectedTemplate.placeholder_hints).length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-white/60 block mb-2">Placeholders</label>
                      <div className="space-y-1">
                        {Object.entries(selectedTemplate.placeholder_hints).map(([key, hint]) => (
                          <div key={key} className="p-2 bg-white/[0.05] rounded text-xs">
                            <p className="text-amber-400">{'{{' + key + '}}'}</p>
                            <p className="text-white/50">{hint}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 rounded-lg bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 text-xs font-medium transition-colors flex items-center justify-center gap-1">
                    <Copy size={12} />
                    Duplicate
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 gap-3">
                <Library size={24} className="text-white/20" />
                <p className="text-white/40 text-xs text-center">Select a template to preview</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
