'use client'

import { useEffect, useState } from 'react'
import { Sparkles, CheckCircle2, Zap } from 'lucide-react'

type Recommendation = {
  affiliate_id: string
  affiliate_name: string
  confidence_score: number
  reasoning: {
    audience_match: number
    content_relevance: number
    historical_performance: number
    channel_fit: number
  }
  estimated_revenue_impact: number
  estimated_conversion_rate: number
  metadata: {
    primary_reason: string
    secondary_reasons: string[]
  }
}

type Props = {
  channelId: string
  onSelectRecommendation: (affiliateId: string) => void
  onDismiss: () => void
}

export function AiRecommendationPanel({ channelId, onSelectRecommendation, onDismiss }: Props) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        setLoading(true)
        setError('')
        const res = await fetch('/api/media-holding/affiliate-engine/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel_id: channelId }),
        })

        if (!res.ok) {
          throw new Error('Failed to fetch recommendations')
        }

        const data = await res.json()
        setRecommendations(data.recommendations || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    if (channelId) {
      fetchRecommendations()
    }
  }, [channelId])

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/30 rounded-lg p-4 mb-3">
        <div className="flex items-center gap-2 text-xs text-violet-300 mb-2">
          <Sparkles size={13} />
          <span>AI-aanbevelingen laden…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-3 text-xs text-red-300">
        {error}
        <button
          onClick={onDismiss}
          className="ml-2 underline hover:no-underline"
        >
          Verbergen
        </button>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return null
  }

  return (
    <div className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-500/30 rounded-lg p-4 mb-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400" />
          <span className="text-xs font-semibold text-violet-300">Top AI-aanbevelingen</span>
        </div>
        <button
          onClick={onDismiss}
          className="text-[10px] text-white/40 hover:text-white/60"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        {recommendations.slice(0, 3).map((rec, idx) => (
          <div
            key={rec.affiliate_id}
            onClick={() => {
              setSelectedIndex(idx)
              onSelectRecommendation(rec.affiliate_id)
            }}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              selectedIndex === idx
                ? 'bg-violet-500/20 border-violet-400/60'
                : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04] hover:border-violet-400/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-white">{rec.affiliate_name}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                    rec.confidence_score >= 80 ? 'bg-emerald-500/20 text-emerald-300' :
                    rec.confidence_score >= 60 ? 'bg-amber-500/20 text-amber-300' :
                    'bg-white/10 text-white/60'
                  }`}>
                    {rec.confidence_score}% vertrouwen
                  </span>
                </div>

                <p className="text-[11px] text-white/70 mb-2">{rec.metadata.primary_reason}</p>

                {rec.metadata.secondary_reasons.length > 0 && (
                  <ul className="text-[10px] text-white/50 space-y-1 mb-2">
                    {rec.metadata.secondary_reasons.map((reason, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-white/30 mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="grid grid-cols-3 gap-2 text-[10px]">
                  <div className="bg-white/[0.03] rounded px-2 py-1">
                    <p className="text-white/40">Match</p>
                    <p className="text-white/80 font-medium">{rec.reasoning.audience_match}%</p>
                  </div>
                  <div className="bg-white/[0.03] rounded px-2 py-1">
                    <p className="text-white/40">Relevantie</p>
                    <p className="text-white/80 font-medium">{rec.reasoning.content_relevance}%</p>
                  </div>
                  <div className="bg-white/[0.03] rounded px-2 py-1">
                    <p className="text-white/40">Prestatie</p>
                    <p className="text-white/80 font-medium">{rec.reasoning.historical_performance}%</p>
                  </div>
                </div>
              </div>

              {selectedIndex === idx && (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-1" />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-white/40 pt-1 border-t border-white/10">
        <Zap size={11} />
        <span>Selecteer een aanbeveling of vul handmatig in</span>
      </div>
    </div>
  )
}
