import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Briefcase, ChevronLeft, User, Calendar, ExternalLink } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Project = {
  id: string
  code: string | null
  name: string
  module_ref: string | null
  description: string | null
  status: string
  priority: string
  progress_pct: number
  owner_agent: string | null
  start_at: string | null
  due_at: string | null
  updated_at: string
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  planned:     { label: 'Gepland',  color: 'bg-white/10 text-white/60' },
  in_progress: { label: 'Loopt',    color: 'bg-blue-500/15 text-blue-400' },
  blocked:     { label: 'Geblokt',  color: 'bg-orange-500/15 text-orange-400' },
  completed:   { label: 'Klaar',    color: 'bg-emerald-500/15 text-emerald-400' },
  on_hold:     { label: 'On hold',  color: 'bg-amber-500/15 text-amber-400' },
  cancelled:   { label: 'Gestopt',  color: 'bg-red-500/15 text-red-400' },
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high:     'text-orange-400',
  medium:   'text-yellow-400',
  low:      'text-white/40',
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ProjectenPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('aquier_projects')
    .select('*')
    .order('priority', { ascending: false })
    .order('progress_pct', { ascending: false })

  const projects = (data ?? []) as Project[]
  const byPriority = {
    critical: projects.filter(p => p.priority === 'critical'),
    high:     projects.filter(p => p.priority === 'high'),
    medium:   projects.filter(p => p.priority === 'medium'),
    low:      projects.filter(p => p.priority === 'low'),
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/aquier" className="text-white/40 hover:text-white/70">
          <ChevronLeft size={16} />
        </Link>
        <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Briefcase size={16} className="text-cyan-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">Aquier Projecten</h1>
          <p className="text-xs text-white/50">{projects.length} projecten gekoppeld aan het masterplan</p>
        </div>
      </div>

      {(['critical', 'high', 'medium', 'low'] as const).map(pri => {
        const list = byPriority[pri]
        if (list.length === 0) return null
        return (
          <div key={pri} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${PRIORITY_COLOR[pri]}`}>
                {pri === 'critical' ? 'Kritiek' : pri === 'high' ? 'Hoog' : pri === 'medium' ? 'Medium' : 'Laag'}
              </span>
              <span className="text-[10px] text-white/30">{list.length}</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {list.map(p => {
                const badge = STATUS_BADGE[p.status] ?? STATUS_BADGE.planned
                return (
                  <div key={p.id} id={p.code ?? p.id} className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono text-white/35">{p.code}</span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${badge.color}`}>{badge.label}</span>
                      {p.module_ref && (
                        <span className="text-[9px] text-white/30 truncate">{p.module_ref}</span>
                      )}
                    </div>
                    <p className="text-[13px] text-white/85 font-medium leading-tight">{p.name}</p>
                    {p.description && <p className="text-[10.5px] text-white/45 mt-1 leading-snug">{p.description}</p>}

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${p.progress_pct}%` }} />
                        </div>
                        <span className="text-[10px] text-white/50 w-9 text-right font-medium">{p.progress_pct}%</span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-white/40">
                        {p.owner_agent && (
                          <span className="flex items-center gap-1">
                            <User size={9} />
                            {p.owner_agent}
                          </span>
                        )}
                        {p.due_at && (
                          <span className="flex items-center gap-1">
                            <Calendar size={9} />
                            {fmtDate(p.due_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {projects.length === 0 && (
        <div className="py-12 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-xl">
          <Briefcase size={28} className="text-white/15 mx-auto mb-3" />
          <p className="text-[12px] text-white/30">Nog geen projecten geseed</p>
          <p className="text-[10px] text-white/20 mt-1">Run migration 082_aquier_command_center.sql</p>
        </div>
      )}
    </div>
  )
}
