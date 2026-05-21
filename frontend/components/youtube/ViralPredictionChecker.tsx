'use client'

import React, { useState } from 'react'

interface PredictionResult {
  prediction: {
    viralScore: number
    confidence: number
    recommendation: string
    risks: string[]
    opportunities: string[]
    estimatedViews: number
    estimatedCTR: number
    trendingFactors: string[]
    contentScore: number
    sentiment: 'positive' | 'neutral' | 'negative'
  }
  recommendations: {
    shouldPublish: string
    optimizations: Record<string, any>
    nextSteps: string[]
  }
}

export function ViralPredictionChecker({ channelId }: { channelId: string }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
    category: 'entertainment',
    thumbnail: ''
  })

  const [prediction, setPrediction] = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/youtube/marketing/viral-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          title: formData.title,
          description: formData.description,
          tags: formData.tags.split(',').map(t => t.trim()),
          category: formData.category,
          thumbnail: formData.thumbnail || undefined
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Prediction failed')
      }

      setPrediction(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 60) return 'text-yellow-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-900/30 border-green-500/50'
    if (score >= 60) return 'bg-yellow-900/30 border-yellow-500/50'
    if (score >= 40) return 'bg-orange-900/30 border-orange-500/50'
    return 'bg-red-900/30 border-red-500/50'
  }

  return (
    <div className="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">🚀 Viral Prediction Checker</h1>
        <p className="text-gray-400">AI predicts video virality BEFORE you publish</p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Input Form */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Video Title*</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter video title (60 chars max)"
                className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                maxLength={70}
                required
              />
              <div className="text-xs text-gray-400 mt-1">
                {formData.title.length} / 70 characters
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Video description with links, hashtags, CTAs..."
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Tags</label>
              <input
                type="text"
                value={formData.tags}
                onChange={e => setFormData({ ...formData, tags: e.target.value })}
                placeholder="tag1, tag2, tag3, tag4, tag5..."
                className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <div className="text-xs text-gray-400 mt-1">
                Comma-separated (recommend 5-10)
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Category</label>
              <select
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="entertainment">Entertainment</option>
                <option value="education">Education</option>
                <option value="music">Music</option>
                <option value="gaming">Gaming</option>
                <option value="vlogs">Vlogs</option>
                <option value="how-to">How-to/Tutorial</option>
                <option value="news">News</option>
                <option value="sports">Sports</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Thumbnail URL */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2">Thumbnail URL</label>
              <input
                type="url"
                value={formData.thumbnail}
                onChange={e => setFormData({ ...formData, thumbnail: e.target.value })}
                placeholder="https://example.com/thumbnail.jpg"
                className="w-full bg-slate-700 border border-slate-600 rounded px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !formData.title}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 rounded transition"
            >
              {loading ? 'Analyzing...' : '🎯 Predict Virality'}
            </button>
          </form>

          {error && (
            <div className="bg-red-900/30 border border-red-500/50 p-4 rounded text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Prediction Results */}
        {prediction && (
          <div className="space-y-6">
            {/* Viral Score */}
            <div className={`border rounded-lg p-6 ${getScoreBg(prediction.prediction.viralScore)}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Viral Score</h2>
                  <p className="text-sm text-gray-400">ML-predicted virality potential</p>
                </div>
                <div className={`text-5xl font-bold ${getScoreColor(prediction.prediction.viralScore)}`}>
                  {prediction.prediction.viralScore}
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">Confidence</span>
                    <span className="text-white font-bold">
                      {(prediction.prediction.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{ width: `${prediction.prediction.confidence * 100}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs mt-4">
                  <div className="bg-slate-700/50 p-2 rounded">
                    <div className="text-gray-400">Est. Views</div>
                    <div className="font-bold text-white">
                      {(prediction.prediction.estimatedViews / 1000).toFixed(0)}K
                    </div>
                  </div>
                  <div className="bg-slate-700/50 p-2 rounded">
                    <div className="text-gray-400">Est. CTR</div>
                    <div className="font-bold text-white">
                      {(prediction.prediction.estimatedCTR * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className="bg-slate-700/50 border border-slate-600 rounded p-4">
              <h3 className="font-bold text-white mb-2">📋 Recommendation</h3>
              <div className="text-white text-sm">{prediction.prediction.recommendation}</div>
              <div className="text-xs text-gray-400 mt-2">
                {prediction.recommendations.shouldPublish}
              </div>
            </div>

            {/* Trending Factors */}
            {prediction.prediction.trendingFactors.length > 0 && (
              <div className="bg-slate-700/50 border border-slate-600 rounded p-4">
                <h3 className="font-bold text-white mb-2">🔥 Trending Factors</h3>
                <div className="space-y-1">
                  {prediction.prediction.trendingFactors.map((factor, i) => (
                    <div key={i} className="text-sm text-blue-300">
                      ✓ {factor}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {prediction.prediction.risks.length > 0 && (
              <div className="bg-red-900/20 border border-red-500/50 rounded p-4">
                <h3 className="font-bold text-red-300 mb-2">⚠️ Risks</h3>
                <ul className="space-y-1">
                  {prediction.prediction.risks.map((risk, i) => (
                    <li key={i} className="text-sm text-red-300">
                      • {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Opportunities */}
            {prediction.prediction.opportunities.length > 0 && (
              <div className="bg-green-900/20 border border-green-500/50 rounded p-4">
                <h3 className="font-bold text-green-300 mb-2">💡 Opportunities</h3>
                <ul className="space-y-1">
                  {prediction.prediction.opportunities.map((opp, i) => (
                    <li key={i} className="text-sm text-green-300">
                      ✓ {opp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-slate-700/50 border border-slate-600 rounded p-4">
              <h3 className="font-bold text-white mb-3">📝 Next Steps</h3>
              <ol className="space-y-2">
                {prediction.recommendations.nextSteps.map((step, i) => (
                  <li key={i} className="text-sm text-gray-300">
                    <span className="font-bold text-blue-400">{i + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Scale Info */}
      <div className="mt-8 pt-8 border-t border-slate-700">
        <h3 className="font-bold text-white mb-3">📊 Score Scale</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-green-900/20 border border-green-500/50 rounded p-3">
            <div className="font-bold text-green-400 text-lg">80-100</div>
            <div className="text-xs text-gray-400">Publish Now</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-500/50 rounded p-3">
            <div className="font-bold text-yellow-400 text-lg">60-79</div>
            <div className="text-xs text-gray-400">Good to Go</div>
          </div>
          <div className="bg-orange-900/20 border border-orange-500/50 rounded p-3">
            <div className="font-bold text-orange-400 text-lg">40-59</div>
            <div className="text-xs text-gray-400">Needs Work</div>
          </div>
          <div className="bg-red-900/20 border border-red-500/50 rounded p-3">
            <div className="font-bold text-red-400 text-lg">0-39</div>
            <div className="text-xs text-gray-400">Major Rework</div>
          </div>
        </div>
      </div>
    </div>
  )
}
