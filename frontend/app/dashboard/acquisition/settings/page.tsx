'use client'

import { useState, useEffect } from 'react'
import { SlidersHorizontal, Save, Check } from 'lucide-react'

type Config = {
  landen: string[]
  provincies: string[]
  roi_min_pct: number
  winst_min_m2: number
  object_types: string[]
  risicoprofiel: string
  scrape_frequentie: string
  ai_aggressiveness: number
  outreach_auto: boolean
  budget_max: number | null
}

const DEFAULT_CONFIG: Config = {
  landen: ['NL'],
  provincies: [],
  roi_min_pct: 8,
  winst_min_m2: 0,
  object_types: ['woning', 'appartement', 'loods', 'kantoor'],
  risicoprofiel: 'midden',
  scrape_frequentie: 'dag',
  ai_aggressiveness: 3,
  outreach_auto: false,
  budget_max: null,
}

const LANDEN = ['NL', 'BE', 'DE']
const PROVINCIES = ['Noord-Holland', 'Zuid-Holland', 'Noord-Brabant', 'Gelderland', 'Utrecht', 'Overijssel', 'Friesland', 'Groningen', 'Drenthe', 'Flevoland', 'Zeeland', 'Limburg']
const OBJECT_TYPES = ['woning', 'appartement', 'kantoor', 'loods', 'winkel', 'horeca', 'industrie', 'grond', 'zorgvastgoed']

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-indigo-600' : 'bg-white/10'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all ${
        checked ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-white/50 hover:border-white/20'
      }`}
    >
      {checked && <Check size={10} />}
      {label}
    </button>
  )
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/acquisition/settings')
      .then(r => r.json())
      .then(json => {
        if (json.data?.config) setConfig({ ...DEFAULT_CONFIG, ...json.data.config })
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/acquisition/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleLand(l: string) {
    setConfig(p => ({ ...p, landen: p.landen.includes(l) ? p.landen.filter(x => x !== l) : [...p.landen, l] }))
  }

  function toggleProvincie(p: string) {
    setConfig(prev => ({ ...prev, provincies: prev.provincies.includes(p) ? prev.provincies.filter(x => x !== p) : [...prev.provincies, p] }))
  }

  function toggleObjectType(t: string) {
    setConfig(p => ({ ...p, object_types: p.object_types.includes(t) ? p.object_types.filter(x => x !== t) : [...p.object_types, t] }))
  }

  if (loading) return <div className="text-xs text-white/30 py-12 text-center">Laden…</div>

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <SlidersHorizontal size={16} className="text-white/50" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Acquisition Settings</h1>
            <p className="text-xs text-white/50">Live configuratie voor alle acquisition modules</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            saved ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' :
            'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50'
          }`}>
          {saved ? <><Check size={12} /> Opgeslagen</> : <><Save size={12} /> {saving ? 'Opslaan…' : 'Opslaan'}</>}
        </button>
      </div>

      {/* Landen */}
      <Section title="Landen">
        <div className="flex gap-2">
          {LANDEN.map(l => <CheckItem key={l} label={l} checked={config.landen.includes(l)} onChange={() => toggleLand(l)} />)}
        </div>
      </Section>

      {/* Provincies */}
      <Section title="Actieve Provincies">
        <div className="flex flex-wrap gap-1.5">
          {PROVINCIES.map(p => <CheckItem key={p} label={p} checked={config.provincies.includes(p)} onChange={() => toggleProvincie(p)} />)}
        </div>
        {config.provincies.length === 0 && <p className="text-[11px] text-white/30 mt-1">Leeg = alle provincies actief</p>}
      </Section>

      {/* ROI & winst */}
      <Section title="Minimum Rendement">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-white/40 mb-1 block">Minimum ROI (%)</label>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={50} step={0.5} value={config.roi_min_pct}
                onChange={e => setConfig(p => ({ ...p, roi_min_pct: parseFloat(e.target.value) }))}
                className="flex-1 accent-indigo-500" />
              <span className="text-sm font-medium text-white w-10 text-right">{config.roi_min_pct}%</span>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1 block">Min winst per m² (€)</label>
            <input type="number" value={config.winst_min_m2} onChange={e => setConfig(p => ({ ...p, winst_min_m2: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50" />
          </div>
        </div>
      </Section>

      {/* Object types */}
      <Section title="Object Types">
        <div className="flex flex-wrap gap-1.5">
          {OBJECT_TYPES.map(t => <CheckItem key={t} label={t} checked={config.object_types.includes(t)} onChange={() => toggleObjectType(t)} />)}
        </div>
      </Section>

      {/* Risicoprofiel & scrape frequentie */}
      <Section title="AI Instellingen">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-white/40 mb-1 block">Risicoprofiel</label>
            <select value={config.risicoprofiel} onChange={e => setConfig(p => ({ ...p, risicoprofiel: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
              <option value="laag">Laag</option>
              <option value="midden">Midden</option>
              <option value="hoog">Hoog</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] text-white/40 mb-1 block">Scan frequentie</label>
            <select value={config.scrape_frequentie} onChange={e => setConfig(p => ({ ...p, scrape_frequentie: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50">
              <option value="uur">Per uur</option>
              <option value="dag">Per dag</option>
              <option value="week">Per week</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-[11px] text-white/40 mb-1 block">AI Aggressiveness</label>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-white/30">Voorzichtig</span>
            <input type="range" min={1} max={5} step={1} value={config.ai_aggressiveness}
              onChange={e => setConfig(p => ({ ...p, ai_aggressiveness: parseInt(e.target.value) }))}
              className="flex-1 accent-indigo-500" />
            <span className="text-[11px] text-white/30">Agressief</span>
            <span className="text-sm font-bold text-white w-4 text-right">{config.ai_aggressiveness}</span>
          </div>
        </div>
      </Section>

      {/* Outreach & Budget */}
      <Section title="Outreach & Budget">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-white/70">Automatische outreach</p>
            <p className="text-[11px] text-white/30">OutreachAI stuurt automatisch berichten naar leads</p>
          </div>
          <Toggle checked={config.outreach_auto} onChange={v => setConfig(p => ({ ...p, outreach_auto: v }))} />
        </div>
        <div>
          <label className="text-[11px] text-white/40 mb-1 block">Max budget per deal (€, leeg = onbeperkt)</label>
          <input type="number" value={config.budget_max ?? ''} placeholder="onbeperkt"
            onChange={e => setConfig(p => ({ ...p, budget_max: e.target.value ? parseFloat(e.target.value) : null }))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-indigo-500/50" />
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
      <p className="text-xs text-white/50 font-medium uppercase tracking-wide mb-3">{title}</p>
      {children}
    </div>
  )
}
