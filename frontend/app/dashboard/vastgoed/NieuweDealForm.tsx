'use client'

import { useState, useRef } from 'react'
import { X, Plus } from 'lucide-react'
import { createDeal } from './actions'

const PROVINCIES = ['Noord-Holland', 'Zuid-Holland', 'Utrecht', 'Noord-Brabant', 'Gelderland', 'Overijssel', 'Limburg', 'Zeeland', 'Groningen', 'Friesland', 'Drenthe', 'Flevoland']
const DEAL_TYPES = ['koop', 'auction', 'executie', 'bpo', 'transformatie']
const BRONNEN = ['funda', 'pararius', 'kadaster', 'veiling', 'handmatig', 'netwerk']

export default function NieuweDealForm() {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    await createDeal(formData)
    setPending(false)
    setOpen(false)
    formRef.current?.reset()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <Plus size={13} />
        Nieuwe deal
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-[#181830] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 sticky top-0 bg-[#181830] z-10">
              <h2 className="text-sm font-semibold text-white">Nieuwe Vastgoed Deal</h2>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <form ref={formRef} action={handleSubmit} className="p-6 space-y-5">

              {/* Basis */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Basis</p>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Titel *</label>
                  <input name="title" required placeholder="bijv. Herenhuis Rotterdam Centrum"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Adres</label>
                    <input name="adres" placeholder="Straatnaam + nr"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Stad</label>
                    <input name="stad" placeholder="Amsterdam"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Provincie</label>
                    <select name="provincie"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                      <option value="">Selecteer</option>
                      {PROVINCIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Type deal</label>
                    <select name="deal_type"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                      {DEAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Bron</label>
                    <select name="bron"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/60 transition-colors">
                      {BRONNEN.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Financieel */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Financieel</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Vraagprijs (€)</label>
                    <input name="vraagprijs" type="number" placeholder="450000"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Potentieel winst (€)</label>
                    <input name="potentieel_winst" type="number" placeholder="85000"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">ROI (%)</label>
                    <input name="roi_pct" type="number" step="0.1" placeholder="18.5"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">IRR (%)</label>
                    <input name="irr_pct" type="number" step="0.1" placeholder="12.0"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Residuele grondwaarde (€)</label>
                    <input name="grondwaarde" type="number" placeholder="120000"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Bouwjaar</label>
                    <input name="bouwjaar" type="number" placeholder="1975"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Woonoppervlak (m²)</label>
                    <input name="m2_wonen" type="number" placeholder="120"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Perceeloppervlak (m²)</label>
                    <input name="m2_perceel" type="number" placeholder="350"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                  </div>
                </div>
              </div>

              {/* Extra */}
              <div className="space-y-3 pt-2 border-t border-white/5">
                <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">Extra</p>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Funda / listing URL</label>
                  <input name="funda_url" type="url" placeholder="https://www.funda.nl/..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Notities</label>
                  <textarea name="notities" rows={3} placeholder="Analyse, bijzonderheden, strategie..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-indigo-500/60 transition-colors resize-none" />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button type="submit" disabled={pending}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
                  {pending ? 'Opslaan...' : 'Deal opslaan'}
                </button>
                <button type="button" onClick={() => setOpen(false)}
                  className="px-4 py-2.5 border border-white/10 text-white/50 hover:text-white text-sm rounded-lg transition-colors">
                  Annuleren
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
