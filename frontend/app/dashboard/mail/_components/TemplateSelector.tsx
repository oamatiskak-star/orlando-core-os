'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Zap } from 'lucide-react'
import clsx from 'clsx'

interface Template {
  id: string
  name: string
  category: string
  subject_template: string
  body_template: string
  placeholder_hints: Record<string, string> | null
  sentiment: string
}

interface TemplateSelectorProps {
  category?: string
  company?: string
  onTemplateSelect: (template: Template) => void
  selectedTemplateId?: string
}

export function TemplateSelector({
  category,
  company,
  onTemplateSelect,
  selectedTemplateId,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        let query = supabase
          .from('mail_templates')
          .select('*')
          .eq('enabled', true)

        // Filter by category if provided
        if (category) {
          query = query.eq('category', category)
        }

        // Include templates for this company or general templates
        if (company) {
          // This is a simplified approach - in production you might use OR conditions
          const { data } = await query
          setTemplates(data || [])
        } else {
          const { data } = await query
          setTemplates(data || [])
        }
      } catch (e) {
        console.error('Error fetching templates:', e)
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [category, company, supabase])

  if (loading) {
    return <div className="text-xs text-white/40">Loading templates...</div>
  }

  if (templates.length === 0) {
    return <div className="text-xs text-white/40">No templates available for this category</div>
  }

  return (
    <div className="space-y-3">
      <label className="text-xs font-medium text-white/80 block">Suggested Templates</label>
      <div className="grid grid-cols-1 gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => onTemplateSelect(template)}
            className={clsx(
              'w-full text-left p-3 rounded-lg border transition-all',
              selectedTemplateId === template.id
                ? 'bg-indigo-500/20 border-indigo-500/50 ring-1 ring-indigo-500/50'
                : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.05] hover:border-white/20'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white flex items-center gap-2">
                  {selectedTemplateId === template.id && (
                    <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                  )}
                  {template.name}
                </p>
                <p className="text-[11px] text-white/50 mt-1">{template.category}</p>
                {template.placeholder_hints &&
                  Object.keys(template.placeholder_hints).length > 0 && (
                    <p className="text-[10px] text-white/40 mt-2">
                      Placeholders: {Object.keys(template.placeholder_hints).join(', ')}
                    </p>
                  )}
              </div>
              <div className="flex-shrink-0 text-[10px] font-medium px-2 py-1 rounded bg-white/10 text-white/60">
                {template.sentiment}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Template Preview Component
 */
export function TemplatePreview({
  template,
  placeholders,
  onPlaceholderChange,
}: {
  template: Template
  placeholders: Record<string, string>
  onPlaceholderChange: (key: string, value: string) => void
}) {
  if (!template.placeholder_hints) {
    return null
  }

  const placeholderKeys = Object.keys(template.placeholder_hints)
  if (placeholderKeys.length === 0) {
    return null
  }

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-3">
      <label className="text-xs font-medium text-white/80 block flex items-center gap-2">
        <Zap size={14} />
        Customize Template Fields
      </label>

      <div className="space-y-2">
        {placeholderKeys.map((key) => (
          <div key={key}>
            <label className="text-[11px] text-white/60 block mb-1">{template.placeholder_hints![key]}</label>
            <input
              type="text"
              value={placeholders[key] || ''}
              onChange={(e) => onPlaceholderChange(key, e.target.value)}
              placeholder={key}
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-white/30 focus:border-indigo-500/50 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
