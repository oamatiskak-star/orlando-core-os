export type DossierType =
  | 'curator' | 'faillissement' | 'bestuurdersaansprakelijkheid'
  | 'pauliana' | 'incasso' | 'contractgeschil' | 'vastgoedgeschil'
  | 'arbeidsrecht' | 'aansprakelijkheid' | 'dagvaarding' | 'overig'

export type DossierStatus = 'actief' | 'on_hold' | 'gesloten' | 'gewonnen' | 'verloren' | 'geschikt'
export type Priority = 'kritiek' | 'hoog' | 'medium' | 'laag'
export type ContentLabel = 'FEIT' | 'INTERPRETATIE' | 'RISICO' | 'VERMOEDEN' | 'ONBEKEND'
export type EvidenceStrength = 'sterk' | 'gemiddeld' | 'zwak' | 'circumstantieel'
export type RiskSeverity = 'kritiek' | 'hoog' | 'medium' | 'laag'

export interface Dossier {
  id: string
  owner_id: string
  title: string
  description: string | null
  dossier_type: DossierType
  status: DossierStatus
  priority: Priority
  risk_score: number
  wederpartij: string | null
  wederpartij_email: string | null
  advocaat_naam: string | null
  rechtbank: string | null
  zaaknummer: string | null
  inzet_bedrag: number | null
  key_dates: Record<string, string>
  parties: Party[]
  tags: string[]
  ai_summary: string | null
  ai_risk_analysis: string | null
  next_deadline: string | null
  next_action: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Party {
  naam: string
  rol: string
  email?: string
  telefoon?: string
}

export interface CuratorDossier {
  id: string
  dossier_id: string
  bedrijf_naam: string
  kvk_nummer: string | null
  insolventienummer: string | null
  rechtbank: string | null
  faillissementsdatum: string | null
  status: 'actief' | 'opgeheven' | 'akkoord' | 'surseance'
  curator_naam: string | null
  curator_kantoor: string | null
  curator_email: string | null
  last_contact_at: string | null
  next_deadline: string | null
  risk_level: RiskSeverity
  aansprakelijkheid_risk: boolean
  pauliana_risk: boolean
  boedel_vordering: number | null
  erkende_vordering: number | null
  betwiste_vordering: number | null
  ai_analysis: Record<string, unknown>
  open_vragen: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LegalDocument {
  id: string
  dossier_id: string | null
  title: string
  document_type: string
  source: string
  source_filename: string | null
  raw_text: string | null
  ocr_performed: boolean
  ocr_confidence: number | null
  is_evidence: boolean
  evidence_strength: EvidenceStrength | null
  content_label: ContentLabel
  immutable_hash: string | null
  document_date: string | null
  author: string | null
  recipient: string | null
  tags: string[]
  ai_summary: string | null
  ai_risk_flags: string[]
  created_at: string
}

export interface TimelineEvent {
  id: string
  dossier_id: string
  document_id: string | null
  event_date: string
  event_date_precision: string
  event_type: string
  title: string
  description: string
  source: ContentLabel
  confidence_score: number
  participants: string[]
  source_documents: string[]
  cross_source_match: boolean
  is_gap: boolean
  gap_significance: string | null
  legal_relevance: Priority
  notes: string | null
}

export interface LegalRisk {
  id: string
  dossier_id: string
  document_id: string | null
  risk_type: string
  severity: RiskSeverity
  probability: number
  title: string
  description: string
  ai_analysis: string | null
  recommended_action: string | null
  legal_basis: string | null
  deadline: string | null
  is_resolved: boolean
  detected_at: string
}

export interface LegalConcept {
  id: string
  dossier_id: string
  document_id: string | null
  subject: string
  recipient: string | null
  recipient_email: string | null
  body_draft: string
  tone: string
  strategy: string
  ai_rationale: string | null
  ai_confidence: number | null
  legal_basis: string | null
  warnings: string[]
  status: 'concept' | 'in_review' | 'goedgekeurd' | 'afgewezen' | 'verzonden'
  human_reviewed: boolean
  created_at: string
}

export interface ImportJob {
  id: string
  dossier_id: string | null
  import_type: string
  source_name: string
  source_path: string | null
  status: 'pending' | 'processing' | 'indexed' | 'failed' | 'partial'
  total_items: number
  indexed_items: number
  failed_items: number
  date_range_start: string | null
  date_range_end: string | null
  legal_items_found: number
  risk_items_found: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface MailDefenseItem {
  id: string
  mail_message_id: string | null
  dossier_id: string | null
  from_address: string | null
  from_name: string | null
  subject: string | null
  received_at: string | null
  body_text: string | null
  classification: string
  urgency: Priority
  risk_score: number
  deadline_detected: string | null
  deadline_text: string | null
  action_required: boolean
  action_description: string | null
  ai_summary: string | null
  ai_draft: string | null
  draft_created_at: string | null
  suggested_doc_ids: string[] | null
  processed: boolean
}

export interface SuggestedDoc {
  id: string
  title: string
  document_type: string
  is_evidence: boolean
  content_label: string
}

export interface ComposeResult {
  draft: string
  suggested_doc_ids: string[]
  suggested_docs: SuggestedDoc[]
  memories_used: number
  docs_searched: number
  keywords_found: string[]
}

export interface DossierStats {
  total: number
  actief: number
  kritiek: number
  avg_risk: number
  open_risicos: number
  komende_deadlines: number
  open_concepten: number
}
