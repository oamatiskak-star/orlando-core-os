import { Workflow, Plus, Play, Pause } from 'lucide-react'

const workflows = [
  {
    naam: 'GitHub Sync Pull',
    trigger: 'Elke 5 min',
    lastRun: '5 min geleden',
    status: 'Actief',
  },
  {
    naam: 'Mail Verwerking',
    trigger: 'Bij ontvangst',
    lastRun: '5 min geleden',
    status: 'Actief',
  },
  {
    naam: 'YouTube Upload Check',
    trigger: 'Dagelijks 09:00',
    lastRun: 'Gisteren',
    status: 'Actief',
  },
  {
    naam: 'Belasting Reminder',
    trigger: 'Maandelijks',
    lastRun: '—',
    status: 'Inactief',
  },
]

export default function WorkflowsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Workflow size={16} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Workflow Engine</h1>
            <p className="text-xs text-white/30">Automatische workflows en triggers beheren per bedrijf.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Nieuwe workflow
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Naam</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Trigger</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Laatste run</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-medium text-white/30 uppercase tracking-wider">Acties</th>
              </tr>
            </thead>
            <tbody>
              {workflows.map((row, i) => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs text-white/80 font-medium">{row.naam}</td>
                  <td className="px-4 py-3 text-xs text-white/40">{row.trigger}</td>
                  <td className="px-4 py-3 text-xs text-white/40">{row.lastRun}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      row.status === 'Actief'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-white/5 text-white/30'
                    }`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-green-400 hover:border-green-500/30 transition-colors">
                        <Play size={10} />
                      </button>
                      <button className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-amber-400 hover:border-amber-500/30 transition-colors">
                        <Pause size={10} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
