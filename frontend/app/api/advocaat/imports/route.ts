import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

export const dynamic = 'force-dynamic'

const KNOWN_SOURCES = {
  desktop_curator:     '/Users/bouwproffsnederlandbv/Desktop/O.S.M. AMATISKAK/Curator',
  desktop_curator_new: '/Users/bouwproffsnederlandbv/Desktop/O.S.M. AMATISKAK/Curator new',
  documenten_claude:   '/Users/bouwproffsnederlandbv/Documenten/Claude',
}

function scanDirectory(dirPath: string): { path: string; name: string; ext: string; size: number; mtime: Date }[] {
  const results: { path: string; name: string; ext: string; size: number; mtime: Date }[] = []
  if (!fs.existsSync(dirPath)) return results

  function walk(current: string) {
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (['.pdf', '.docx', '.xlsx', '.txt', '.json', '.eml', '.msg'].includes(ext)) {
            const stat = fs.statSync(full)
            results.push({ path: full, name: entry.name, ext, size: stat.size, mtime: stat.mtime })
          }
        }
      }
    } catch {}
  }

  walk(dirPath)
  return results
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const scan = searchParams.get('scan')

  if (scan === 'sources') {
    const sourceStatus = Object.entries(KNOWN_SOURCES).map(([key, dirPath]) => ({
      key,
      path: dirPath,
      exists: fs.existsSync(dirPath),
      files: fs.existsSync(dirPath) ? scanDirectory(dirPath).length : 0,
    }))
    return NextResponse.json({ sources: sourceStatus })
  }

  const { data, error } = await supabase
    .from('advocaat_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ imports: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { import_type, source_key, dossier_id, source_path: customPath } = body

  if (!import_type) return NextResponse.json({ error: 'import_type vereist' }, { status: 400 })

  const sourcePath = customPath ?? KNOWN_SOURCES[source_key as keyof typeof KNOWN_SOURCES] ?? null

  const files = sourcePath ? scanDirectory(sourcePath) : []

  const { data: importJob, error: importError } = await supabase
    .from('advocaat_imports')
    .insert({
      dossier_id: dossier_id ?? null,
      import_type,
      source_name: source_key ?? customPath ?? import_type,
      source_path: sourcePath,
      status: 'processing',
      total_items: files.length,
      started_at: new Date().toISOString(),
      metadata: { source_key, files_found: files.length },
    })
    .select()
    .single()

  if (importError) return NextResponse.json({ error: importError.message }, { status: 500 })

  let indexed = 0
  let failed  = 0
  let legalFound = 0

  for (const file of files) {
    try {
      const hash = crypto.createHash('sha256').update(file.path + file.size + file.mtime.toISOString()).digest('hex')

      const existing = await supabase
        .from('advocaat_documenten')
        .select('id')
        .eq('immutable_hash', hash)
        .single()

      if (!existing.error && existing.data) { indexed++; continue }

      const docType = inferDocType(file.name)
      const isLegal = isLegalDocument(file.name)
      if (isLegal) legalFound++

      const { error: docError } = await supabase.from('advocaat_documenten').insert({
        dossier_id: dossier_id ?? null,
        title: path.basename(file.name, file.ext),
        document_type: docType,
        source: import_type,
        source_path: file.path,
        source_filename: file.name,
        mime_type: mimeFor(file.ext),
        file_size_bytes: file.size,
        immutable_hash: hash,
        content_label: 'ONBEKEND',
        document_date: file.mtime.toISOString(),
        ai_risk_flags: isLegal ? ['juridisch_document'] : [],
        tags: [import_type, file.ext.replace('.', '')],
      })

      if (docError) { failed++; continue }
      indexed++
    } catch { failed++ }
  }

  await supabase.from('advocaat_imports').update({
    status: failed > 0 && indexed === 0 ? 'failed' : failed > 0 ? 'partial' : 'indexed',
    indexed_items: indexed,
    failed_items: failed,
    legal_items_found: legalFound,
    completed_at: new Date().toISOString(),
  }).eq('id', importJob.id)

  await supabase.from('advocaat_audit_log').insert({
    dossier_id: dossier_id ?? null,
    action: 'import_uitgevoerd',
    actor: 'systeem',
    description: `Import: ${import_type} — ${indexed} geïndexeerd, ${legalFound} juridisch`,
    metadata: { import_type, sourcePath, indexed, failed, legalFound },
  })

  return NextResponse.json({ import: { ...importJob, indexed_items: indexed, legal_items_found: legalFound } })
}

function inferDocType(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.includes('dagvaarding'))         return 'dagvaarding'
  if (lower.includes('vonnis'))              return 'vonnis'
  if (lower.includes('contract') || lower.includes('overeenkomst')) return 'contract'
  if (lower.includes('factuur') || lower.includes('invoice'))       return 'factuur'
  if (lower.includes('brief') || lower.includes('letter'))          return 'brief'
  if (lower.includes('ingebrekestelling') || lower.includes('sommatie')) return 'ingebrekestelling'
  if (lower.endsWith('.eml') || lower.endsWith('.msg'))              return 'email'
  if (lower.includes('chat') || lower.includes('export'))           return 'overig'
  return 'overig'
}

function isLegalDocument(filename: string): boolean {
  const lower = filename.toLowerCase()
  const legalKeywords = [
    'curator', 'faillissement', 'dagvaarding', 'vonnis', 'sommatie',
    'ingebrekestelling', 'rechtbank', 'bestuurdersaansprakelijkheid',
    'pauliana', 'incasso', 'hoger beroep', 'conclusie', 'akte',
  ]
  return legalKeywords.some(kw => lower.includes(kw))
}

function mimeFor(ext: string): string {
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.eml': 'message/rfc822',
    '.msg': 'application/vnd.ms-outlook',
  }
  return map[ext] ?? 'application/octet-stream'
}
