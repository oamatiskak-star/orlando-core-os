'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

import type { FinTemplate } from '@/lib/finance/types'
import { Copy, Edit2 } from 'lucide-react'

const TYPE_TABS = ['email', 'whatsapp', 'sms'] as const
type TypeTab = (typeof TYPE_TABS)[number]

function StageBadge({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    herinnering_1: 'bg-blue-500/10 text-blue-400',
    aanmaning_1: 'bg-amber-500/10 text-amber-400',
    aanmaning_2: 'bg-orange-500/10 text-orange-400',
    sommatie: 'bg-red-500/10 text-red-400',
    incasso: 'bg-red-600/10 text-red-500',
  }
  return (
    <span className={`${map[stage] ?? 'bg-white/5 text-white/65'} px-2 py-0.5 rounded-full text-[10px] font-medium`}>
      {stage.replace(/_/g, ' ')}
    </span>
  )
}

function ToneBadge({ tone }: { tone: string }) {
  const map: Record<string, string> = {
    vriendelijk: 'bg-green-500/10 text-green-400',
    zakelijk: 'bg-blue-500/10 text-blue-400',
    formeel: 'bg-purple-500/10 text-purple-400',
    streng: 'bg-red-500/10 text-red-400',
  }
  return (
    <span className={`${map[tone] ?? 'bg-white/5 text-white/65'} px-2 py-0.5 rounded-full text-[10px] font-medium capitalize`}>
      {tone}
    </span>
  )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<FinTemplate[]>([])
  const [activeTab, setActiveTab] = useState<TypeTab>('email')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('fin_templates')
          .select('*')
          .order('stage', { ascending: true })

        if (!error && data) {
          setTemplates(data as FinTemplate[])
        }
      } catch {
        // no live data
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = templates.filter((t) => t.type === activeTab)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Templates</h1>
          <p className="text-xs text-white/50 mt-0.5">E-mail, WhatsApp en SMS templates voor automatische communicatie</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          + Nieuw Template
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.06] border border-white/5 rounded-lg p-1 w-fit">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-indigo-600/30 text-indigo-400'
                : 'text-white/65 hover:text-white/70'
            }`}
          >
            {tab === 'email' ? 'E-mail' : tab === 'whatsapp' ? 'WhatsApp' : 'SMS'}
          </button>
        ))}
      </div>

      {/* Template cards */}
      {loading ? (
        <div className="py-8 text-center text-xs text-white/50">Laden...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-sm text-white/65">Geen {activeTab} templates</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((tmpl) => (
            <div key={tmpl.id} className="bg-white/[0.06] border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-white">{tmpl.name}</h3>
                    <StageBadge stage={tmpl.stage} />
                    <ToneBadge tone={tmpl.tone} />
                    {tmpl.active ? (
                      <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full text-[10px] font-medium">Actief</span>
                    ) : (
                      <span className="bg-white/5 text-white/50 px-2 py-0.5 rounded-full text-[10px] font-medium">Inactief</span>
                    )}
                  </div>
                  {tmpl.subject && (
                    <p className="text-xs text-white/50 mb-2">
                      <span className="text-white/45">Onderwerp: </span>{tmpl.subject}
                    </p>
                  )}
                  <p className="text-xs text-white/65 leading-relaxed line-clamp-2">
                    {tmpl.body.slice(0, 120)}{tmpl.body.length > 120 ? '...' : ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="border border-white/10 text-white/50 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                    <Copy size={11} />
                    Duplicate
                  </button>
                  <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                    <Edit2 size={11} />
                    Bewerk
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
