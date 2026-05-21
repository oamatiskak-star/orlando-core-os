-- Add template tracking to mail_drafts
ALTER TABLE mail_drafts
ADD COLUMN IF NOT EXISTS suggested_template_id uuid REFERENCES mail_templates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS from_email text;

CREATE INDEX IF NOT EXISTS mail_drafts_template_idx ON mail_drafts(suggested_template_id);
