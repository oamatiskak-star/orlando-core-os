import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Cpu } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Row = {
  id: string
  machine_id: string
  entity: string
  worktree_path: string | null
  git_branch: string | null
  last_prompt: string | null
  last_response_summary: string | null
  status: string
  updated_at: string
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  active:       { label: 'Actief',      color: 'text-emerald-400 bg-emerald-500/10' },
  paused:       { label: 'Gepauzeerd',  color: 'text-amber-400 bg-amber-500/10' },
  context_full: { label: 'Context vol', color: 'text-orange-400 bg-orange-500/10' },
  crashed:      { label: 'Crashed',     color: 'text-red-400 bg-red-500/10' },
  done:         { label: 'Klaar',       color: 'text-white/40 bg-white/5' },
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}u`
  return `${Math.floor(s / 86400)}d`
}

export default async function OsmSessionsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('osm_sessions')
    .select('id, machine_id, entity, worktree_path, git_branch, last_prompt, last_response_summary, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(50)

  const rows: Row[] = (data ?? []) as Row[]
  const active = rows.filter((r) => r.status !== 'done')
  const done = rows.filter((r) => r.status === 'done').slice(0, 10)

  return (
    <div className="space-y-5">
      <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
        <h2 className="text-[12px] font-semibold text-white/85 mb-3 flex items-center gap-2">
          <Cpu size={12} className="text-emerald-400" /> Actieve OSM sessies ({active.length})
        </h2>
        {active.length === 0 ? (
          <p className="text-[11px] text-white/40 py-6 text-center">
            Geen actieve sessies. Open Claude Code en typ een prompt — hooks schrijven dan
            automatisch een rij.
          </p>
        ) : (
          <div className="space-y-1.5">
            {active.map((r) => {
              const style = STATUS_STYLE[r.status] ?? STATUS_STYLE.active
              const text = r.last_response_summary || r.last_prompt || ''
              return (
                <Link
                  key={r.id}
                  href={`/dashboard/osm/sessions/${r.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.1] transition-colors group"
                >
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${style.color}`}>
                    {style.label}
                  </span>
                  <span className="text-[10px] font-mono text-white/45 w-12 shrink-0">{r.machine_id}</span>
                  <span className="text-[12px] text-white/90 font-medium w-28 truncate shrink-0">{r.entity}</span>
                  {r.git_branch && (
                    <span className="text-[10px] font-mono text-white/40 w-40 truncate shrink-0">
                      {r.git_branch}
                    </span>
                  )}
                  <span className="text-[10.5px] text-white/55 flex-1 truncate">{text}</span>
                  <span className="text-[10px] text-white/40 shrink-0">{timeAgo(r.updated_at)}</span>
                  <ArrowRight size={11} className="text-white/30 group-hover:text-white/70 shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-4">
          <h2 className="text-[11px] font-semibold text-white/55 mb-2">
            Recent afgesloten ({done.length})
          </h2>
          <div className="space-y-1">
            {done.map((r) => (
              <Link
                key={r.id}
                href={`/dashboard/osm/sessions/${r.id}`}
                className="flex items-center gap-3 p-1.5 text-[10.5px] text-white/45 hover:text-white/70 transition-colors"
              >
                <span className="w-12 font-mono">{r.machine_id}</span>
                <span className="w-28 truncate text-white/65">{r.entity}</span>
                <span className="flex-1 truncate">{r.last_response_summary || r.last_prompt || ''}</span>
                <span className="text-white/30">{timeAgo(r.updated_at)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
