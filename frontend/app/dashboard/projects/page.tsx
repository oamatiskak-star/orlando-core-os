import { FolderKanban, GitBranch, ExternalLink } from 'lucide-react'

const projects = [
  {
    name: 'orlando-core-os',
    bv: 'MODIWÉ',
    bvColor: '#6366f1',
    status: 'In ontwikkeling',
    statusClass: 'bg-sky-500/10 text-sky-400',
    progress: 60,
    repo: 'oamatiskak-star/orlando-core-os',
  },
  {
    name: 'sterkbouw-saas-front',
    bv: 'BOUW',
    bvColor: '#f59e0b',
    status: 'Actief',
    statusClass: 'bg-green-500/10 text-green-400',
    progress: 45,
    repo: 'oamatiskak-star/sterkbouw-saas-front',
  },
  {
    name: 'VastgoedScalper',
    bv: 'BEHEER',
    bvColor: '#0ea5e9',
    status: 'Gepland',
    statusClass: 'bg-white/5 text-white/50',
    progress: 0,
    repo: null,
  },
  {
    name: 'Mac Mini Sync Setup',
    bv: 'MODIWÉ',
    bvColor: '#6366f1',
    status: 'Afgerond',
    statusClass: 'bg-green-500/10 text-green-400',
    progress: 100,
    repo: null,
  },
]

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
            <FolderKanban size={16} className="text-sky-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Projecten</h1>
            <p className="text-xs text-white/50">Alle lopende en geplande projecten over alle BV&apos;s.</p>
          </div>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          Nieuw project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => (
          <div key={p.name} className="bg-white/[0.06] border border-white/5 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{p.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ backgroundColor: p.bvColor + '20', color: p.bvColor }}
                  >
                    {p.bv}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.statusClass}`}>
                    {p.status}
                  </span>
                </div>
              </div>
              {p.repo && (
                <button className="flex items-center gap-1 text-[11px] text-white/50 hover:text-white/60 transition-colors">
                  <GitBranch size={11} />
                  <ExternalLink size={11} />
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-white/50">Voortgang</span>
                <span className="text-[11px] text-white/50 font-medium">{p.progress}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${p.progress}%` }}
                />
              </div>
            </div>

            {p.repo && (
              <p className="text-[11px] text-white/38 font-mono">{p.repo}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
