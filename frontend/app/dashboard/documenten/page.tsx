import { Files, Folder, Upload, FileText } from 'lucide-react'

const folders = [
  { naam: 'MODIWÉ', count: 3 },
  { naam: 'STRKBEHEER', count: 0 },
  { naam: 'STRKBOUW', count: 2 },
  { naam: 'Gedeeld', count: 1 },
]

const recentFiles = [
  { naam: 'Oprichting MODIWÉ BV.pdf', map: 'MODIWÉ', datum: '03 mei 2026', size: '2.4 MB' },
  { naam: 'Aandeelhoudersbesluit Q1 2026.pdf', map: 'MODIWÉ', datum: '01 mei 2026', size: '840 KB' },
  { naam: 'Tekening_Obj01_v3.pdf', map: 'STRKBOUW', datum: '28 apr 2026', size: '14.2 MB' },
  { naam: 'NDA_Template_2026.docx', map: 'Gedeeld', datum: '20 apr 2026', size: '128 KB' },
]

export default function DocumentenPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
            <Files size={16} className="text-slate-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Documenten</h1>
            <p className="text-xs text-white/30">Centrale documentopslag — PDF&apos;s, tekeningen en rapporten.</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
          <Upload size={13} />
          Uploaden
        </button>
      </div>

      {/* Folders */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Mappen</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {folders.map((f) => (
            <button key={f.naam} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-3 text-left hover:bg-white/[0.05] hover:border-white/10 transition-colors group">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Folder size={16} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-white group-hover:text-indigo-300 transition-colors">{f.naam}/</p>
                <p className="text-[11px] text-white/30">{f.count} bestand{f.count !== 1 ? 'en' : ''}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Files */}
      <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recente bestanden</h2>
          <button className="text-[11px] text-indigo-400 hover:text-indigo-300">Alles zien</button>
        </div>
        <div className="space-y-1">
          {recentFiles.map((file, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors group cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <FileText size={13} className="text-white/30" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 group-hover:text-white transition-colors truncate">{file.naam}</p>
                <p className="text-[11px] text-white/30">{file.map} · {file.datum}</p>
              </div>
              <span className="text-[11px] text-white/25 flex-shrink-0">{file.size}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
