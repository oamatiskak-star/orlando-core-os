'use client'

import { useState } from 'react'
import { Zap, Save } from 'lucide-react'

interface Campaign {
  id: string
  naam: string
  channel_slug: string
  accent_color: string
  target_views_daily: number
  target_uploads_daily: number
}

interface Props {
  campaigns: Campaign[]
  currentDag: number
}

export default function StrategyDailyLog({ campaigns, currentDag }: Props) {
  const [values, setValues] = useState<Record<string, { views: string; uploads: string; breakout: boolean; notes: string }>>(() =>
    Object.fromEntries(campaigns.map(c => [c.channel_slug, { views: '', uploads: '', breakout: false, notes: '' }]))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  const update = (slug: string, field: string, value: string | boolean) => {
    setValues(v => ({ ...v, [slug]: { ...v[slug], [field]: value } }))
  }

  const save = async () => {
    setSaving(true)
    for (const c of campaigns) {
      const v = values[c.channel_slug]
      if (!v.views && !v.uploads) continue
      await fetch('/api/youtube/strategy/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_slug: c.channel_slug,
          dag_nr: currentDag,
          views_actual: parseInt(v.views) || 0,
          uploads_actual: parseInt(v.uploads) || 0,
          breakout_detected: v.breakout,
          notes: v.notes || null,
        }),
      })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="bg-white/[0.04] border border-white/8 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">
          Dag {currentDag} invoeren
        </h2>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/25 transition-colors text-xs disabled:opacity-50"
        >
          <Save size={12} />
          {saved ? 'Opgeslagen!' : saving ? 'Bezig...' : 'Opslaan'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaigns.map(c => (
          <div key={c.channel_slug} className="space-y-3">
            <p className="text-xs font-semibold" style={{ color: c.accent_color }}>{c.naam}</p>

            <div>
              <label className="text-[11px] text-white/40 block mb-1">Views vandaag</label>
              <input
                type="number"
                value={values[c.channel_slug]?.views ?? ''}
                onChange={e => update(c.channel_slug, 'views', e.target.value)}
                placeholder={`target: ${c.target_views_daily.toLocaleString()}`}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/40"
              />
            </div>

            <div>
              <label className="text-[11px] text-white/40 block mb-1">Uploads vandaag</label>
              <input
                type="number"
                value={values[c.channel_slug]?.uploads ?? ''}
                onChange={e => update(c.channel_slug, 'uploads', e.target.value)}
                placeholder={`target: ${c.target_uploads_daily}`}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/40"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={values[c.channel_slug]?.breakout ?? false}
                onChange={e => update(c.channel_slug, 'breakout', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-amber-400"
              />
              <span className="text-xs text-white/50 flex items-center gap-1">
                <Zap size={11} className="text-amber-400" /> Breakout gedetecteerd
              </span>
            </label>

            <div>
              <label className="text-[11px] text-white/40 block mb-1">Notitie</label>
              <input
                type="text"
                value={values[c.channel_slug]?.notes ?? ''}
                onChange={e => update(c.channel_slug, 'notes', e.target.value)}
                placeholder="Bijzonderheden..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/40"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
