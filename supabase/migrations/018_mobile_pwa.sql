-- Migration 018: Mobile PWA — push_subscriptions + mobile_notifications
-- Voegt twee nieuwe tabellen toe. Raakt bestaande tabellen niet aan.

-- ── push_subscriptions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL UNIQUE,
  p256dh       text        NOT NULL,
  auth         text        NOT NULL,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subs_user_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'push_subscriptions' AND policyname = 'own_push_subs'
  ) THEN
    CREATE POLICY own_push_subs ON public.push_subscriptions
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ── mobile_notifications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mobile_notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT 'info',
  title       text        NOT NULL,
  body        text        NOT NULL DEFAULT '',
  metadata    jsonb       NOT NULL DEFAULT '{}',
  read        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notif_user_read_idx ON public.mobile_notifications (user_id, read);
CREATE INDEX IF NOT EXISTS notif_created_idx   ON public.mobile_notifications (created_at DESC);

ALTER TABLE public.mobile_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'mobile_notifications' AND policyname = 'own_notifications'
  ) THEN
    CREATE POLICY own_notifications ON public.mobile_notifications
      USING (auth.uid() = user_id OR user_id IS NULL)
      WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
  END IF;
END $$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mobile_notifications;
