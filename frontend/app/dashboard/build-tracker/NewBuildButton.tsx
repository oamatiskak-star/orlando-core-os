'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { createBuild } from './actions'

type Props = {
  companyColor: string
  companyName: string
}

const STATUS_OPTIONS = [
  { value: 'planned',   label: 'Gepland' },
  { value: 'building',  label: 'In bouw' },
  { value: 'testing',   label: 'Test' },
  { value: 'deploying', label: 'Deployment' },
  { value: 'live',      label: 'Live' },
  { value: 'paused',    label: 'Gepauzeerd' },
  { value: 'failed',    label: 'Mislukt' },
]

export default function NewBuildButton({ companyColor, companyName }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'planned',
    progress_pct: 0,
    owner: '',
    current_milestone: '',
    started_at: '',
    target_at: '',
  })

  function reset() {
    setForm({
      name: '', description: '', status: 'planned', progress_pct: 0,
      owner: '', current_milestone: '', started_at: '', target_at: '',
    })
    setError(null)
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createBuild({
        name: form.name,
        description: form.description || null,
        status: form.status,
        progress_pct: Number(form.progress_pct) || 0,
        owner: form.owner || null,
        current_milestone: form.current_milestone || null,
        started_at: form.started_at || null,
        target_at: form.target_at || null,
      })
      if (res.ok) {
        reset()
        setOpen(false)
      } else {
        setError(res.error ?? 'Onbekende fout')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
        style={{
          backgroundColor: `${companyColor}1a`,
          border: `1px solid ${companyColor}55`,
          color: companyColor,
        }}
      >
        <Plus size={12} />
        Nieuwe build
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161628] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h2 className="text-sm font-semibold text-white">Nieuwe build voor {companyName}</h2>
                <p className="text-[11px] text-white/45 mt-0.5">Voeg een project of build toe aan deze entity</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/70">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <Field label="Naam *" hint="Korte titel van de build">
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input"
                  placeholder="bv. Aquier MVP v1.1"
                  autoFocus
                />
              </Field>

              <Field label="Beschrijving" hint="Wat doet deze build, scope en context">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="input min-h-[68px] resize-y"
                  placeholder="Korte beschrijving van scope en doelen"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="input"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Voortgang %">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.progress_pct}
                    onChange={(e) => setForm((f) => ({ ...f, progress_pct: Number(e.target.value) }))}
                    className="input"
                  />
                </Field>
              </div>

              <Field label="Owner / agent" hint="Wie of welke agent verantwoordelijk is">
                <input
                  value={form.owner}
                  onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
                  className="input"
                  placeholder="bv. Orlando, CHRONOS-AQ"
                />
              </Field>

              <Field label="Huidige milestone">
                <input
                  value={form.current_milestone}
                  onChange={(e) => setForm((f) => ({ ...f, current_milestone: e.target.value }))}
                  className="input"
                  placeholder="bv. Sprint W23 in uitvoering"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Start">
                  <input
                    type="date"
                    value={form.started_at}
                    onChange={(e) => setForm((f) => ({ ...f, started_at: e.target.value }))}
                    className="input"
                  />
                </Field>
                <Field label="Deadline">
                  <input
                    type="date"
                    value={form.target_at}
                    onChange={(e) => setForm((f) => ({ ...f, target_at: e.target.value }))}
                    className="input"
                  />
                </Field>
              </div>

              {error && (
                <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
              <button
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-3 py-1.5 rounded-lg text-[11px] text-white/60 hover:text-white/80 hover:bg-white/5"
              >
                Annuleren
              </button>
              <button
                onClick={submit}
                disabled={pending || !form.name.trim()}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors disabled:opacity-40"
                style={{
                  backgroundColor: `${companyColor}26`,
                  border: `1px solid ${companyColor}66`,
                  color: companyColor,
                }}
              >
                {pending ? 'Bezig…' : 'Build toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: white;
          font-size: 12px;
          padding: 7px 10px;
          border-radius: 7px;
          outline: none;
        }
        :global(.input:focus) {
          border-color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.06);
        }
      `}</style>
    </>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-medium text-white/70">{label}</span>
      {children}
      {hint && <span className="block text-[10px] text-white/35">{hint}</span>}
    </label>
  )
}
