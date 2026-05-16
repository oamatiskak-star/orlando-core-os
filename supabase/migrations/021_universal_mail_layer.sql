-- Universal Mail Layer: extends mail_accounts + mail_drafts for multi-provider support

ALTER TABLE mail_accounts
  ADD COLUMN IF NOT EXISTS smtp_host         TEXT,
  ADD COLUMN IF NOT EXISTS smtp_port         INTEGER DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_user         TEXT,
  ADD COLUMN IF NOT EXISTS smtp_pass_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS graph_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS graph_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS graph_tenant_id     TEXT,
  ADD COLUMN IF NOT EXISTS mailtrap_inbox_id   TEXT,
  ADD COLUMN IF NOT EXISTS send_via_mailtrap   BOOLEAN DEFAULT true;

-- Extend provider enum to include all providers
ALTER TABLE mail_accounts
  DROP CONSTRAINT IF EXISTS mail_accounts_provider_check;

ALTER TABLE mail_accounts
  ADD CONSTRAINT mail_accounts_provider_check
  CHECK (provider IN ('gmail', 'icloud', 'outlook', 'imap', 'custom'));

ALTER TABLE mail_drafts
  ADD COLUMN IF NOT EXISTS mailtrap_sandbox_id   TEXT,
  ADD COLUMN IF NOT EXISTS sandbox_tested_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sandbox_preview_url    TEXT,
  ADD COLUMN IF NOT EXISTS send_via               TEXT DEFAULT 'mailtrap_live',
  ADD COLUMN IF NOT EXISTS from_email             TEXT,
  ADD COLUMN IF NOT EXISTS from_name              TEXT;

-- Universal mail queue (provider-agnostic)
CREATE TABLE IF NOT EXISTS mail_send_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id        UUID REFERENCES mail_drafts(id) ON DELETE CASCADE,
  account_id      UUID REFERENCES mail_accounts(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sandbox', 'approved', 'sending', 'sent', 'failed')),
  provider        TEXT NOT NULL DEFAULT 'mailtrap_live',
  attempts        INTEGER DEFAULT 0,
  last_error      TEXT,
  scheduled_at    TIMESTAMPTZ DEFAULT now(),
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mail_send_queue_status   ON mail_send_queue(status);
CREATE INDEX IF NOT EXISTS idx_mail_send_queue_draft    ON mail_send_queue(draft_id);

-- Add imap_uid for dedup on IMAP messages
ALTER TABLE mail_messages
  ADD COLUMN IF NOT EXISTS imap_uid        INTEGER,
  ADD COLUMN IF NOT EXISTS imap_folder     TEXT DEFAULT 'INBOX',
  ADD COLUMN IF NOT EXISTS provider        TEXT DEFAULT 'gmail';

CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_messages_imap_uid
  ON mail_messages(account_id, imap_uid, imap_folder)
  WHERE imap_uid IS NOT NULL;
