'use client'

import { useRef, useState, useEffect } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Shield, FolderOpen, RefreshCw, Hash, FolderInput } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Dossier } from '@/lib/advocaat/types'

// ── Pre-initialiseer hash-wasm zodra dit module geladen wordt ─────────────────
// Zo is de WASM binary klaar tegen de tijd dat de eerste upload start.
const hasherFactory = import('hash-wasm').then(m => m.createSHA256)

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.eml,.msg,.json,.zip,.png,.jpg,.jpeg,.tiff'

const SCAN_EXTS = new Set([
  'pdf','doc','docx','xls','xlsx','txt','eml','msg','json','zip','png','jpg','jpeg','tiff',
])

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

type UploadStatus = 'pending' | 'hashing' | 'checking' | 'uploading' | 'registering' | 'done' | 'duplicate' | 'error'

interface QueueItem {
  id: string
  file: File
  status: UploadStatus
  progress: number
  error?: string
  sha256?: string
}

const STATUS_LABEL: Record<UploadStatus, [string, string]> = {
  pending:     ['In wachtrij',  'text-white/30'],
  hashing:     ['SHA256...',    'text-blue-400'],
  checking:    ['Controle...',  'text-blue-300'],
  uploading:   ['Uploaden...',  'text-violet-400'],
  registering: ['Opslaan...',   'text-violet-400'],
  done:        ['Geïndexeerd', 'text-emerald-400'],
  duplicate:   ['Duplicaat',    'text-white/30'],
  error:       ['Fout',         'text-red-400'],
}

// Streaming SHA256 — 8 MB chunks, WASM hergebruikt via module-level promise
async function streamingSHA256(file: File): Promise<string> {
  const createSHA256 = await hasherFactory
  const hasher = await createSHA256()
  const CHUNK = 8 * 1024 * 1024
  let offset = 0
  while (offset < file.size) {
    const buf = await file.slice(offset, offset + CHUNK).arrayBuffer()
    hasher.update(new Uint8Array(buf))
    offset += CHUNK
  }
  return hasher.digest('hex')
}

// Recursieve folder traversal via browser FileSystem API
async function collectFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((res, rej) => {
      ;(entry as FileSystemFileEntry).file(f => {
        const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
        res(SCAN_EXTS.has(ext) ? [f] : [])
      }, rej)
    })
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    const all: File[] = []
    while (true) {
      const batch: FileSystemEntry[] = await new Promise((res, rej) => reader.readEntries(res, rej))
      if (batch.length === 0) break
      for (const sub of batch) all.push(...await collectFiles(sub))
    }
    return all
  }
  return []
}

