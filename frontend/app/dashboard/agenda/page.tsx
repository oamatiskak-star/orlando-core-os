import { Calendar, Plus } from 'lucide-react'

const days = [
  { date: '12 mei', dag: 'Maandag', events: [] },
  { date: '13 mei', dag: 'Dinsdag', events: [] },
  { date: '14 mei', dag: 'Woensdag', events: [] },
  { date: '15 mei', dag: 'Donderdag', events: [] },
  { date: '16 mei', dag: 'Vrijdag', events: [] },
  { date: '17 mei', dag: 'Zaterdag', events: [] },
  { date: '18 mei', dag: 'Zondag', events: [] },
]

export default function AgendaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
            <Calendar size={16} className="text-teal-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Agenda</h1>
            <p className="text-xs text-white/30">Afspraken, deadlines en planning over alle BV&apos;s.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus size={13} />
          Afspraak toevoegen
        </button>
      </div>

      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Komende 7 dagen</h2>
          <span className="text-[11px] text-white/30">12 – 18 mei 2026</span>
        </div>
        <div className="space-y-2">
          {days.map((day) => (
            <div key={day.date} className="flex items-start gap-4 py-3 border-b border-white/5 last:border-0">
              <div className="w-20 flex-shrink-0">
                <p className="text-xs font-medium text-white/60">{day.dag}</p>
                <p className="text-[11px] text-white/25">{day.date}</p>
              </div>
              <div className="flex-1">
                {day.events.length === 0 ? (
                  <p className="text-[11px] text-white/20 italic">Geen aankomende afspraken</p>
                ) : null}
              </div>
              <button className="w-6 h-6 rounded-lg border border-white/10 flex items-center justify-center text-white/30 hover:text-white hover:border-white/20 transition-colors flex-shrink-0">
                <Plus size={11} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
