-- ============================================================================
-- Migration 107: Hermes Telegram Escalation Bridge
-- ============================================================================
-- Depends on: 104 (hermes schema), 106 (escalations + whatsapp layer)
-- Doel: Telegram als gratis, verificatie-vrij alternatief voor de Meta WhatsApp
--       Cloud API. Volledig additief — raakt de bestaande WhatsApp-tabellen en
--       hermes.is_within_quiet_hours NIET aan. De whatsapp-bridge blijft werken;
--       welk kanaal actief is, bepaalt de service via HERMES_ESCALATION_CHANNEL.
--
-- De escalatie-tabel (hermes.escalations) is kanaal-agnostisch en wordt
-- hergebruikt. Het uitgaande provider-message-id wordt opgeslagen in de
-- bestaande kolom whatsapp_message_id (voor Telegram = message_id als text).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TELEGRAM_RECIPIENTS (allowlist, timezone-aware) — spiegel van whatsapp_recipients
-- ----------------------------------------------------------------------------
create table if not exists hermes.telegram_recipients (
  id                  uuid primary key default gen_random_uuid(),
  chat_id             text unique not null,             -- Telegram chat id (getal als text)
  display_name        text not null,
  timezone            text not null default 'Europe/Amsterdam',
  receive_severities  text[] not null default array['critical','high'],
  quiet_hours_start   time not null default '23:00',
  quiet_hours_end     time not null default '07:00',
  active              boolean not null default false,   -- default OFF (zelfde policy als WhatsApp)
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists hermes_telegram_recipients_active_idx
  on hermes.telegram_recipients (active) where active;

-- Quiet-hours check voor Telegram-recipients (kan hermes.is_within_quiet_hours
-- niet hergebruiken: die leest whatsapp_recipients). search_path leeg + volledig
-- gekwalificeerd om de function_search_path_mutable lint te vermijden.
create or replace function hermes.is_within_quiet_hours_tg(p_recipient_id uuid, p_at timestamptz)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  r record;
  local_time time;
begin
  select * into r from hermes.telegram_recipients where id = p_recipient_id;
  if not found then return false; end if;
  local_time := (coalesce(p_at, now()) at time zone r.timezone)::time;
  if r.quiet_hours_start < r.quiet_hours_end then
    return local_time >= r.quiet_hours_start and local_time < r.quiet_hours_end;
  else
    return local_time >= r.quiet_hours_start or local_time < r.quiet_hours_end;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. TELEGRAM_INBOX (ruwe webhook updates, idempotency) — spiegel van whatsapp_inbox
-- ----------------------------------------------------------------------------
create table if not exists hermes.telegram_inbox (
  id                      uuid primary key default gen_random_uuid(),
  update_id               bigint unique not null,        -- Telegram update_id (idempotency)
  from_chat_id            text not null,
  message_type            text,                          -- 'callback_query' | 'message'
  body                    jsonb not null,
  matched_escalation_id   uuid references hermes.escalations(id) on delete set null,
  processed_at            timestamptz,
  processing_error        text,
  created_at              timestamptz not null default now()
);

create index if not exists hermes_telegram_inbox_unprocessed_idx
  on hermes.telegram_inbox (created_at) where processed_at is null;
create index if not exists hermes_telegram_inbox_from_chat_idx
  on hermes.telegram_inbox (from_chat_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 3. RLS — zelfde patroon als migratie 106 (service_role full + authenticated read)
-- ----------------------------------------------------------------------------
alter table hermes.telegram_recipients enable row level security;
alter table hermes.telegram_inbox      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['telegram_recipients','telegram_inbox'] loop
    if not exists (
      select 1 from pg_policies
      where schemaname='hermes' and tablename=t and policyname='service_role_full'
    ) then
      execute format($p$
        create policy "service_role_full" on hermes.%I
        as permissive for all to service_role using (true) with check (true);
      $p$, t);
    end if;
  end loop;

  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='telegram_recipients' and policyname='auth_read_tg_recipients') then
    create policy "auth_read_tg_recipients" on hermes.telegram_recipients
      for select to authenticated using (true);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Trigger
-- ----------------------------------------------------------------------------
drop trigger if exists trg_telegram_recipients_touch on hermes.telegram_recipients;
create trigger trg_telegram_recipients_touch
  before update on hermes.telegram_recipients
  for each row execute function hermes.touch_updated_at();

-- ----------------------------------------------------------------------------
-- 5. GRANTs (service_role moet de nieuwe objecten kunnen gebruiken)
-- ----------------------------------------------------------------------------
grant usage on schema hermes to service_role;
grant all on hermes.telegram_recipients to service_role;
grant all on hermes.telegram_inbox to service_role;
grant select on hermes.telegram_recipients to authenticated;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- drop trigger if exists trg_telegram_recipients_touch on hermes.telegram_recipients;
-- drop function if exists hermes.is_within_quiet_hours_tg(uuid, timestamptz);
-- drop table if exists hermes.telegram_inbox;
-- drop table if exists hermes.telegram_recipients;
