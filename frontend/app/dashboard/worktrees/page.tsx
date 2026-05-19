import { GitBranch } from 'lucide-react'
import WorktreeClient from './WorktreeClient'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

export default function WorktreePage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <GitBranch size={16} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white">Git Worktree Manager</h1>
          <p className="text-xs text-white/40">Parallelle Claude sessies · CLI-L / CLI-R</p>
        </div>
      </div>
      <WorktreeClient />
    </div>
  )
}
