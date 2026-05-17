-- Migration 033: AI Advocaat — Juridisch Operating System
-- Enterprise-grade legal defense platform voor curator/contract/aansprakelijkheid
-- Privacy-first, immutable audit trail, pgvector semantic search

-- ── EXTENSIES ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── advocaat_dossiers ─────────────────────────────────────────────────────────
-- Centrale juridische dossiers — één per zaak/conflict
CREATE TABLE IF NOT EXISTS public.advocaat_dossiers (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            text          NOT NULL DEFAULT 'osm',
  title               text          NOT NULL,
  description         text,
  dossier_type        text          NOT NULL DEFAULT 'overig'
                      CHECK (dossier_type IN (
                        'curator','faillissement','bestuurdersaansprakelijkheid',
                        'pauliana','incasso','contractgeschil','vastgoedgeschil',
                        'arbeidsrecht','aansprakelijkheid','dagvaarding','overig'
                      )),
  status              text          NOT NULL DEFAULT 'actief'
                      CHECK (status IN ('actief','on_hold','gesloten','gewonnen','verloren','geschikt')),
  priority            text          NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('kritiek','hoog','medium','laag')),
  risk_score          integer       NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  wederpartij         text,
  wederpartij_email   text,
  wederpartij_kvk     text,
  advocaat_naam       text,
  advocaat_email      text,
  rechtbank           text,
  zaaknummer          text,
  inzet_bedrag        numeric(12,2),
  key_dates           jsonb         NOT NULL DEFAULT '{}',
  parties             jsonb         NOT NULL DEFAULT '[]',
  tags                text[]        NOT NULL DEFAULT '{}',
  ai_summary          text,
  ai_risk_analysis    text,
  next_deadline       date,
  next_action         text,
  is_archived         boolean       NOT NULL DEFAULT false,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_dossiers_owner_idx    ON public.advocaat_dossiers (owner_id);
CREATE INDEX IF NOT EXISTS advocaat_dossiers_status_idx   ON public.advocaat_dossiers (status);
CREATE INDEX IF NOT EXISTS advocaat_dossiers_priority_idx ON public.advocaat_dossiers (priority);
CREATE INDEX IF NOT EXISTS advocaat_dossiers_type_idx     ON public.advocaat_dossiers (dossier_type);
CREATE INDEX IF NOT EXISTS advocaat_dossiers_deadline_idx ON public.advocaat_dossiers (next_deadline) WHERE next_deadline IS NOT NULL;

ALTER TABLE public.advocaat_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_dossiers_all ON public.advocaat_dossiers USING (true);

