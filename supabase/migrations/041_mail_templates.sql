-- Mail Templates System
-- Stores reusable response templates by category and company

CREATE TABLE IF NOT EXISTS mail_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,  -- 'documenten', 'factuur', 'leverancier', 'advocaat'
  company text,             -- NULL = applies to all companies
  subject_template text NOT NULL,
  body_template text NOT NULL,
  placeholder_hints jsonb,  -- {"{{company_name}}": "Name of the company", "{{amount}}": "Invoice amount"}
  sentiment text DEFAULT 'formal',  -- 'formal', 'friendly', 'urgent'
  confidence_min numeric DEFAULT 0.3,
  enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS mail_template_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES mail_templates ON DELETE CASCADE,
  draft_id uuid REFERENCES mail_drafts ON DELETE CASCADE,
  used_at timestamptz DEFAULT now(),
  approval_status text,  -- 'approved', 'rejected', 'modified'
  modifications text,    -- What the user changed
  sent boolean DEFAULT false
);

-- Indexes for performance
CREATE INDEX idx_mail_templates_category ON mail_templates(category, enabled);
CREATE INDEX idx_mail_templates_company ON mail_templates(company);
CREATE INDEX idx_mail_template_history_draft ON mail_template_history(draft_id);
CREATE INDEX idx_mail_template_history_template ON mail_template_history(template_id);

-- Seed default templates

-- 1. DOCUMENTEN AANVRAAG (Document Request) Template
INSERT INTO mail_templates (
  name,
  category,
  company,
  subject_template,
  body_template,
  placeholder_hints,
  sentiment,
  confidence_min,
  created_by
) VALUES (
  'Documenten Aanvraag - Standaard',
  'documenten',
  NULL,
  'Re: {{original_subject}}',
  'Beste {{contact_name}},

Dank voor uw e-mail. Wij hebben uw aanvraag voor {{requested_documents}} ontvangen.

Wij zullen {{response_timeline}} deze documenten aan u toesturen in {{format}}.

Mocht u nog vragen hebben, aarzel niet om contact met ons op te nemen.

Met vriendelijke groet,
Orlando Amatiskak
Bouwproffs Holding B.V.',
  '{"{{contact_name}}": "Name of the person requesting", "{{requested_documents}}": "List of documents requested (e.g., statuten, contract)", "{{response_timeline}}": "Timeline (e.g., within 24 hours)", "{{format}}": "Document format (e.g., PDF)"}',
  'formal',
  0.4,
  'system'
);

-- 2. FACTUUR BEVESTIGING (Invoice Acknowledgment) Template
INSERT INTO mail_templates (
  name,
  category,
  company,
  subject_template,
  body_template,
  placeholder_hints,
  sentiment,
  confidence_min,
  created_by
) VALUES (
  'Factuur Ontvangen - Bevestiging',
  'factuur',
  NULL,
  'Re: {{original_subject}} - Ontvangstbevestiging',
  'Beste {{contact_name}},

Wij kunnen bevestigen dat wij uw factuur nr. {{invoice_number}} van {{invoice_date}} hebben ontvangen.

Factuurbedrag: {{amount}}
Vervaldatum: {{due_date}}

De factuur zal worden verwerkt conform uw betalingscondities. U ontvangt een betaalbevestiging zodra de betaling is uitgevoerd.

Bedankt voor uw diensten/producten.

Met vriendelijke groet,
Orlando Amatiskak
Bouwproffs Holding B.V.',
  '{"{{contact_name}}": "Supplier or invoice sender name", "{{invoice_number}}": "Invoice number", "{{invoice_date}}": "Invoice date", "{{amount}}": "Invoice amount with currency", "{{due_date}}": "Payment due date"}',
  'friendly',
  0.5,
  'system'
);

-- 3. LEVERANCIER OFFERTE (Supplier Offer) Template
INSERT INTO mail_templates (
  name,
  category,
  company,
  subject_template,
  body_template,
  placeholder_hints,
  sentiment,
  confidence_min,
  created_by
) VALUES (
  'Leverancier Offerte - Ontvangstbevestiging',
  'leverancier',
  NULL,
  'Re: {{original_subject}} - Dank voor offerte',
  'Beste {{contact_name}},

Dank voor uw offerte van {{offer_date}}. Wij hebben deze zorgvuldig bekeken.

Wij zullen {{review_timeline}} terugkomen met onze reactie op uw voorstel.

Mocht u aanvullende informatie of verduidelijking nodig hebben, horen wij dit graag.

Met vriendelijke groet,
Orlando Amatiskak
Bouwproffs Holding B.V.',
  '{"{{contact_name}}": "Supplier contact name", "{{offer_date}}": "Date offer was received", "{{review_timeline}}": "Expected review timeline (e.g., within 5 working days)"}',
  'friendly',
  0.4,
  'system'
);

-- 4. ADVOCAAT / JURIDISCH (Legal) Template
INSERT INTO mail_templates (
  name,
  category,
  company,
  subject_template,
  body_template,
  placeholder_hints,
  sentiment,
  confidence_min,
  created_by
) VALUES (
  'Juridische Correspondentie - Procedueel',
  'advocaat',
  NULL,
  'Re: {{original_subject}}',
  'Beste {{contact_name}},

Wij hebben uw correspondentie van {{mail_date}} ontvangen.

Wij zullen deze zaak nader onderzoeken en {{legal_timeline}} een inhoudelijke reactie versturen.

Voor vragen kunt u contact opnemen met onze juridisch adviseur.

Met vriendelijke groet,
Orlando Amatiskak
Bouwproffs Holding B.V.',
  '{"{{contact_name}}": "Legal party or attorney name", "{{mail_date}}": "Date of legal correspondence", "{{legal_timeline}}": "Legal response timeline (considering statutory deadlines)"}',
  'formal',
  0.3,
  'system'
);

-- Enable RLS
ALTER TABLE mail_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_template_history ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (allow all authenticated users to read templates)
CREATE POLICY "Authenticated users can read templates"
  ON mail_templates
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Templates are managed by system"
  ON mail_templates
  FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (auth.uid()::text = 'system' OR current_setting('app.is_admin') = 'true');

CREATE POLICY "Authenticated users can read template history"
  ON mail_template_history
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Template history is managed by system"
  ON mail_template_history
  FOR INSERT
  TO authenticated
  USING (true);
