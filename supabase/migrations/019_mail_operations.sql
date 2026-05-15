-- Migration 019: Mail Operations Layer
-- Alle mail-gerelateerde tabellen voor Orlando Core OS

-- ── mail_accounts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_accounts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider              text        NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail','imap')),
  email                 text        NOT NULL,
  display_name          text,
  gmail_access_token    text,
  gmail_refresh_token   text,
  gmail_token_expiry    timestamptz,
  imap_host             text,
  imap_port             int,
  imap_user             text,
  imap_pass_encrypted   text,
  last_sync_at          timestamptz,
  sync_status           text        NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle','syncing','error')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_accounts_user_idx ON public.mail_accounts (user_id);
CREATE INDEX IF NOT EXISTS mail_accounts_email_idx ON public.mail_accounts (email);

ALTER TABLE public.mail_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_accounts' AND policyname = 'own_mail_accounts'
  ) THEN
    CREATE POLICY own_mail_accounts ON public.mail_accounts
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── mail_messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_messages (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              uuid        NOT NULL REFERENCES public.mail_accounts(id) ON DELETE CASCADE,
  gmail_message_id        text        UNIQUE,
  gmail_thread_id         text,
  subject                 text,
  from_email              text,
  from_name               text,
  to_emails               text[]      NOT NULL DEFAULT '{}',
  cc_emails               text[]      NOT NULL DEFAULT '{}',
  body_text               text,
  body_html               text,
  received_at             timestamptz,
  is_read                 boolean     NOT NULL DEFAULT false,
  is_starred              boolean     NOT NULL DEFAULT false,
  is_archived             boolean     NOT NULL DEFAULT false,
  company                 text        CHECK (company IN ('STRKBEHEER','STRKBOUW','BOUWPROFFS','PRIVÉ','YOUTUBE')),
  category                text        CHECK (category IN ('leverancier','klant','incasso','factuur','belasting','advocaat','privé','vastgoed','support','automatisering','spam')),
  priority                text        NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low','spam')),
  ai_summary              text,
  ai_action_suggestion    text,
  ai_confidence           float       NOT NULL DEFAULT 0,
  spam_score              float       NOT NULL DEFAULT 0,
  threat_detected         boolean     NOT NULL DEFAULT false,
  threat_reason           text,
  moneybird_status        text        NOT NULL DEFAULT 'n_a' CHECK (moneybird_status IN ('pending','uploaded','matched','error','n_a')),
  moneybird_document_id   text,
  processed_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_messages_account_idx    ON public.mail_messages (account_id);
CREATE INDEX IF NOT EXISTS mail_messages_received_idx   ON public.mail_messages (received_at DESC);
CREATE INDEX IF NOT EXISTS mail_messages_priority_idx   ON public.mail_messages (priority);
CREATE INDEX IF NOT EXISTS mail_messages_is_read_idx    ON public.mail_messages (is_read);
CREATE INDEX IF NOT EXISTS mail_messages_company_idx    ON public.mail_messages (company);
CREATE INDEX IF NOT EXISTS mail_messages_category_idx   ON public.mail_messages (category);
CREATE INDEX IF NOT EXISTS mail_messages_moneybird_idx  ON public.mail_messages (moneybird_status);
CREATE INDEX IF NOT EXISTS mail_messages_thread_idx     ON public.mail_messages (gmail_thread_id);

ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_messages' AND policyname = 'own_mail_messages'
  ) THEN
    CREATE POLICY own_mail_messages ON public.mail_messages
      USING (
        account_id IN (
          SELECT id FROM public.mail_accounts WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        account_id IN (
          SELECT id FROM public.mail_accounts WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── mail_labels ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_labels (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL UNIQUE,
  parent_label text,
  color        text,
  icon         text,
  auto_rule    jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_labels_parent_idx ON public.mail_labels (parent_label);

ALTER TABLE public.mail_labels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_labels' AND policyname = 'all_can_read_labels'
  ) THEN
    CREATE POLICY all_can_read_labels ON public.mail_labels
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_labels' AND policyname = 'auth_can_write_labels'
  ) THEN
    CREATE POLICY auth_can_write_labels ON public.mail_labels
      FOR ALL USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── mail_message_labels ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_message_labels (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  label_id   uuid NOT NULL REFERENCES public.mail_labels(id)   ON DELETE CASCADE,
  UNIQUE (message_id, label_id)
);

CREATE INDEX IF NOT EXISTS mail_msg_labels_message_idx ON public.mail_message_labels (message_id);
CREATE INDEX IF NOT EXISTS mail_msg_labels_label_idx   ON public.mail_message_labels (label_id);

ALTER TABLE public.mail_message_labels ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_message_labels' AND policyname = 'own_mail_message_labels'
  ) THEN
    CREATE POLICY own_mail_message_labels ON public.mail_message_labels
      USING (
        message_id IN (
          SELECT m.id FROM public.mail_messages m
          JOIN public.mail_accounts a ON a.id = m.account_id
          WHERE a.user_id = auth.uid()
        )
      )
      WITH CHECK (
        message_id IN (
          SELECT m.id FROM public.mail_messages m
          JOIN public.mail_accounts a ON a.id = m.account_id
          WHERE a.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── mail_contacts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_contacts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 text        NOT NULL UNIQUE,
  name                  text,
  company               text,
  contact_type          text        CHECK (contact_type IN ('klant','leverancier','investeerder','advocaat','belastingdienst','bank','privé','spam')),
  priority              text        NOT NULL DEFAULT 'normal' CHECK (priority IN ('urgent','high','normal','low','block')),
  total_interactions    int         NOT NULL DEFAULT 0,
  last_interaction_at   timestamptz,
  payment_status        text,
  open_actions          int         NOT NULL DEFAULT 0,
  sentiment             text        CHECK (sentiment IN ('positive','neutral','negative')),
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_contacts_email_idx    ON public.mail_contacts (email);
CREATE INDEX IF NOT EXISTS mail_contacts_priority_idx ON public.mail_contacts (priority);
CREATE INDEX IF NOT EXISTS mail_contacts_type_idx     ON public.mail_contacts (contact_type);

ALTER TABLE public.mail_contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_contacts' AND policyname = 'auth_mail_contacts'
  ) THEN
    CREATE POLICY auth_mail_contacts ON public.mail_contacts
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── mail_contact_interactions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_contact_interactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid        NOT NULL REFERENCES public.mail_contacts(id) ON DELETE CASCADE,
  message_id uuid        NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  direction  text        NOT NULL CHECK (direction IN ('inbound','outbound')),
  summary    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_interactions_contact_idx ON public.mail_contact_interactions (contact_id);
CREATE INDEX IF NOT EXISTS mail_interactions_message_idx ON public.mail_contact_interactions (message_id);
CREATE INDEX IF NOT EXISTS mail_interactions_created_idx ON public.mail_contact_interactions (created_at DESC);

ALTER TABLE public.mail_contact_interactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_contact_interactions' AND policyname = 'auth_mail_interactions'
  ) THEN
    CREATE POLICY auth_mail_interactions ON public.mail_contact_interactions
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── mail_drafts ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_drafts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid        REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  to_email      text,
  subject       text,
  body          text,
  attachments   jsonb       NOT NULL DEFAULT '[]',
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','sent','modified')),
  ai_reasoning  text,
  ai_confidence float       NOT NULL DEFAULT 0,
  version       int         NOT NULL DEFAULT 1,
  approved_at   timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_drafts_message_idx ON public.mail_drafts (message_id);
CREATE INDEX IF NOT EXISTS mail_drafts_status_idx  ON public.mail_drafts (status);
CREATE INDEX IF NOT EXISTS mail_drafts_created_idx ON public.mail_drafts (created_at DESC);

ALTER TABLE public.mail_drafts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_drafts' AND policyname = 'own_mail_drafts'
  ) THEN
    CREATE POLICY own_mail_drafts ON public.mail_drafts
      USING (
        message_id IS NULL OR message_id IN (
          SELECT m.id FROM public.mail_messages m
          JOIN public.mail_accounts a ON a.id = m.account_id
          WHERE a.user_id = auth.uid()
        )
      )
      WITH CHECK (
        message_id IS NULL OR message_id IN (
          SELECT m.id FROM public.mail_messages m
          JOIN public.mail_accounts a ON a.id = m.account_id
          WHERE a.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── mail_attachments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_attachments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        uuid        NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  filename          text,
  mime_type         text,
  size_bytes        int,
  storage_path      text,
  document_type     text        CHECK (document_type IN ('offerte','factuur','contract','bouwtekening','overig')),
  ai_extracted_data jsonb       NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_attachments_message_idx ON public.mail_attachments (message_id);
CREATE INDEX IF NOT EXISTS mail_attachments_doctype_idx ON public.mail_attachments (document_type);

ALTER TABLE public.mail_attachments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_attachments' AND policyname = 'own_mail_attachments'
  ) THEN
    CREATE POLICY own_mail_attachments ON public.mail_attachments
      USING (
        message_id IN (
          SELECT m.id FROM public.mail_messages m
          JOIN public.mail_accounts a ON a.id = m.account_id
          WHERE a.user_id = auth.uid()
        )
      )
      WITH CHECK (
        message_id IN (
          SELECT m.id FROM public.mail_messages m
          JOIN public.mail_accounts a ON a.id = m.account_id
          WHERE a.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── mail_audit_log ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid,
  action        text        NOT NULL,
  actor         text        NOT NULL CHECK (actor IN ('ai','user')),
  detail        jsonb       NOT NULL DEFAULT '{}',
  ai_confidence float       NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_audit_message_idx ON public.mail_audit_log (message_id);
CREATE INDEX IF NOT EXISTS mail_audit_created_idx ON public.mail_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS mail_audit_action_idx  ON public.mail_audit_log (action);

ALTER TABLE public.mail_audit_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_audit_log' AND policyname = 'auth_mail_audit'
  ) THEN
    CREATE POLICY auth_mail_audit ON public.mail_audit_log
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── mail_moneybird_queue ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_moneybird_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id    uuid        REFERENCES public.mail_messages(id),
  attachment_id uuid        REFERENCES public.mail_attachments(id),
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','uploaded','matched','error','skipped')),
  moneybird_id  text,
  error_text    text,
  retry_count   int         NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_mb_queue_status_idx  ON public.mail_moneybird_queue (status);
CREATE INDEX IF NOT EXISTS mail_mb_queue_message_idx ON public.mail_moneybird_queue (message_id);
CREATE INDEX IF NOT EXISTS mail_mb_queue_retry_idx   ON public.mail_moneybird_queue (next_retry_at);

ALTER TABLE public.mail_moneybird_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_moneybird_queue' AND policyname = 'auth_mb_queue'
  ) THEN
    CREATE POLICY auth_mb_queue ON public.mail_moneybird_queue
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── mail_agenda_suggestions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_agenda_suggestions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        uuid        NOT NULL REFERENCES public.mail_messages(id) ON DELETE CASCADE,
  proposed_at       timestamptz,
  duration_minutes  int,
  title             text,
  description       text,
  status            text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  calendar_event_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_agenda_message_idx ON public.mail_agenda_suggestions (message_id);
CREATE INDEX IF NOT EXISTS mail_agenda_status_idx  ON public.mail_agenda_suggestions (status);

ALTER TABLE public.mail_agenda_suggestions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_agenda_suggestions' AND policyname = 'own_agenda_suggestions'
  ) THEN
    CREATE POLICY own_agenda_suggestions ON public.mail_agenda_suggestions
      USING (
        message_id IN (
          SELECT m.id FROM public.mail_messages m
          JOIN public.mail_accounts a ON a.id = m.account_id
          WHERE a.user_id = auth.uid()
        )
      )
      WITH CHECK (
        message_id IN (
          SELECT m.id FROM public.mail_messages m
          JOIN public.mail_accounts a ON a.id = m.account_id
          WHERE a.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- ── mail_retry_queue ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mail_retry_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type     text        NOT NULL,
  payload       jsonb       NOT NULL DEFAULT '{}',
  status        text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','failed')),
  retry_count   int         NOT NULL DEFAULT 0,
  max_retries   int         NOT NULL DEFAULT 5,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  error_text    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mail_retry_status_idx    ON public.mail_retry_queue (status);
CREATE INDEX IF NOT EXISTS mail_retry_next_idx      ON public.mail_retry_queue (next_retry_at);
CREATE INDEX IF NOT EXISTS mail_retry_tasktype_idx  ON public.mail_retry_queue (task_type);

ALTER TABLE public.mail_retry_queue ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mail_retry_queue' AND policyname = 'auth_retry_queue'
  ) THEN
    CREATE POLICY auth_retry_queue ON public.mail_retry_queue
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ── Realtime ──────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.mail_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mail_drafts;
