import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FolderGit2 } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Row = {
  id: string
  machine_id: string
  entity: string
  worktree_path: string
  git_branch: string | null
  last_commit_sha: string | null
  status: string
  updated_at: string
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}u`
  return `${Math.floor(s / 86400)}d`
}

export default async function OsmWorktreesPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('osm_sessions')
    .select('id, machine_id, entity, worktree_path, git_branch, last_commit_sha, status, updated_at')
    .not('worktree_path', 'is', null)
    .neq('status', 'done')
    .order('updated_at', { ascending: false })
    .limit(100)

  const rows: Row[] = (data ?? []) as Row[]

  return (
    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-4">
      <h2 className="text-[12px] font-semibold text-white/85 mb-3 flex items-center gap-2">
        <FolderGit2 size={12} className="text-emerald-400" /> Actieve worktrees ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="text-[11px] text-white/40 py-6 text-center">
          Geen actieve worktrees. Maak één met:
          <code className="ml-2 text-emerald-400/90 font-mono">osm-worktree new ENTITY slug</code>
        </p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => (
            <Link
              key={r.id}
              href={`/dashboard/osm/sessions/${r.id}`}
              className="grid grid-cols-12 gap-2 p-2 text-[10.5px] rounded-md hover:bg-white/[0.04] transition-colors items-center"
            >
              <span className="col-span-1 font-mono text-white/40">{r.machine_id}</span>
              <span className="col-span-2 text-white/85 font-medium truncate">{r.entity}</span>
              <span className="col-span-3 font-mono text-white/60 truncate">{r.git_branch || '—'}</span>
              <span className="col-span-5 font-mono text-white/50 truncate">{r.worktree_path}</span>
              <span className="col-span-1 text-right text-white/40">{timeAgo(r.updated_at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
