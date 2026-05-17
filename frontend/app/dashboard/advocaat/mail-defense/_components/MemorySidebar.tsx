'use client'

import { useState, useEffect } from 'react'
import { Brain, X, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'

interface Memory {
  id: string
  dossier_id: string | null
  type: string
  subject: string
  content: string
  confidence: number
  tags: string[]
  times_used: number
  last_used_at: string | null
  created_at: string
}

interface Props {
  defaultDossierId?: string
}

const TYPE_COLORS: Record<string, string> = {
  strategie:            'text-orange-300 bg-orange-500/10 border-orange-500/20',
  feit:                 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  risico:               'text-red-300 bg-red-500/10 border-red-500/20',
  beslissing:           'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  partij_info:          'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  juridisch_standpunt:  'text-violet-300 bg-violet-500/10 border-violet-500/20',
  deadline:             'text-red-300 bg-red-500/10 border-red-500/15',
  tijdlijn:             'text-white/50 bg-white/[0.04] border-white/[0.08]',
}

const TYPE_OPTIONS = [
  'strategie',
  'feit',
  'risico',
  'beslissing',
  'partij_info',
  'juridisch_standpunt',
  'deadline',
  'tijdlijn',
]

export function MemorySidebar({ defaultDossierId }: Props) {
  const [open, setOpen] = useState(false)
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [dossierId] = useState(defaultDossierId ?? '')

  async function fetchMemories() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '30')
      if (dossierId) params.set('dossier_id', dossierId)
      if (filterType) params.set('type', filterType)
      const res = await fetch(`/api/advocaat/geheugen?${params.toString()}`)
      if (!res.ok) throw new Error('Fetch failed')
      const data = await res.json()
      setMemories(Array.isArray(data) ? data : data.items ?? [])
    } catch {
      setMemories([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && memories.length === 0) {
      fetchMemories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) {
      fetchMemories()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType])

  const typeColor = (type: string) =>
    TYPE_COLORS[type] ?? 'text-white/40 bg-white/[0.04] border-white/[0.08]'

  return (
    <div className="flex items-start gap-2">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium hover:bg-violet-500/20 transition-all whitespace-nowrap"
      >
        <Brain className="w-3.5 h-3.5" />
        Geheugen ({memories.length || '?'})
        {open ? (
          <ChevronLeft className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Sidebar panel */}
      {open && (
        <div
          className="flex flex-col bg-[#0d0d14] border border-white/[0.08] rounded-xl shadow-2xl"
          style={{ width: 340, maxHeight: 600 }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-white/[0.06]">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-white">AI Geheugen</span>
              </div>
              <span className="text-[10px] text-white/30 leading-tight">
                Persistente kennis van AI Advocaat OS
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white/70 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Filters */}
          <div className="px-4 py-2.5 border-b border-white/[0.06]">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-violet-500/40"
            >
              <option value="">Alle types</option>
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Memory list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
              </div>
            ) : memories.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-8">
                Geen geheugen-items gevonden
              </p>
            ) : (
              memories.map((memory) => (
                <div
                  key={memory.id}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 space-y-1.5"
                >
                  {/* Type badge + subject */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${typeColor(memory.type)}`}
                    >
                      {memory.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-white/80 font-medium leading-tight truncate flex-1">
                      {memory.subject}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-[11px] text-white/40 leading-relaxed">
                    {memory.content.length > 150
                      ? memory.content.slice(0, 150) + '...'
                      : memory.content}
                  </p>

                  {/* Confidence bar */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] text-white/20">
                        Zekerheid {Math.round(memory.confidence * 100)}%
                      </span>
                      {memory.times_used > 0 && (
                        <span className="text-[9px] text-white/20">
                          x{memory.times_used} gebruikt
                        </span>
                      )}
                    </div>
                    <div className="h-1 rounded-full bg-white/[0.06] mt-1.5">
                      <div
                        className="h-1 rounded-full bg-violet-500"
                        style={{ width: `${Math.round(memory.confidence * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Tags */}
                  {memory.tags && memory.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {memory.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-[9px] text-white/30"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-white/[0.06]">
            <p className="text-[10px] text-white/20 text-center">
              Geheugen wordt automatisch bijgewerkt na elke analyse
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
