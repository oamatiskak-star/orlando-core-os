'use client'

import { useEffect, useState } from 'react'
import {
  Upload, FolderOpen, CheckCircle, XCircle, Clock,
  RefreshCw, FileText, AlertTriangle, Zap, Database,
} from 'lucide-react'
import type { ImportJob } from '@/lib/advocaat/types'

const IMPORT_TYPES = [
  { key: 'desktop_curator',     label: 'Curator Bestanden',     desc: 'Desktop/O.S.M. AMATISKAK/Curator',         icon: FolderOpen,  color: 'red' },
  { key: 'desktop_curator_new', label: 'Curator New Bestanden', desc: 'Desktop/O.S.M. AMATISKAK/Curator new',     icon: FolderOpen,  color: 'orange' },
  { key: 'documenten_claude',   label: 'Claude Chat Exports',   desc: 'Documenten/Claude — chat exports',          icon: FileText,    color: 'violet' },
  { key: 'chatgpt_export',      label: 'ChatGPT Export',        desc: 'Handmatig pad opgeven',                     icon: FileText,    color: 'emerald' },
  { key: 'whatsapp_export',     label: 'WhatsApp Export',       desc: 'WhatsApp chat export (.txt/.zip)',           icon: FileText,    color: 'green' },
  { key: 'telegram_export',     label: 'Telegram Export',       desc: 'Telegram export (JSON)',                    icon: FileText,    color: 'blue' },
  { key: 'pdf_scan',            label: 'PDF Scan',              desc: 'OCR verwerking van PDF bestanden',          icon: Upload,      color: 'amber' },
  { key: 'onedrive_sync',       label: 'OneDrive Sync',         desc: 'Gedeelde OneDrive failliete bedrijven',     icon: Database,    color: 'blue' },
]

