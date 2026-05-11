import { Home, Plus, Building2 } from 'lucide-react'

const pipeline = [
  { label: 'Analyse', count: 0, color: 'border-sky-500/30 text-sky-400' },
  { label: 'Due Diligence', count: 0, color: 'border-amber-500/30 text-amber-400' },
  { label: 'Bod uitgebracht', count: 0, color: 'border-green-500/30 text-green-400' },
]

export default function VastgoedPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Home size={16} className="text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Vastgoed Deals</h1>
            <p className="text-xs text-white/30">Vastgoeddeals, analyses en dealflow voor STRKBEHEER.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe deal
        </button>
      </div>

      {/* Pipeline columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {pipeline.map((col) => (
          <div key={col.label} className={`bg-white/[0.03] border-t-2 border-x border-b border-white/5 rounded-xl p-4 ${col.color.split(' ')[0]}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className={`text-xs font-semibold ${col.color.split(' ')[1]}`}>{col.label}</h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-white/30">{col.count}</span>
              </div>
              <button className="w-6 h-6 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/20 transition-colors">
                <Plus size={11} />
              </button>
            </div>
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                <Building2 size={14} className="text-white/20" />
              </div>
              <p className="text-[11px] text-white/25">Geen deals in deze fase</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recente Deals */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recente Deals</h2>
          <button className="flex items-center gap-1.5 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={11} />
            Deal toevoegen
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Home size={18} className="text-white/20" />
          </div>
          <p className="text-sm text-white/30">Geen deals gevonden</p>
          <p className="text-[11px] text-white/20">Voeg je eerste deal toe om de pipeline te starten.</p>
        </div>
      </div>
    </div>
  )
}
