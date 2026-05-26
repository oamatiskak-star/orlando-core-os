'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { updateBuild } from '../actions'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'planned', label: 'Gepland' },
  { value: 'building', label: 'In bouw' },
  { value: 'testing', label: 'Test' },
  { value: 'deploying', label: 'Deployment' },
  { value: 'live', label: 'Live' },
  { value: 'paused', label: 'Gepauzeerd' },
  { value: 'failed', label: 'Mislukt' },
]

type Props = {
  id: string
  status: string
  progress: number
  currentMilestone: string | null
  description: string | null
  companyColor: string
}

export default function BuildEditPanel({ id, status, progress, currentMilestone, description, companyColor }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    status,
    progress_pct: progress,
    current_milestone: currentMilestone ?? '',
    description: description ?? '',
  })

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const res = await updateBuild({
        id,
        status: form.status,
        progress_pct: form.progress_pct,
        current_milestone: form.current_milestone,
        description: form.description,
      })
      if (!res.ok) {
        setError(res.error ?? 'Opslaan mislukt')
        return
      }
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2500)
    })
  }

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-5 space-y-4">
      <p className="text-[10px] text-white/35 uppercase tracking-wide">Build bijwerken</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] text-white/50 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-white/30 transition-colors"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-white/50 mb-1">Voortgang — {form.progress_pct}%</label>
          <input
            type="range" min={0} max={100} step={5}
            value={form.progress_pct}
            onChange={(e) => setForm({ ...form, progress_pct: Number(e.target.value) })}
            className="w-full mt-2.5 accent-current"
            style={{ color: companyColor }}
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-white/50 mb-1">Huidige milestone</label>
        <input
          value={form.current_milestone}
          onChange={(e) => setForm({ ...form, current_milestone: e.target.value })}
          placeholder="bijv. M3 — API integratie"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] text-white/50 mb-1">Taak­omschrijving</label>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Wat moet er nog gebeuren om deze build af te ronden…"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors resize-none leading-relaxed"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-red-400">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-50 border border-white/10 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {pending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Opslaan
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400">
            <Check size={12} /> Opgeslagen
          </span>
        )}
      </div>
    </div>
  )
}
