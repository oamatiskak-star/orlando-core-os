import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import path from 'path'

export const dynamic = 'force-dynamic'

const LEGAL_KEYWORDS = [
  'curator','faillissement','dagvaarding','vonnis','ingebrekestelling',
  'sommatie','aansprakelijk','pauliana','boedel','rechtbank',
  'incasso','bestuurdersaansprakelijkheid','akte','conclusie',
]

const DOC_TYPES: Record<string, string[]> = {
  dagvaarding:       ['dagvaarding'],
  vonnis:            ['vonnis'],
  contract:          ['contract','overeenkomst','lening','krediet','huur','koop'],
  ingebrekestelling: ['ingebrekestelling','sommatie'],
  brief:             ['mail','brief','letter'],
  factuur:           ['factuur','invoice'],
  bewijs:            ['verklaring','toelichting','overdracht'],
}

function inferDocType(filename: string): string {
  const lower = filename.toLowerCase()
  for (const [type, kws] of Object.entries(DOC_TYPES)) {
    if (kws.some(k => lower.includes(k))) return type
  }
  return 'overig'
}

function isLegal(filename: string): boolean {
  const lower = filename.toLowerCase()
  return LEGAL_KEYWORDS.some(k => lower.includes(k))
}

function classifyContent(filename: string): string {
  const l = filename.toLowerCase()
  if (['dagvaarding','vonnis','sommat','ingebreke'].some(k => l.includes(k))) return 'RISICO'
  if (['verklaring','toelichting','bewijs','overdracht'].some(k => l.includes(k))) return 'FEIT'
  if (['liquiditeit','begroting','prognose'].some(k => l.includes(k))) return 'INTERPRETATIE'
  if (['curator','faillissement','boedel','aansprakelijk'].some(k => l.includes(k))) return 'RISICO'
  return 'ONBEKEND'
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { storage_path, original_filename, sha256_hash, file_size, mime_type, dossier_id } = await req.json()

  if (!storage_path || !original_filename || !sha256_hash) {
    return NextResponse.json({ error: 'storage_path, original_filename en sha256_hash vereist' }, { status: 400 })
  }

  // Deduplicatie op hash
  const { data: existing } = await supabase
    .from('advocaat_documenten')
    .select('id')
    .eq('immutable_hash', sha256_hash)
    .maybeSingle()

  if (existing) return NextResponse.json({ duplicate: true, existing_id: existing.id })

  const ext   = path.extname(original_filename).toLowerCase().replace('.', '')
  const title = path.basename(original_filename, path.extname(original_filename))
  const legalDoc = isLegal(original_filename)
  const label    = classifyContent(original_filename)
  const docType  = inferDocType(original_filename)

  const aiRiskFlags: string[] = []
  if (legalDoc)                                                       aiRiskFlags.push('juridisch_document')
  if (original_filename.toLowerCase().includes('curator'))            aiRiskFlags.push('curator_gerelateerd')
  if (original_filename.toLowerCase().includes('aansprakelijk'))      aiRiskFlags.push('aansprakelijkheid')
  if (original_filename.toLowerCase().includes('dagvaarding'))        aiRiskFlags.push('dagvaarding')
  if (original_filename.toLowerCase().includes('pauliana'))           aiRiskFlags.push('pauliana')
  if (original_filename.toLowerCase().includes('faillissement'))      aiRiskFlags.push('faillissement')

  const { data, error } = await supabase
    .from('advocaat_documenten')
    .insert({
      dossier_id:        dossier_id ?? null,
      title,
      document_type:     docType,
      source:            'upload',
      source_path:       storage_path,
      source_filename:   original_filename,
      mime_type:         mime_type ?? 'application/octet-stream',
      file_size_bytes:   file_size ?? null,
      immutable_hash:    sha256_hash,
      content_label:     label,
      is_evidence:       legalDoc,
      evidence_strength: legalDoc ? 'gemiddeld' : null,
      tags:              ['upload', ext].filter(Boolean),
      ai_risk_flags:     aiRiskFlags,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('advocaat_audit_log').insert({
    dossier_id: dossier_id ?? null,
    action: 'document_geupload',
    actor: 'upload_portal',
    description: `Upload: ${original_filename} (${((file_size ?? 0) / 1048576).toFixed(1)} MB)`,
    metadata: { storage_path, sha256_hash, file_size, mime_type, is_evidence: legalDoc },
  })

  return NextResponse.json({ document: data })
}
