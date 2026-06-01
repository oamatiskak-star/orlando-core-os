import Link from 'next/link'
import { Cpu, PlayCircle, Terminal, FolderGit2 } from 'lucide-react'
import type { ReactNode } from 'react'

const SUB_NAV = [
  { href: '/dashboard/osm/sessions',   label: 'Sessies',     icon: PlayCircle },
  { href: '/dashboard/osm/worktrees',  label: 'Worktrees',   icon: FolderGit2 },
  { href: '/dashboard/osm/commands',   label: "Commando's",  icon: Terminal },
] as const

export default function OsmLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
        >
          <Cpu size={16} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">OSM Operating System</h1>
          <p className="text-xs text-white/50">
            Persistent workspace · crash- &amp; context-limit recovery · multi-machine sync
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1.5 border-b border-white/[0.06] pb-3">
        {SUB_NAV.map((entry) => {
          const Icon = entry.icon
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/80 border border-white/[0.06] transition-colors"
            >
              <Icon size={11} />
              <span>{entry.label}</span>
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
