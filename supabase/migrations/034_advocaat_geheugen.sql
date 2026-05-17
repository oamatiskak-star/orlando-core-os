-- ── advocaat_geheugen ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advocaat_geheugen (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id          UUID REFERENCES advocaat_dossiers(id) ON DELETE CASCADE,
  type                TEXT NOT NULL CHECK (type IN (
                        'strategie','feit','risico','beslissing',
                        'partij_info','juridisch_standpunt','deadline','tijdlijn'
                      )),
  subject             TEXT NOT NULL,
  content             TEXT NOT NULL,
  confidence          NUMERIC(4,2) NOT NULL DEFAULT 0.80,
  source_document_ids UUID[] DEFAULT '{}',
  tags                TEXT[] DEFAULT '{}',
  last_used_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  times_used          INTEGER NOT NULL DEFAULT 0,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_advocaat_geheugen_dossier   ON advocaat_geheugen(dossier_id);
CREATE INDEX IF NOT EXISTS idx_advocaat_geheugen_type      ON advocaat_geheugen(type);
CREATE INDEX IF NOT EXISTS idx_advocaat_geheugen_active    ON advocaat_geheugen(is_active);
CREATE INDEX IF NOT EXISTS idx_advocaat_geheugen_last_used ON advocaat_geheugen(last_used_at DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_advocaat_geheugen_subject_trgm ON advocaat_geheugen USING gin(subject gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_advocaat_geheugen_content_trgm ON advocaat_geheugen USING gin(content gin_trgm_ops);

CREATE OR REPLACE FUNCTION update_advocaat_geheugen_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_advocaat_geheugen_updated_at ON advocaat_geheugen;
CREATE TRIGGER trg_advocaat_geheugen_updated_at
  BEFORE UPDATE ON advocaat_geheugen
  FOR EACH ROW EXECUTE FUNCTION update_advocaat_geheugen_updated_at();

ALTER TABLE advocaat_geheugen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_geheugen" ON advocaat_geheugen;
CREATE POLICY "anon_all_geheugen" ON advocaat_geheugen
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ── advocaat_mail_defense: nieuwe kolommen ──────────────────────────────────
ALTER TABLE advocaat_mail_defense
  ADD COLUMN IF NOT EXISTS body_text         TEXT,
  ADD COLUMN IF NOT EXISTS ai_draft          TEXT,
  ADD COLUMN IF NOT EXISTS draft_created_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suggested_doc_ids UUID[];
