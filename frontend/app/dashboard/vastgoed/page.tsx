import { Home } from 'lucide-react'

export default function VastgoedPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Home size={16} className="text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Vastgoed Deals</h1>
          <p className="text-xs text-white/30">Vastgoeddeals, analyses en dealflow voor STRKBEHEER.</p>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 flex flex-col items-center justify-center gap-3 min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Home size={22} className="text-amber-400" />
        </div>
        <p className="text-sm font-medium text-white/60">Vastgoed Deals</p>
        <p className="text-xs text-white/25 text-center max-w-xs">
          Deze module wordt momenteel gebouwd. Kom binnenkort terug.
        </p>
      </div>
    </div>
  )
}
