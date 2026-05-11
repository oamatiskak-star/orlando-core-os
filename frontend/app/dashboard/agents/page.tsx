import { Bot } from 'lucide-react'

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Bot size={16} className="text-cyan-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">AI Agents</h1>
          <p className="text-xs text-white/30">Overzicht en beheer van alle actieve AI agents per BV.</p>
        </div>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-8 flex flex-col items-center justify-center gap-3 min-h-[300px]">
        <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Bot size={22} className="text-cyan-400" />
        </div>
        <p className="text-sm font-medium text-white/60">AI Agents</p>
        <p className="text-xs text-white/25 text-center max-w-xs">
          Deze module wordt momenteel gebouwd. Kom binnenkort terug.
        </p>
      </div>
    </div>
  )
}
