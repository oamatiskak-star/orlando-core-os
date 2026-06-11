// Dependencies-overzicht (compact, geen volledige graaf) — toont blocker-ketens.
import Link from 'next/link'

type Blocker = { title: string; reason: string; entity_slug: string; code: string | null; waiting_on: string | null }

export default function DependencyOverview({ blockers }: { blockers: Blocker[] }) {
  return (
    <div className="rounded-lg border border-white/5 bg-[#0e1525] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-white/80">Dependencies &amp; Blockers</span>
        <Link href="/dashboard/build-tracker/war-room/dependencies" className="text-[10px] text-violet-400 hover:text-violet-300">volledig →</Link>
      </div>
      <div className="space-y-1.5">
        {blockers.slice(0, 6).map((b, i) => (
          <div key={i} className="text-[11px]">
            <div className="flex items-center gap-1.5">
              {b.code && <span className="rounded bg-red-500/15 px-1 py-0.5 text-[8px] font-bold text-red-400">{b.code}</span>}
              <span className="flex-1 truncate text-white/70">{b.title}</span>
            </div>
            {b.waiting_on && <div className="pl-1 text-[10px] text-white/40">↳ wacht op: {b.waiting_on}</div>}
          </div>
        ))}
        {blockers.length === 0 && (
          <div className="text-[11px] text-white/40">Geen blockers. Vul <code className="text-white/55">build_project_dependencies</code> voor project-naar-project kritisch pad.</div>
        )}
      </div>
    </div>
  )
}
