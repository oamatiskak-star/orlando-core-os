import { createClient } from '@/lib/supabase/server'
import { getActiveCompany } from '@/lib/active-company-server'
import { UserCog, FolderKanban, CheckSquare, PlayCircle, ChevronLeft } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

type Build = { id: string; name: string; status: string; progress_pct: number; current_milestone: string | null }
type Task = { id: string; titel: string; status: string; priority: string | null; due_date: string | null }

const STATUS_BADGE: Record<string, string> = {
  planned: 'bg-white/10 text-white/60', building: 'bg-blue-500/15 text-blue-400',
  deploying: 'bg-cyan-500/15 text-cyan-400', live: 'bg-emerald-500/15 text-emerald-400',
  paused: 'bg-amber-500/15 text-amber-400', failed: 'bg-red-500/15 text-red-400',
}

export default async function ProjectleiderPage() {
  const company = await getActiveCompany()
  const supabase = await createClient()

  const [{ data: buildData }, { data: taskData }] = await Promise.all([
    supabase.from('build_tracker')
      .select('id, name, status, progress_pct, current_milestone, companies!inner(slug)')
      .eq('companies.slug', company.id)
      .order('progress_pct', { ascending: false }),
    supabase.from('planning_items')
      .select('id, titel, status, priority, due_date, companies!inner(slug)')
      .eq('companies.slug', company.id)
      .neq('status', 'gereed')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50),
  ])

  const builds = (buildData ?? []) as unknown as Build[]
  const tasks = (taskData ?? []) as unknown as Task[]

  const lopend   = builds.filter((b) => b.status !== 'live')
  const voltooid = builds.filter((b) => b.status === 'live')
  const teStarten = builds.filter((b) => b.status === 'planned')

  const cards = [
    { label: 'Lopende projecten', value: lopend.length, icon: FolderKanban, color: 'text-blue-400 border-blue-500/20' },
    { label: 'Voltooid',          value: voltooid.length, icon: CheckSquare, color: 'text-emerald-400 border-emerald-500/20' },
    { label: 'Te starten',        value: teStarten.length, icon: PlayCircle, color: 'text-violet-400 border-violet-500/20' },
    { label: 'Open taken',        value: tasks.length, icon: CheckSquare, color: 'text-amber-400 border-amber-500/20' },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-white/40 hover:text-white/70"><ChevronLeft size={16} /></Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${company.color}1a`, border: `1px solid ${company.color}33`, color: company.color }}>
          <UserCog size={16} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Projectleider · {company.name}</h1>
          <p className="text-xs text-white/50">Projecten, taken en aandachtspunten van deze fabriek</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className={`bg-white/[0.05] border rounded-xl p-4 ${c.color.split(' ')[1]}`}>
              <Icon size={14} className={`${c.color.split(' ')[0]} mb-2`} />
              <p className={`text-xl font-bold tabular-nums ${c.color.split(' ')[0]}`}>{c.value}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{c.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Lopende projecten */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2"><FolderKanban size={13} /> Lopende projecten</h2>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl divide-y divide-white/5">
            {lopend.length === 0 && <p className="px-4 py-3 text-xs text-white/35">Geen lopende projecten.</p>}
            {lopend.map((b) => (
              <Link key={b.id} href={`/dashboard/build-tracker/${b.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${STATUS_BADGE[b.status] ?? STATUS_BADGE.planned}`}>{b.status}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{b.name}</p>
                  {b.current_milestone && <p className="text-[10px] text-white/35 truncate">{b.current_milestone}</p>}
                </div>
                <span className="text-[11px] text-white/55 tabular-nums shrink-0">{b.progress_pct}%</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Open taken */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-white/60 flex items-center gap-2"><CheckSquare size={13} /> Open taken</h2>
          <div className="bg-white/[0.04] border border-white/10 rounded-xl divide-y divide-white/5">
            {tasks.length === 0 && <p className="px-4 py-3 text-xs text-white/35">Geen open taken voor deze fabriek.</p>}
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{t.titel}</p>
                  <p className="text-[10px] text-white/35">{t.status}{t.priority ? ` · ${t.priority}` : ''}{t.due_date ? ` · ${new Date(t.due_date).toLocaleDateString('nl-NL')}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