const STATUS_CONFIG = {
  pending:    { label: 'In wachtrij',  color: 'text-white/40',    icon: Clock },
  processing: { label: 'Verwerking',   color: 'text-blue-400',    icon: RefreshCw },
  indexed:    { label: 'Geïndexeerd', color: 'text-emerald-400', icon: CheckCircle },
  partial:    { label: 'Gedeeltelijk', color: 'text-yellow-400',  icon: AlertTriangle },
  failed:     { label: 'Mislukt',      color: 'text-red-400',     icon: XCircle },
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ImportsPage() {
  const [jobs,        setJobs]        = useState<ImportJob[]>([])
  const [sources,     setSources]     = useState<{ key: string; path: string; exists: boolean; files: number }[]>([])
  const [loading,     setLoading]     = useState(true)
  const [running,     setRunning]     = useState<string | null>(null)
  const [customPath,  setCustomPath]  = useState('')
  const [customType,  setCustomType]  = useState('pdf_scan')

  async function load() {
    setLoading(true)
    const [jobsRes, srcRes] = await Promise.all([
      fetch('/api/advocaat/imports').then(r => r.json()).catch(() => ({})),
      fetch('/api/advocaat/imports?scan=sources').then(r => r.json()).catch(() => ({})),
    ])
    setJobs(jobsRes.imports ?? [])
    setSources(srcRes.sources ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function runImport(import_type: string, source_key?: string, source_path?: string) {
    const key = source_key ?? import_type
    setRunning(key)
    await fetch('/api/advocaat/imports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ import_type, source_key, source_path }),
    })
    setRunning(null)
    load()
  }

  const stats = {
    totaal: jobs.length,
    geindexeerd: jobs.filter(j => j.status === 'indexed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    totalDocs: jobs.reduce((a, j) => a + j.indexed_items, 0),
    legalFound: jobs.reduce((a, j) => a + j.legal_items_found, 0),
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-6">

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <Upload className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Data Import Center</h1>
            <p className="text-xs text-white/40 mt-0.5">Chat exports · Mailboxen · Bestanden · OneDrive · OCR indexering</p>
          </div>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all">
          <RefreshCw className={`w-4 h-4 text-white/40 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Import jobs',   value: stats.totaal,        color: 'white' },
          { label: 'Geïndexeerd',  value: stats.geindexeerd,   color: 'emerald' },
          { label: 'Mislukt',       value: stats.failed,        color: stats.failed > 0 ? 'red' : 'white' },
          { label: 'Documenten',    value: stats.totalDocs,     color: 'blue' },
          { label: 'Juridisch',     value: stats.legalFound,    color: 'violet' },
        ].map(s => (
          <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3">
            <div className={`text-xl font-bold text-${s.color}-400`}>{s.value}</div>
            <div className="text-[10px] text-white/40 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Source availability */}
      {sources.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wider mb-3">Gekende bronmappen — Status</div>
          <div className="space-y-2">
            {sources.map(s => (
              <div key={s.key} className={`flex items-center gap-3 p-2.5 rounded-lg border ${s.exists ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-red-500/5 border-red-500/15'}`}>
                {s.exists ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                <code className="text-xs text-white/60 flex-1 truncate">{s.path}</code>
                <span className="text-xs text-white/40 shrink-0">{s.exists ? `${s.files} bestanden` : 'Niet gevonden'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Import cards */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Beschikbare Importbronnen</div>
          {IMPORT_TYPES.map(t => {
            const src = sources.find(s => s.key === t.key)
            const isRunning = running === t.key
            return (
              <div key={t.key} className={`flex items-center gap-3 p-3.5 rounded-xl border bg-${t.color}-500/5 border-${t.color}-500/15`}>
                <t.icon className={`w-4 h-4 text-${t.color}-400 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{t.label}</div>
                  <div className="text-[10px] text-white/40 mt-0.5 truncate">{t.desc}</div>
                  {src && <div className={`text-[10px] mt-0.5 ${src.exists ? 'text-emerald-400' : 'text-red-400'}`}>
                    {src.exists ? `✓ ${src.files} bestanden gevonden` : '✗ Map niet beschikbaar'}
                  </div>}
                </div>
                <button
                  onClick={() => runImport(t.key.startsWith('desktop') || t.key === 'documenten_claude' ? (t.key.includes('chatgpt') ? 'chatgpt_export' : t.key.includes('claude') ? 'claude_export' : 'pdf_scan') : t.key, t.key)}
                  disabled={isRunning}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-${t.color}-600 text-white hover:bg-${t.color}-500 disabled:opacity-40 disabled:cursor-not-allowed shrink-0`}
                >
                  <Zap className={`w-3 h-3 ${isRunning ? 'animate-pulse' : ''}`} />
                  {isRunning ? 'Bezig...' : 'Importeer'}
                </button>
              </div>
            )
          })}

          {/* Custom path */}
          <div className="p-3.5 rounded-xl border bg-white/[0.02] border-white/[0.07] space-y-2">
            <div className="text-xs font-medium text-white">Aangepast pad importeren</div>
            <input value={customPath} onChange={e => setCustomPath(e.target.value)}
              placeholder="/Users/.../pad/naar/bestanden"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/40"
            />
            <div className="flex gap-2">
              <select value={customType} onChange={e => setCustomType(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40">
                {IMPORT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <button onClick={() => customPath && runImport(customType, undefined, customPath)} disabled={!customPath || running === 'custom'}
                className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <Upload className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Import history */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <span className="text-sm font-medium text-white">Import Geschiedenis</span>
          </div>
          {loading ? (
            <div className="p-6 text-center text-white/30 text-sm">Laden...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-white/20 text-sm">
              <Upload className="w-8 h-8 mx-auto mb-2 opacity-20" />
              Nog geen imports uitgevoerd.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04] max-h-[600px] overflow-y-auto">
              {jobs.map(j => {
                const sc = STATUS_CONFIG[j.status] ?? STATUS_CONFIG.pending
                const Icon = sc.icon
                return (
                  <div key={j.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${sc.color} ${j.status === 'processing' ? 'animate-spin' : ''}`} />
                      <span className="text-sm font-medium text-white truncate flex-1">{j.source_name}</span>
                      <span className={`text-[10px] font-medium ${sc.color}`}>{sc.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-white/30">{j.import_type}</span>
                      <span className="text-[10px] text-white/40">{j.indexed_items}/{j.total_items} items</span>
                      {j.legal_items_found > 0 && (
                        <span className="text-[10px] text-violet-400">{j.legal_items_found} juridisch</span>
                      )}
                    </div>
                    {j.error_message && (
                      <div className="text-[10px] text-red-400 mt-1 truncate">{j.error_message}</div>
                    )}
                    <div className="text-[10px] text-white/20 mt-0.5">{fmt(j.created_at)}</div>

                    {j.total_items > 0 && (
                      <div className="mt-2 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${Math.round((j.indexed_items / j.total_items) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Processing notes */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-xs text-blue-300/70">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Forensische modus actief: alle bestanden worden alleen GELEZEN en geïndexeerd. Niets wordt gewijzigd, verplaatst of verwijderd. Elk document krijgt een immutable SHA256 hash voor chain-of-custody. OCR wordt lokaal uitgevoerd.</span>
      </div>
    </div>
  )
}