-- ── advocaat_curator ──────────────────────────────────────────────────────────
-- Curator-specifieke data per faillissement
CREATE TABLE IF NOT EXISTS public.advocaat_curator (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id            uuid          NOT NULL REFERENCES public.advocaat_dossiers(id) ON DELETE CASCADE,
  bedrijf_naam          text          NOT NULL,
  kvk_nummer            text,
  rsin                  text,
  insolventienummer     text,
  rechtbank             text,
  faillissementsdatum   date,
  opheffingsdatum       date,
  status                text          NOT NULL DEFAULT 'actief'
                        CHECK (status IN ('actief','opgeheven','akkoord','surseance')),
  curator_naam          text,
  curator_kantoor       text,
  curator_email         text,
  curator_phone         text,
  rechter_commissaris   text,
  uitdelingslijst_date  date,
  last_contact_at       timestamptz,
  next_deadline         date,
  risk_level            text          NOT NULL DEFAULT 'hoog'
                        CHECK (risk_level IN ('kritiek','hoog','medium','laag')),
  aansprakelijkheid_risk boolean      NOT NULL DEFAULT false,
  pauliana_risk         boolean       NOT NULL DEFAULT false,
  boedel_vordering      numeric(12,2),
  erkende_vordering     numeric(12,2),
  betwiste_vordering    numeric(12,2),
  ai_analysis           jsonb         NOT NULL DEFAULT '{}',
  open_vragen           text[]        NOT NULL DEFAULT '{}',
  notes                 text,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  updated_at            timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_curator_dossier_idx ON public.advocaat_curator (dossier_id);
CREATE INDEX IF NOT EXISTS advocaat_curator_status_idx  ON public.advocaat_curator (status);

ALTER TABLE public.advocaat_curator ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_curator_all ON public.advocaat_curator USING (true);

-- ── advocaat_documenten ───────────────────────────────────────────────────────
-- Alle juridische documenten — immutable, OCR-indexed, vector-embedded
CREATE TABLE IF NOT EXISTS public.advocaat_documenten (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id          uuid          REFERENCES public.advocaat_dossiers(id) ON DELETE SET NULL,
  title               text          NOT NULL,
  document_type       text          NOT NULL DEFAULT 'overig'
                      CHECK (document_type IN (
                        'brief','dagvaarding','vonnis','contract','factuur',
                        'email','chat_export','overeenkomst','ingebrekestelling',
                        'sommatiebrief','conclusie','akte','bewijs','overig'
                      )),
  source              text          NOT NULL DEFAULT 'upload'
                      CHECK (source IN (
                        'upload','mail_imap','onedrive','chat_chatgpt',
                        'chat_claude','chat_whatsapp','chat_telegram',
                        'desktop_curator','desktop_curator_new','manual'
                      )),
  source_path         text,
  source_filename     text,
  mime_type           text,
  file_size_bytes     bigint,
  raw_text            text,
  ocr_performed       boolean       NOT NULL DEFAULT false,
  ocr_confidence      numeric(5,2),
  ocr_engine          text,
  embedding           vector(1536),
  classification      text          NOT NULL DEFAULT 'overig',
  extracted_entities  jsonb         NOT NULL DEFAULT '{}',
  extracted_dates     date[]        NOT NULL DEFAULT '{}',
  extracted_amounts   numeric[]     NOT NULL DEFAULT '{}',
  extracted_parties   text[]        NOT NULL DEFAULT '{}',
  is_evidence         boolean       NOT NULL DEFAULT false,
  evidence_strength   text          CHECK (evidence_strength IN ('sterk','gemiddeld','zwak','circumstantieel')),
  evidence_type       text,
  content_label       text          NOT NULL DEFAULT 'ONBEKEND'
                      CHECK (content_label IN ('FEIT','INTERPRETATIE','RISICO','VERMOEDEN','ONBEKEND')),
  immutable_hash      text,
  is_sealed           boolean       NOT NULL DEFAULT false,
  document_date       timestamptz,
  author              text,
  recipient           text,
  tags                text[]        NOT NULL DEFAULT '{}',
  ai_summary          text,
  ai_risk_flags       text[]        NOT NULL DEFAULT '{}',
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_doc_dossier_idx  ON public.advocaat_documenten (dossier_id);
CREATE INDEX IF NOT EXISTS advocaat_doc_type_idx     ON public.advocaat_documenten (document_type);
CREATE INDEX IF NOT EXISTS advocaat_doc_source_idx   ON public.advocaat_documenten (source);
CREATE INDEX IF NOT EXISTS advocaat_doc_evidence_idx ON public.advocaat_documenten (is_evidence) WHERE is_evidence = true;
CREATE INDEX IF NOT EXISTS advocaat_doc_date_idx     ON public.advocaat_documenten (document_date DESC);
CREATE INDEX IF NOT EXISTS advocaat_doc_hash_idx     ON public.advocaat_documenten (immutable_hash) WHERE immutable_hash IS NOT NULL;

ALTER TABLE public.advocaat_documenten ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_documenten_all ON public.advocaat_documenten USING (true);

-- ── advocaat_tijdlijn ─────────────────────────────────────────────────────────
-- Forensische chronologische reconstructie — cross-source event correlation
CREATE TABLE IF NOT EXISTS public.advocaat_tijdlijn (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id          uuid          NOT NULL REFERENCES public.advocaat_dossiers(id) ON DELETE CASCADE,
  document_id         uuid          REFERENCES public.advocaat_documenten(id) ON DELETE SET NULL,
  event_date          timestamptz   NOT NULL,
  event_date_precision text         NOT NULL DEFAULT 'dag'
                      CHECK (event_date_precision IN ('exact','dag','week','maand','jaar','geschat')),
  event_type          text          NOT NULL DEFAULT 'overig'
                      CHECK (event_type IN (
                        'betaling','afspraak','brief','email','gesprek','overeenkomst',
                        'opzegging','somatie','dagvaarding','vonnis','faillissement',
                        'contact','deadline','beslissing','overig'
                      )),
  title               text          NOT NULL,
  description         text          NOT NULL,
  source              text          NOT NULL DEFAULT 'ONBEKEND'
                      CHECK (source IN ('FEIT','INTERPRETATIE','RISICO','VERMOEDEN','ONBEKEND')),
  confidence_score    numeric(5,2)  NOT NULL DEFAULT 50 CHECK (confidence_score BETWEEN 0 AND 100),
  participants        text[]        NOT NULL DEFAULT '{}',
  source_documents    uuid[]        NOT NULL DEFAULT '{}',
  cross_source_match  boolean       NOT NULL DEFAULT false,
  is_gap              boolean       NOT NULL DEFAULT false,
  gap_significance    text,
  legal_relevance     text          NOT NULL DEFAULT 'laag'
                      CHECK (legal_relevance IN ('kritiek','hoog','medium','laag')),
  notes               text,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_tl_dossier_idx ON public.advocaat_tijdlijn (dossier_id);
CREATE INDEX IF NOT EXISTS advocaat_tl_date_idx    ON public.advocaat_tijdlijn (event_date);
CREATE INDEX IF NOT EXISTS advocaat_tl_type_idx    ON public.advocaat_tijdlijn (event_type);
CREATE INDEX IF NOT EXISTS advocaat_tl_source_idx  ON public.advocaat_tijdlijn (source);

ALTER TABLE public.advocaat_tijdlijn ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_tijdlijn_all ON public.advocaat_tijdlijn USING (true);

-- ── advocaat_risicos ──────────────────────────────────────────────────────────
-- Juridische risicodetectie en scoring
CREATE TABLE IF NOT EXISTS public.advocaat_risicos (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id          uuid          NOT NULL REFERENCES public.advocaat_dossiers(id) ON DELETE CASCADE,
  document_id         uuid          REFERENCES public.advocaat_documenten(id) ON DELETE SET NULL,
  risk_type           text          NOT NULL
                      CHECK (risk_type IN (
                        'bestuurdersaansprakelijkheid','pauliana','faillissement',
                        'contractbreuk','betalingsverzuim','tegenstrijdigheid',
                        'bewijs_ontbreekt','deadline_overschreden','incasso',
                        'aansprakelijkheid','onrechtmatige_daad','overig'
                      )),
  severity            text          NOT NULL DEFAULT 'medium'
                      CHECK (severity IN ('kritiek','hoog','medium','laag')),
  probability         integer       NOT NULL DEFAULT 50 CHECK (probability BETWEEN 0 AND 100),
  title               text          NOT NULL,
  description         text          NOT NULL,
  ai_analysis         text,
  recommended_action  text,
  legal_basis         text,
  deadline            date,
  is_resolved         boolean       NOT NULL DEFAULT false,
  resolved_at         timestamptz,
  resolution_notes    text,
  detected_at         timestamptz   NOT NULL DEFAULT now(),
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_risk_dossier_idx  ON public.advocaat_risicos (dossier_id);
CREATE INDEX IF NOT EXISTS advocaat_risk_severity_idx ON public.advocaat_risicos (severity);
CREATE INDEX IF NOT EXISTS advocaat_risk_type_idx     ON public.advocaat_risicos (risk_type);
CREATE INDEX IF NOT EXISTS advocaat_risk_open_idx     ON public.advocaat_risicos (is_resolved) WHERE is_resolved = false;

ALTER TABLE public.advocaat_risicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_risicos_all ON public.advocaat_risicos USING (true);

-- ── advocaat_concepten ────────────────────────────────────────────────────────
-- AI-gegenereerde concept antwoorden — NOOIT automatisch verzenden
CREATE TABLE IF NOT EXISTS public.advocaat_concepten (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id          uuid          NOT NULL REFERENCES public.advocaat_dossiers(id) ON DELETE CASCADE,
  document_id         uuid          REFERENCES public.advocaat_documenten(id) ON DELETE SET NULL,
  subject             text          NOT NULL,
  recipient           text,
  recipient_email     text,
  body_draft          text          NOT NULL,
  tone                text          NOT NULL DEFAULT 'formeel'
                      CHECK (tone IN ('formeel','juridisch','zakelijk','assertief','vriendelijk')),
  strategy            text          NOT NULL DEFAULT 'neutraal'
                      CHECK (strategy IN ('defensief','offensief','neutraliserend','mediatie','neutraal')),
  ai_rationale        text,
  ai_confidence       numeric(5,2),
  legal_basis         text,
  warnings            text[]        NOT NULL DEFAULT '{}',
  status              text          NOT NULL DEFAULT 'concept'
                      CHECK (status IN ('concept','in_review','goedgekeurd','afgewezen','verzonden')),
  human_reviewed      boolean       NOT NULL DEFAULT false,
  reviewed_by         text,
  reviewed_at         timestamptz,
  sent_at             timestamptz,
  version             integer       NOT NULL DEFAULT 1,
  created_at          timestamptz   NOT NULL DEFAULT now(),
  updated_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_concept_dossier_idx ON public.advocaat_concepten (dossier_id);
CREATE INDEX IF NOT EXISTS advocaat_concept_status_idx  ON public.advocaat_concepten (status);

ALTER TABLE public.advocaat_concepten ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_concepten_all ON public.advocaat_concepten USING (true);

-- ── advocaat_imports ──────────────────────────────────────────────────────────
-- Import jobs voor chat exports, mailboxen, OneDrive
CREATE TABLE IF NOT EXISTS public.advocaat_imports (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id          uuid          REFERENCES public.advocaat_dossiers(id) ON DELETE SET NULL,
  import_type         text          NOT NULL
                      CHECK (import_type IN (
                        'chatgpt_export','claude_export','whatsapp_export',
                        'telegram_export','gmail_imap','apple_mail_imap',
                        'pdf_scan','docx','xlsx','onedrive_sync',
                        'desktop_folder','manual'
                      )),
  source_name         text          NOT NULL,
  source_path         text,
  status              text          NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','processing','indexed','failed','partial')),
  total_items         integer       NOT NULL DEFAULT 0,
  indexed_items       integer       NOT NULL DEFAULT 0,
  failed_items        integer       NOT NULL DEFAULT 0,
  date_range_start    timestamptz,
  date_range_end      timestamptz,
  legal_items_found   integer       NOT NULL DEFAULT 0,
  risk_items_found    integer       NOT NULL DEFAULT 0,
  error_message       text,
  metadata            jsonb         NOT NULL DEFAULT '{}',
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_import_dossier_idx ON public.advocaat_imports (dossier_id);
CREATE INDEX IF NOT EXISTS advocaat_import_status_idx  ON public.advocaat_imports (status);
CREATE INDEX IF NOT EXISTS advocaat_import_type_idx    ON public.advocaat_imports (import_type);

ALTER TABLE public.advocaat_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_imports_all ON public.advocaat_imports USING (true);

-- ── advocaat_strategie ────────────────────────────────────────────────────────
-- AI juridische strategie analyses
CREATE TABLE IF NOT EXISTS public.advocaat_strategie (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id          uuid          NOT NULL REFERENCES public.advocaat_dossiers(id) ON DELETE CASCADE,
  analyse_type        text          NOT NULL DEFAULT 'volledig'
                      CHECK (analyse_type IN ('volledig','curator','contractueel','aansprakelijkheid','mediatie','snelanalyse')),
  sterke_punten       text[]        NOT NULL DEFAULT '{}',
  zwakke_punten       text[]        NOT NULL DEFAULT '{}',
  kansen              text[]        NOT NULL DEFAULT '{}',
  bedreigingen        text[]        NOT NULL DEFAULT '{}',
  aanbevolen_strategie text,
  onderhandelpositie  text,
  mediatie_kansen     text,
  rechtbank_kansen    numeric(5,2),
  schikkingsbedrag    numeric(12,2),
  proceskosten_risico numeric(12,2),
  ai_model            text,
  ai_confidence       numeric(5,2),
  bronnen_gebruikt    uuid[]        NOT NULL DEFAULT '{}',
  versie              integer       NOT NULL DEFAULT 1,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_strategie_dossier_idx ON public.advocaat_strategie (dossier_id);

ALTER TABLE public.advocaat_strategie ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_strategie_all ON public.advocaat_strategie USING (true);

-- ── advocaat_audit_log ────────────────────────────────────────────────────────
-- Immutable audit trail — NOOIT verwijderen
CREATE TABLE IF NOT EXISTS public.advocaat_audit_log (
  id                  bigserial     PRIMARY KEY,
  dossier_id          uuid          REFERENCES public.advocaat_dossiers(id) ON DELETE SET NULL,
  document_id         uuid          REFERENCES public.advocaat_documenten(id) ON DELETE SET NULL,
  action              text          NOT NULL,
  actor               text          NOT NULL DEFAULT 'system',
  source_ip           text,
  description         text          NOT NULL,
  metadata            jsonb         NOT NULL DEFAULT '{}',
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_audit_dossier_idx ON public.advocaat_audit_log (dossier_id);
CREATE INDEX IF NOT EXISTS advocaat_audit_action_idx  ON public.advocaat_audit_log (action);
CREATE INDEX IF NOT EXISTS advocaat_audit_date_idx    ON public.advocaat_audit_log (created_at DESC);

ALTER TABLE public.advocaat_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_audit_all ON public.advocaat_audit_log USING (true);

-- Blokkeer DELETE en UPDATE op audit_log
CREATE OR REPLACE RULE audit_log_no_delete AS ON DELETE TO public.advocaat_audit_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_log_no_update AS ON UPDATE TO public.advocaat_audit_log DO INSTEAD NOTHING;

-- ── advocaat_mail_defense ─────────────────────────────────────────────────────
-- Mail defense agent — juridische classificatie van inkomende mails
CREATE TABLE IF NOT EXISTS public.advocaat_mail_defense (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  mail_message_id     text,
  dossier_id          uuid          REFERENCES public.advocaat_dossiers(id) ON DELETE SET NULL,
  document_id         uuid          REFERENCES public.advocaat_documenten(id) ON DELETE SET NULL,
  from_address        text,
  from_name           text,
  subject             text,
  received_at         timestamptz,
  classification      text          NOT NULL DEFAULT 'neutraal'
                      CHECK (classification IN (
                        'curator_bericht','dagvaarding','ingebrekestelling',
                        'sommatiebrief','vonnis','incasso','juridisch_neutraal',
                        'deadline_alert','neutraal'
                      )),
  urgency             text          NOT NULL DEFAULT 'laag'
                      CHECK (urgency IN ('kritiek','hoog','medium','laag')),
  risk_score          integer       NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  deadline_detected   date,
  deadline_text       text,
  key_entities        jsonb         NOT NULL DEFAULT '{}',
  action_required     boolean       NOT NULL DEFAULT false,
  action_description  text,
  concept_id          uuid          REFERENCES public.advocaat_concepten(id) ON DELETE SET NULL,
  processed           boolean       NOT NULL DEFAULT false,
  ai_summary          text,
  created_at          timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advocaat_mail_defense_dossier_idx ON public.advocaat_mail_defense (dossier_id);
CREATE INDEX IF NOT EXISTS advocaat_mail_defense_urgency_idx ON public.advocaat_mail_defense (urgency);
CREATE INDEX IF NOT EXISTS advocaat_mail_defense_class_idx   ON public.advocaat_mail_defense (classification);
CREATE INDEX IF NOT EXISTS advocaat_mail_defense_action_idx  ON public.advocaat_mail_defense (action_required) WHERE action_required = true;

ALTER TABLE public.advocaat_mail_defense ENABLE ROW LEVEL SECURITY;
CREATE POLICY advocaat_mail_defense_all ON public.advocaat_mail_defense USING (true);

-- ── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

-- Bereken geaggregeerde risk score voor een dossier
CREATE OR REPLACE FUNCTION public.advocaat_compute_risk_score(p_dossier_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_score integer := 0;
  v_kritiek integer;
  v_hoog integer;
  v_medium integer;
  v_deadline_days integer;
BEGIN
  SELECT COUNT(*) INTO v_kritiek FROM public.advocaat_risicos
    WHERE dossier_id = p_dossier_id AND severity = 'kritiek' AND is_resolved = false;
  SELECT COUNT(*) INTO v_hoog FROM public.advocaat_risicos
    WHERE dossier_id = p_dossier_id AND severity = 'hoog' AND is_resolved = false;
  SELECT COUNT(*) INTO v_medium FROM public.advocaat_risicos
    WHERE dossier_id = p_dossier_id AND severity = 'medium' AND is_resolved = false;

  v_score := (v_kritiek * 25) + (v_hoog * 10) + (v_medium * 3);

  SELECT EXTRACT(DAY FROM (next_deadline - CURRENT_DATE))::integer INTO v_deadline_days
    FROM public.advocaat_dossiers WHERE id = p_dossier_id;
  IF v_deadline_days IS NOT NULL AND v_deadline_days < 7 THEN
    v_score := v_score + 20;
  ELSIF v_deadline_days IS NOT NULL AND v_deadline_days < 30 THEN
    v_score := v_score + 10;
  END IF;

  RETURN LEAST(v_score, 100);
END;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.advocaat_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE TRIGGER advocaat_dossiers_updated_at
  BEFORE UPDATE ON public.advocaat_dossiers
  FOR EACH ROW EXECUTE FUNCTION public.advocaat_set_updated_at();

CREATE OR REPLACE TRIGGER advocaat_curator_updated_at
  BEFORE UPDATE ON public.advocaat_curator
  FOR EACH ROW EXECUTE FUNCTION public.advocaat_set_updated_at();

CREATE OR REPLACE TRIGGER advocaat_concepten_updated_at
  BEFORE UPDATE ON public.advocaat_concepten
  FOR EACH ROW EXECUTE FUNCTION public.advocaat_set_updated_at();