function fmtBytes(n: number) {
  if (n < 1024)       return `${n} B`
  if (n < 1048576)    return `${(n / 1024).toFixed(1)} KB`
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`
  return `${(n / 1073741824).toFixed(1)} GB`
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
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const supabaseRef   = useRef(createClient())
  const dossierRef    = useRef(dossierSel)
  const processingRef = useRef<Set<string>>(new Set())

  useEffect(() => { dossierRef.current = dossierSel }, [dossierSel])

  useEffect(() => {
    fetch('/api/advocaat/dossiers?limit=50')
      .then(r => r.json())
      .then(d => setDossiers(d.dossiers ?? []))
      .catch(() => {})
  }, [])

  function patch(id: string, update: Partial<QueueItem>) {
    setQueue(q => q.map(i => i.id === id ? { ...i, ...update } : i))
  }

  async function processFile(item: QueueItem) {
    if (processingRef.current.has(item.id)) return
    processingRef.current.add(item.id)

    const { file } = item
    const dossierId = dossierRef.current
    const dotIdx = file.name.lastIndexOf('.')
    const ext    = dotIdx > 0 ? file.name.slice(dotIdx + 1).toLowerCase() : ''

    // 1. Streaming SHA256
    patch(item.id, { status: 'hashing', progress: 15 })
    let sha256: string
    try {
      sha256 = await streamingSHA256(file)
    } catch (e) {
      patch(item.id, { status: 'error', error: `Hash fout: ${e instanceof Error ? e.message : String(e)}` })
      processingRef.current.delete(item.id)
      return
    }
    patch(item.id, { sha256, progress: 40 })

    // 2. Deduplicatiecheck VÓÓR de storage upload (spaart upload-tijd bij duplicaten)
    patch(item.id, { status: 'checking', progress: 45 })
    try {
      const checkRes = await fetch(`/api/advocaat/upload?hash=${sha256}`).then(r => r.json())
      if (checkRes.exists) {
        patch(item.id, { status: 'duplicate', progress: 100 })
        processingRef.current.delete(item.id)
        return
      }
    } catch {
      // check mislukt — ga gewoon door, de POST doet ook een check
    }
    patch(item.id, { progress: 50 })

    // 3. Upload naar Supabase Storage (rechtstreeks vanuit browser, geen Vercel proxy)
    patch(item.id, { status: 'uploading', progress: 55 })
    const storagePath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadErr } = await supabaseRef.current.storage
      .from('advocaat-uploads')
      .upload(storagePath, file, {
        contentType: MIME_MAP[ext] ?? file.type ?? 'application/octet-stream',
        upsert: false,
      })

    if (uploadErr) {
      patch(item.id, { status: 'error', error: uploadErr.message })
      processingRef.current.delete(item.id)
      return
    }
    patch(item.id, { progress: 85 })

    // 4. Registreer (edge function, geen cold start)
    patch(item.id, { status: 'registering', progress: 90 })
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
    }).then(r => r.json()).catch(e => ({ error: String(e) }))

    if (res.error) {
      await supabaseRef.current.storage.from('advocaat-uploads').remove([storagePath])
      patch(item.id, { status: 'error', error: res.error })
    } else {
      patch(item.id, { status: 'done', progress: 100 })
    }

    processingRef.current.delete(item.id)
  }

  function enqueue(files: File[]) {
    if (files.length === 0) return
    const items: QueueItem[] = files.map(f => ({
      id: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      status: 'pending' as UploadStatus,
      progress: 0,
    }))
    setQueue(q => [...items, ...q])
    // Max 4 gelijktijdig, stagger met 50ms
    const CONCURRENCY = 4
    items.forEach((item, i) => {
      setTimeout(() => processFile(item), Math.floor(i / CONCURRENCY) * 50)
    })
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const entries: FileSystemEntry[] = []
    if (e.dataTransfer.items) {
      for (const item of e.dataTransfer.items) {
        const entry = item.webkitGetAsEntry()
        if (entry) entries.push(entry)
      }
    }
    if (entries.length > 0) {
      const files: File[] = []
      for (const entry of entries) files.push(...await collectFiles(entry))
      enqueue(files)
    } else {
      enqueue(Array.from(e.dataTransfer.files))
    }
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    enqueue(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function clearDone() {
    setQueue(q => q.filter(i => !['done','duplicate','error'].includes(i.status)))
  }

  const counts = {
    active:    queue.filter(i => !['done','duplicate','error'].includes(i.status)).length,
    done:      queue.filter(i => i.status === 'done').length,
    duplicate: queue.filter(i => i.status === 'duplicate').length,
    error:     queue.filter(i => i.status === 'error').length,
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6 space-y-5">

      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Upload className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Document Upload</h1>
          <p className="text-xs text-white/40 mt-0.5">
            PDF · Word · Excel · Outlook · EML · ZIP · Afbeeldingen · Mappen · tot 500 MB per bestand
          </p>
        </div>
      </div>

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
        className={`relative border-2 border-dashed rounded-2xl p-14 text-center transition-all duration-150
          ${dragging
            ? 'border-violet-500/70 bg-violet-500/8 scale-[1.005]'
            : 'border-white/[0.1] bg-white/[0.015]'}`}
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors
          ${dragging ? 'bg-violet-500/20' : 'bg-white/[0.04]'}`}>
          <Upload className={`w-6 h-6 transition-colors ${dragging ? 'text-violet-400' : 'text-white/30'}`} />
        </div>
        <p className="text-white/70 font-medium text-sm">Sleep bestanden of mappen hierheen</p>
        <p className="text-xs text-white/30 mt-2">
          PDF · DOC · DOCX · XLS · XLSX · EML · MSG · TXT · JSON · ZIP · PNG · JPG · TIFF
        </p>
        <p className="text-[10px] text-white/20 mt-1.5">
          Mappen worden recursief doorzocht · tot 500 MB · SHA256 streaming
        </p>

        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 transition-all"
          >
            <FileText className="w-3.5 h-3.5" /> Bestanden kiezen
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.07] border border-white/[0.1] text-white/70 text-xs font-medium hover:text-white hover:bg-white/[0.1] transition-all"
          >
            <FolderInput className="w-3.5 h-3.5" /> Map kiezen
          </button>
        </div>

        <input ref={fileInputRef} type="file" multiple accept={ACCEPT} onChange={onInput} className="hidden" />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard
          webkitdirectory=""
          multiple
          onChange={onInput}
          className="hidden"
        />
      </div>

      {queue.length > 0 && (
        <div className="flex items-center gap-4 text-xs">
          {counts.active    > 0 && <span className="text-blue-400">{counts.active} bezig</span>}
          {counts.done      > 0 && <span className="text-emerald-400">{counts.done} geïndexeerd</span>}
          {counts.duplicate > 0 && <span className="text-white/30">{counts.duplicate} duplicaat</span>}
          {counts.error     > 0 && <span className="text-red-400">{counts.error} fout</span>}
          <button onClick={clearDone} className="ml-auto text-white/25 hover:text-white/60 transition-colors flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Voltooide wissen
          </button>
        </div>
      )}

      {queue.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
          {queue.map(item => {
            const [label, labelColor] = STATUS_LABEL[item.status]
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <StatusIcon status={item.status} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white truncate max-w-[440px]">{item.file.name}</span>
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
                        className="h-full bg-violet-500/70 rounded-full transition-all duration-300"
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

      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 text-[11px] text-blue-300/60">
        <Shield className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          Forensische modus — SHA256 streaming (8 MB chunks, client-side WASM).
          Deduplicatiecheck vóór upload — duplicaten worden nooit opgeslagen.
          Bestanden gaan rechtstreeks naar Supabase Storage, Vercel is niet betrokken.
          Registratie via edge function — geen cold start.
        </span>
      </div>
    </div>
  )
}
