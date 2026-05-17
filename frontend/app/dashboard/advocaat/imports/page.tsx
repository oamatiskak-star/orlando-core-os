'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Shield, FolderOpen, RefreshCw, Hash } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Dossier } from '@/lib/advocaat/types'

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.eml,.msg,.json,.zip,.png,.jpg,.jpeg,.tiff'

const MIME_MAP: Record<string, string> = {
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt:  'text/plain',
  json: 'application/json',
  eml:  'message/rfc822',
  msg:  'application/vnd.ms-outlook',
  zip:  'application/zip',
  png:  'image/png',
  jpg:  'image/jpeg',
  jpeg: 'image/jpeg',
  tiff: 'image/tiff',
}

type UploadStatus = 'pending' | 'hashing' | 'uploading' | 'registering' | 'done' | 'duplicate' | 'error'

interface QueueItem {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error?: string
  sha256?: string
}

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fmtBytes(n: number) {
  if (n < 1024)       return `${n} B`
  if (n < 1048576)    return `${(n / 1024).toFixed(1)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(1)} GB`
}

const STATUS_LABEL: Record<UploadStatus, [string, string]> = {
  pending:     ['In wachtrij',  'text-white/30'],
  hashing:     ['SHA256...',    'text-blue-400'],
  uploading:   ['Uploaden...',  'text-violet-400'],
  registering: ['Opslaan...',   'text-violet-400'],
  done:        ['Geïndexeerd', 'text-emerald-400'],
  duplicate:   ['Duplicaat',    'text-white/30'],
  error:       ['Fout',         'text-red-400'],
}

function StatusIcon({ status }: { status: UploadStatus }) {
  if (status === 'done')      return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
  if (status === 'duplicate') return <CheckCircle className="w-4 h-4 text-white/25 shrink-0" />
  if (status === 'error')     return <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
  if (status === 'pending')   return <FileText className="w-4 h-4 text-white/25 shrink-0" />
  return <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
}

