-- Document template library for handling document requests in emails

CREATE TABLE IF NOT EXISTS mail_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  document_type text NOT NULL, -- e.g., 'statuten', 'contract', 'offerte', 'invoice'
  category text NOT NULL, -- matches mail_message categories
  company text, -- specific company or NULL for general
  description text,
  template_content text, -- markdown template content
  placeholder_hints jsonb, -- { "company": "Company name", "items": "Items ordered" }
  sentiment text DEFAULT 'professional', -- tone: professional, friendly, formal
  confidence_min float DEFAULT 0.6,
  enabled boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS mail_document_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES mail_messages(id) ON DELETE CASCADE,
  from_email text NOT NULL,
  document_type text NOT NULL, -- what document is requested
  confidence float DEFAULT 0.5, -- how confident we are it's requested
  suggested_template_id uuid REFERENCES mail_document_templates(id) ON DELETE SET NULL,
  status text DEFAULT 'pending', -- pending, fulfilled, deferred
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  fulfilled_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS mail_document_fulfillment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES mail_document_requests(id) ON DELETE CASCADE,
  draft_id uuid REFERENCES mail_drafts(id) ON DELETE SET NULL,
  document_template_id uuid NOT NULL REFERENCES mail_document_templates(id) ON DELETE RESTRICT,
  fulfillment_method text, -- 'email_attachment', 'link', 'scheduled'
  scheduled_for timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS mail_document_templates_category_idx ON mail_document_templates(category);
CREATE INDEX IF NOT EXISTS mail_document_templates_type_idx ON mail_document_templates(document_type);
CREATE INDEX IF NOT EXISTS mail_document_requests_message_idx ON mail_document_requests(message_id);
CREATE INDEX IF NOT EXISTS mail_document_requests_status_idx ON mail_document_requests(status);
CREATE INDEX IF NOT EXISTS mail_document_fulfillment_request_idx ON mail_document_fulfillment(request_id);

-- RLS Policies
ALTER TABLE mail_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE mail_document_fulfillment ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read templates
CREATE POLICY "Authenticated users can read document templates"
  ON mail_document_templates FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow all authenticated users to read document requests
CREATE POLICY "Authenticated users can read document requests"
  ON mail_document_requests FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow system to insert document requests
CREATE POLICY "System can insert document requests"
  ON mail_document_requests FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow users to update their own requests
CREATE POLICY "Users can update document request status"
  ON mail_document_requests FOR UPDATE
  USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Allow all authenticated users to read fulfillments
CREATE POLICY "Authenticated users can read fulfillments"
  ON mail_document_fulfillment FOR SELECT
  USING (auth.role() = 'authenticated');

-- Seed common document templates
INSERT INTO mail_document_templates (name, document_type, category, description, template_content, placeholder_hints, sentiment, confidence_min, enabled) VALUES
(
  'Statuten BV Response',
  'statuten',
  'document_request',
  'Standard response for requesting company statuten (bylaws)',
  'Dank u voor uw aanvraag. Hierbij stuur ik u de statuten van {{company}}.

De statuten zijn opgesteld conform de huidige wetgeving en bevatten:
- Bestuurregeling
- Vergaderingsregels
- Financiële bepalingen
- Wijzigingsprocedures

Mocht u aanvullende informatie nodig hebben, kunt u mij gerust contacteren.

Met vriendelijke groeten',
  '{"company": "Name of the company", "additional_info": "Any additional context about the request"}',
  'professional',
  0.75,
  true
),
(
  'Contract Template Response',
  'contract',
  'document_request',
  'Response for standard contract template requests',
  'Bedankt voor uw verzoek. Ik stuur u hierbij het door ons gehanteerde contractmodel.

Dit contract bevat standaardvoorwaarden voor {{contract_type}}.

Belangrijk:
- Dit is een modelcontract
- Aanpassingen kunnen nodig zijn voor uw specifieke situatie
- Advies van een jurist wordt aanbevolen

Kunt u mij laten weten of dit voor uw doeleinde geschikt is?

Met vriendelijke groeten',
  '{"contract_type": "Type of contract (e.g., service, supply, partnership)"}',
  'professional',
  0.70,
  true
),
(
  'Invoice Template Response',
  'invoice',
  'billing',
  'Acknowledgment of invoice with standard terms',
  'Dank u voor uw factuur. Deze hebben wij in ons systeem opgenomen.

Factuurgegevens:
- Factuurnummer: {{invoice_number}}
- Bedrag: {{amount}}
- Vervaldatum: {{due_date}}

Betaling zal worden verricht conform onze betalingsvoorwaarden.

Mocht u vragen hebben, kontakt mij dan gerust.

Met vriendelijke groeten',
  '{"invoice_number": "The invoice number", "amount": "Invoice amount", "due_date": "Payment due date"}',
  'professional',
  0.80,
  true
),
(
  'Offerte Request Response',
  'offerte',
  'supplier_communication',
  'Response to quote/estimate requests',
  'Hartelijk dank voor uw aanvraag voor {{product_service}}.

Graag zouden wij nader met u spreken over uw wensen en behoeften om u een passend voorstel te kunnen doen.

Kunt u mij informatie verstrekken over:
- Gewenste omvang van {{product_service}}
- Uiterste opleverdatum
- Budget indicatie
- Bijzondere eisen of voorkeur

Ik neem graag contact met u op om details door te spreken.

Met vriendelijke groeten',
  '{"product_service": "Type of product or service requested"}',
  'professional',
  0.65,
  true
);

-- Add trigger to auto-update updated_at on mail_document_templates
CREATE OR REPLACE FUNCTION update_mail_document_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mail_document_templates_updated_at_trigger
BEFORE UPDATE ON mail_document_templates
FOR EACH ROW
EXECUTE FUNCTION update_mail_document_templates_updated_at();
