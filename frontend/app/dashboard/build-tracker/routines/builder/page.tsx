import { COMPANIES } from '@/lib/companies'
import { createRoutine } from '../actions'

export const dynamic = 'force-dynamic'

export default function RoutinesBuilderPage() {
  return (
    <div className="space-y-5">
      <div className="bg-white/[0.04] rounded-xl border border-white/[0.06] p-5">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-white/85">Nieuwe routine aanmaken</h2>
          <p className="text-[10px] text-white/40 mt-0.5">
            Form-based v1 — Drag &amp; drop builder komt later. Na "Opslaan" land je op het detail-scherm waar je steps + triggers toevoegt.
          </p>
        </div>

        <form action={createRoutine} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Naam</label>
              <input
                name="name"
                required
                maxLength={120}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/90 focus:outline-none focus:border-white/30"
                placeholder="Bijv. Dagelijkse Funda Scan"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Kind</label>
              <select
                name="kind"
                required
                defaultValue="workflow"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/90 focus:outline-none focus:border-white/30"
              >
                <option value="agent">Agent — wraps één bestaande agent</option>
                <option value="workflow">Workflow — meerdere stappen</option>
                <option value="cron">Cron — periodieke uitvoering</option>
                <option value="reactive">Reactive — luistert op event</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Omschrijving</label>
              <textarea
                name="description"
                maxLength={500}
                rows={3}
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/90 focus:outline-none focus:border-white/30 resize-none"
                placeholder="Waarom bestaat deze routine en wat doet hij?"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Company</label>
              <select
                name="company_slug"
                defaultValue=""
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/90 focus:outline-none focus:border-white/30"
              >
                <option value="">— Globaal (geen company) —</option>
                {COMPANIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-[10px] text-white/35 mt-1">Globale routines zijn voor alle entities zichtbaar.</p>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wide text-white/40 mb-1.5">Initiële status</label>
              <select
                name="status"
                defaultValue="draft"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white/90 focus:outline-none focus:border-white/30"
              >
                <option value="draft">Draft — nog niet actief</option>
                <option value="active">Active — triggert direct</option>
                <option value="paused">Paused — pauze</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 rounded-lg text-[11px] font-medium transition-colors"
            >
              Opslaan + naar detail
            </button>
            <a
              href="/dashboard/build-tracker/routines"
              className="px-3 py-2 text-[11px] text-white/50 hover:text-white/80 transition-colors"
            >
              Annuleer
            </a>
          </div>
        </form>
      </div>

      <div className="text-[10px] text-white/30 leading-relaxed bg-white/[0.02] border border-white/[0.05] rounded-xl p-3">
        <strong className="text-white/55">Werkwijze:</strong> Na opslaan voeg je steps toe (action / condition / approval / fallback / delay)
        en een trigger (cron expression voor periodiek, webhook voor extern, event voor reactief, manual voor "Run now").
        Een routine met status='active' + cron-trigger met geldige <code className="font-mono text-white/55">next_run_at</code>
        wordt automatisch opgepakt door pg_cron functie <code className="font-mono text-white/55">routines_dispatch_cron_triggers()</code>
        en in de queue gezet voor de local-agent runner.
      </div>
    </div>
  )
}