export default function UploadPage() {
  const [dossiers,   setDossiers]   = useState<Dossier[]>([])
  const [dossierSel, setDossierSel] = useState('')
  const [queue,      setQueue]      = useState<QueueItem[]>([])
  const [dragging,   setDragging]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const processing = useRef<Set<string>>(new Set())

  // Supabase client — created once outside render
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    fetch('/api/advocaat/dossiers?limit=50')
      .then(r => r.json())
      .then(d => setDossiers(d.dossiers ?? []))
      .catch(() => {})
  }, [])

  function patch(id: string, update: Partial<QueueItem>) {
    setQueue(q => q.map(i => i.id === id ? { ...i, ...update } : i))
  }

  const processFile = useCallback(async (item: QueueItem, dossierId: string) => {
    if (processing.current.has(item.id)) return
    processing.current.add(item.id)

    const { file } = item
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''

    // 1. SHA256
    patch(item.id, { status: 'hashing', progress: 10 })
    let sha256: string
    try {
      sha256 = await computeSHA256(file)
    } catch {
      patch(item.id, { status: 'error', error: 'SHA256 berekening mislukt' })
      processing.current.delete(item.id)
      return
    }
    patch(item.id, { sha256, progress: 25 })

    // 2. Upload naar Supabase Storage
    patch(item.id, { status: 'uploading', progress: 30 })
    const storagePath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadErr } = await supabaseRef.current.storage
      .from('advocaat-uploads')
      .upload(storagePath, file, {
        contentType: MIME_MAP[ext] ?? file.type ?? 'application/octet-stream',
        upsert: false,
      })

    if (uploadErr) {
      patch(item.id, { status: 'error', error: uploadErr.message })
      processing.current.delete(item.id)
      return
    }
    patch(item.id, { progress: 75 })

    // 3. Registreer document
    patch(item.id, { status: 'registering', progress: 85 })
    const res = await fetch('/api/advocaat/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        storage_path:      storagePath,
        original_filename: file.name,
        sha256_hash:       sha256,
        file_size:         file.size,
        mime_type:         MIME_MAP[ext] ?? file.type,
        dossier_id:        dossierId || null,
      }),
    }).then(r => r.json()).catch(e => ({ error: e.message }))

    if (res.duplicate) {
      await supabaseRef.current.storage.from('advocaat-uploads').remove([storagePath])
      patch(item.id, { status: 'duplicate', progress: 100 })
    } else if (res.error) {
      await supabaseRef.current.storage.from('advocaat-uploads').remove([storagePath])
      patch(item.id, { status: 'error', error: res.error })
    } else {
      patch(item.id, { status: 'done', progress: 100 })
    }

    processing.current.delete(item.id)
  }, [])

  function addFiles(files: File[]) {
    const dossierId = dossierSel
    const items: QueueItem[] = files.map(f => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      status: 'pending' as UploadStatus,
      progress: 0,
    }))
    setQueue(q => [...items, ...q])
    // Start processing with a small stagger to avoid hammering
    items.forEach((item, i) => {
      setTimeout(() => processFile(item, dossierId), i * 100)
    })
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) addFiles(files)
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length) addFiles(files)
    e.target.value = ''
  }

  function clearDone() {
    setQueue(q => q.filter(i => !['done', 'duplicate', 'error'].includes(i.status)))
  }

  const counts = {
    active:    queue.filter(i => !['done','duplicate','error'].includes(i.status)).length,
    done:      queue.filter(i => i.status === 'done').length,
    duplicate: queue.filter(i => i.status === 'duplicate').length,
    error:     queue.filter(i => i.status === 'error').length,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Upload className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Document Upload</h1>
          <p className="text-xs text-white/40 mt-0.5">PDF · Word · Excel · Outlook · EML · ZIP · Afbeeldingen · tot 500 MB per bestand</p>
        </div>
      </div>

      {/* Dossier select */}
      <div className="flex items-center gap-2">
        <FolderOpen className="w-3.5 h-3.5 text-white/30" />
        <span className="text-xs text-white/40">Koppel aan dossier:</span>
        <select
          value={dossierSel}
          onChange={e => setDossierSel(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-violet-500/40"
        >
          <option value="">Geen dossier</option>
          {dossiers.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={e => { e.preventDefault(); setDragging(false) }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-14 text-center cursor-pointer select-none transition-all duration-150
          ${dragging
            ? 'border-violet-500/70 bg-violet-500/8 scale-[1.01]'
            : 'border-white/[0.1] bg-white/[0.015] hover:border-violet-500/40 hover:bg-white/[0.03]'}`}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPT} onChange={onInput} className="hidden" />
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors
          ${dragging ? 'bg-violet-500/20' : 'bg-white/[0.04]'}`}>
          <Upload className={`w-6 h-6 transition-colors ${dragging ? 'text-violet-400' : 'text-white/30'}`} />
        </div>
        <p className="text-white/70 font-medium text-sm">Sleep bestanden hierheen of klik om te selecteren</p>
        <p className="text-xs text-white/30 mt-2">PDF · DOC · DOCX · XLS · XLSX · EML · MSG · TXT · JSON · ZIP · PNG · JPG · TIFF</p>
        <p className="text-[10px] text-white/20 mt-1.5">Maximaal 500 MB per bestand · Meerdere bestanden tegelijk · SHA256 chain-of-custody</p>
      </div>

      {/* Queue stats + clear */}
      {queue.length > 0 && (
        <div className="flex items-center gap-4 text-xs">
          {counts.active    > 0 && <span className="text-blue-400">{counts.active} bezig</span>}
          {counts.done      > 0 && <span className="text-emerald-400">{counts.done} geïndexeerd</span>}
          {counts.duplicate > 0 && <span className="text-white/30">{counts.duplicate} duplicaat</span>}
          {counts.error     > 0 && <span className="text-red-400">{counts.error} fout</span>}
          <button
            onClick={clearDone}
            className="ml-auto text-white/25 hover:text-white/60 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Voltooide wissen
          </button>
        </div>
      )}

      {/* Queue list */}
      {queue.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
          {queue.map(item => {
            const [label, labelColor] = STATUS_LABEL[item.status]
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <StatusIcon status={item.status} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate max-w-[400px]">{item.file.name}</span>
                    <span className="text-[10px] text-white/25 shrink-0">{fmtBytes(item.file.size)}</span>
                  </div>

                  {item.status === 'error' && (
                    <p className="text-[10px] text-red-400 mt-0.5">{item.error}</p>
                  )}
                  {item.status === 'duplicate' && (
                    <p className="text-[10px] text-white/30 mt-0.5">Al aanwezig — SHA256 identiek, overgeslagen</p>
                  )}
                  {!['done','error','duplicate','pending'].includes(item.status) && (
                    <div className="mt-1.5 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500/70 rounded-full transition-all duration-500"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                  {item.sha256 && item.status === 'done' && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Hash className="w-2.5 h-2.5 text-white/15" />
                      <code className="text-[9px] text-white/20 truncate">{item.sha256}</code>
                    </div>
                  )}
                </div>

                <span className={`text-[10px] font-medium shrink-0 ${labelColor}`}>{label}</span>

                <button
                  onClick={() => setQueue(q => q.filter(i => i.id !== item.id))}
                  disabled={!['done','duplicate','error','pending'].includes(item.status)}
                  className="text-white/15 hover:text-white/50 disabled:opacity-30 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Forensisch label */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-[11px] text-blue-300/60">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Forensische modus actief — SHA256 hash wordt client-side berekend vóór upload.
          Bestanden worden opgeslagen in beveiligde Supabase Storage (eu-west-1, niet publiek).
          Duplicaten worden automatisch herkend op hash en niet dubbel opgeslagen.
          Niets wordt automatisch verzonden of gewijzigd.
        </span>
      </div>
    </div>
  )
}
