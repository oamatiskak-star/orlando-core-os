import { Mail, Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

const FLOWS = [
  { key: 'welcome', label: 'Welcome flow' },
  { key: 'followup', label: 'Follow-up flow' },
  { key: 'membership', label: 'Membership flow' },
  { key: 'sales', label: 'Sales flow' },
  { key: 'abandoned', label: 'Abandoned flow' },
]

const METRICS = ['Open rate', 'CTR', 'Conversions', 'Revenue']

// Er is (nog) geen email-marketing-flow bron gekoppeld in Orlando Core OS → geen mock,
// alles "Geen data beschikbaar". De structuur staat klaar voor zodra een bron koppelt.
export default function EmailStudioPage() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-white/45">Email Studio — flows en hun prestaties. Nog geen email-flow bron gekoppeld → alles &quot;Geen data beschikbaar&quot; (geen schatting).</p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {FLOWS.map((f) => (
          <div key={f.key} className="rounded-lg border border-white/8 bg-[#0e1525] p-4">
            <div className="flex items-center gap-2">
              <Mail size={15} className="text-sky-400" />
              <h3 className="text-sm font-semibold text-white">{f.label}</h3>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {METRICS.map((m) => (
                <div key={m} className="rounded bg-white/[0.03] px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-white/35">{m}</div>
                  <div className="text-[11px] italic text-white/30">Geen data</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-2 text-[10px] text-white/35">
              <Sparkles size={11} className="text-violet-400/60" /> Hermes optimalisaties: <span className="italic">Geen data beschikbaar</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
