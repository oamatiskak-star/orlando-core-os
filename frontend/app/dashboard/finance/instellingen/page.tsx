'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const COMPANIES = ['STRKBEHEER', 'STRKBOUW', 'MODIWÉ'] as const
type Company = (typeof COMPANIES)[number]

const DEFAULTS: Record<Company, {
  company_name: string
  kvk: string
  btw: string
  iban: string
  payment_terms: number
  incasso_days: number
  interest_rate: number
  late_fee: number
  tone_of_voice: string
  auto_reminder: boolean
  auto_incasso: boolean
}> = {
  STRKBEHEER: {
    company_name: 'STRKBEHEER BV',
    kvk: '12345678',
    btw: 'NL123456789B01',
    iban: 'NL91ABNA0417164300',
    payment_terms: 30,
    incasso_days: 30,
    interest_rate: 1.5,
    late_fee: 40,
    tone_of_voice: 'zakelijk',
    auto_reminder: true,
    auto_incasso: false,
  },
  STRKBOUW: {
    company_name: 'STRKBOUW BV',
    kvk: '23456789',
    btw: 'NL234567890B01',
    iban: 'NL91ABNA0417164301',
    payment_terms: 14,
    incasso_days: 21,
    interest_rate: 2,
    late_fee: 75,
    tone_of_voice: 'formeel',
    auto_reminder: true,
    auto_incasso: true,
  },
  'MODIWÉ': {
    company_name: 'MODIWÉ BV',
    kvk: '34567890',
    btw: 'NL345678901B01',
    iban: 'NL91ABNA0417164302',
    payment_terms: 30,
    incasso_days: 45,
    interest_rate: 1,
    late_fee: 25,
    tone_of_voice: 'vriendelijk',
    auto_reminder: false,
    auto_incasso: false,
  },
}

export default function InstellingenPage() {
  const [activeCompany, setActiveCompany] = useState<Company>('STRKBEHEER')
  const [form, setForm] = useState(DEFAULTS[activeCompany])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function switchCompany(company: Company) {
    setActiveCompany(company)
    setForm(DEFAULTS[company])
    setSaved(false)
  }

  function updateField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('fin_company_settings').upsert({
        company_id: activeCompany.toLowerCase().replace('é', 'e'),
        ...form,
      })
    } catch {
      // ignore — demo mode
    } finally {
      setSaving(false)
      setSaved(true)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-white">Finance Instellingen</h1>
        <p className="text-xs text-white/50 mt-0.5">Betaalbeleid en automatisering per bedrijf</p>
      </div>

      {/* Company tabs */}
      <div className="flex gap-1 bg-white/[0.06] border border-white/5 rounded-lg p-1 w-fit">
        {COMPANIES.map((company) => (
          <button
            key={company}
            onClick={() => switchCompany(company)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeCompany === company
                ? 'bg-indigo-600/30 text-indigo-400'
                : 'text-white/65 hover:text-white/70'
            }`}
          >
            {company}
          </button>
        ))}
      </div>

      {/* Form sections */}
      <div className="space-y-4">
        {/* Bedrijfsgegevens */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-white mb-4">Bedrijfsgegevens</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Bedrijfsnaam', key: 'company_name' as const, type: 'text' },
              { label: 'KvK-nummer', key: 'kvk' as const, type: 'text' },
              { label: 'BTW-nummer', key: 'btw' as const, type: 'text' },
              { label: 'IBAN', key: 'iban' as const, type: 'text' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1.5">
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={form[field.key] as string}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Betaalbeleid */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-white mb-4">Betaalbeleid</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Betaaltermijn (dagen)', key: 'payment_terms' as const },
              { label: 'Incasso na (dagen)', key: 'incasso_days' as const },
              { label: 'Rente % per maand', key: 'interest_rate' as const },
              { label: 'Aanmaningskosten (€)', key: 'late_fee' as const },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-[10px] font-medium text-white/50 uppercase tracking-wider mb-1.5">
                  {field.label}
                </label>
                <input
                  type="number"
                  value={form[field.key] as number}
                  onChange={(e) => updateField(field.key, parseFloat(e.target.value) || 0)}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Automatisering */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-white mb-4">Automatisering</h3>
          <div className="space-y-3">
            {[
              { label: 'Automatische herinneringen', desc: 'Stuur automatisch herinneringen via de workflow engine', key: 'auto_reminder' as const },
              { label: 'Automatische incasso escalatie', desc: 'Dossiers automatisch doorsturen naar incassobureau', key: 'auto_incasso' as const },
            ].map((toggle) => (
              <div key={toggle.key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium text-white">{toggle.label}</p>
                  <p className="text-[10px] text-white/50 mt-0.5">{toggle.desc}</p>
                </div>
                <button
                  onClick={() => updateField(toggle.key, !form[toggle.key])}
                  className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${form[toggle.key] ? 'bg-indigo-600' : 'bg-white/10'}`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form[toggle.key] ? 'left-5' : 'left-0.5'}`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Tone of voice */}
        <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5">
          <h3 className="text-xs font-semibold text-white mb-4">Tone of Voice</h3>
          <div className="grid grid-cols-4 gap-2">
            {['vriendelijk', 'zakelijk', 'formeel', 'streng'].map((tone) => (
              <button
                key={tone}
                onClick={() => updateField('tone_of_voice', tone)}
                className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors border ${
                  form.tone_of_voice === tone
                    ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
                    : 'bg-white/[0.02] border-white/5 text-white/65 hover:text-white/70'
                }`}
              >
                {tone}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
        {saved && <span className="text-xs text-green-400">Instellingen opgeslagen</span>}
      </div>
    </div>
  )
}
