import { Calculator, ExternalLink, FileSpreadsheet, Plus } from 'lucide-react'

const apps = [
  {
    naam: 'SterkCalc',
    beschrijving: 'AI-gedreven STABU-calculaties, offertes en begrotingen voor de bouwsector. Koppelt met projecten en documenten.',
    status: 'Extern',
    url: 'https://sterkcalc.nl',
    color: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-400',
  },
  {
    naam: 'STABU Calculator',
    beschrijving: 'Handmatige STABU-postenberekening op basis van standaard bestekssystematiek. Voor snelle offerteopstelling.',
    status: 'Extern',
    url: null,
    color: 'bg-orange-500/10 border-orange-500/20',
    iconColor: 'text-orange-400',
  },
]

export default function CalculatiesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Calculator size={16} className="text-orange-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Calculaties</h1>
            <p className="text-xs text-white/30">STABU-calculaties en offertes via SterkCalc.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe calculatie
        </button>
      </div>

      {/* App Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {apps.map((app) => (
          <div key={app.naam} className={`bg-white/[0.03] border rounded-xl p-5 flex flex-col gap-4 ${app.color}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center`}>
                <FileSpreadsheet size={18} className={app.iconColor} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{app.naam}</p>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/30">{app.status}</span>
              </div>
            </div>
            <p className="text-[11px] text-white/40 leading-relaxed flex-1">{app.beschrijving}</p>
            <button className="flex items-center justify-center gap-2 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-4 py-2 rounded-lg transition-colors">
              <ExternalLink size={12} />
              Openen
            </button>
          </div>
        ))}
      </div>

      {/* Recent Calculations */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recente calculaties</h2>
          <button className="text-[11px] text-indigo-400 hover:text-indigo-300">Alle calculaties</button>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
            <Calculator size={18} className="text-white/20" />
          </div>
          <p className="text-sm text-white/30">Geen calculaties gevonden</p>
          <p className="text-[11px] text-white/20 text-center max-w-xs">
            Calculaties worden hier zichtbaar zodra SterkCalc is gekoppeld en actief gebruikt.
          </p>
          <p className="text-[11px] text-indigo-400/60 mt-1">Opent SterkCalc bij gebruik van &quot;Nieuwe calculatie&quot;</p>
        </div>
      </div>
    </div>
  )
}
