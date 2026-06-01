-- 112_social_connections.sql
-- Additieve OAuth/koppeling-laag voor bedrijfs-social-pagina's (Aquier e.a.).
-- LET OP: aparte tabel, géén ALTER op gevulde prod-tabellen → laag risico.
-- Secrets (client_secret / access_token / refresh_token) worden uitsluitend via
-- de service-role (admin) client gelezen/geschreven; RLS staat AAN zonder
-- permissieve policy, zodat de anon/authenticated key er niet bij kan.

create table if not exists public.social_connections (
  id                    uuid primary key default gen_random_uuid(),
  platform              text not null,            -- linkedin | facebook | instagram | tiktok | x | youtube
  company               text not null default 'modiwe-software',
  account_label         text not null default 'Aquier',   -- welk merk/pagina
  external_account_id   text,                     -- LinkedIn org URN / FB page id
  external_account_name text,
  profile_url           text,                     -- link naar de live pagina
  -- OAuth app
  client_id             text,
  client_secret         text,
  redirect_uri          text,
  scopes                text[]      default '{}',
  -- OAuth tokens
  access_token          text,
  refresh_token         text,
  expires_at            timestamptz,
  oauth_state           text,
  -- status
  status                text not null default 'disconnected',  -- disconnected | configured | connected | error
  last_error            text,
  last_synced_at        timestamptz,
  meta                  jsonb       not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (platform, company, account_label)
);

create index if not exists social_connections_company_idx on public.social_connections (company);
create index if not exists social_connections_platform_idx on public.social_connections (platform);

alter table public.social_connections enable row level security;
-- Bewust geen policy: alleen service-role (admin client) heeft toegang.

comment on table public.social_connections is
  'OAuth-koppelingen voor bedrijfs-social-pagina''s (LinkedIn/Facebook/etc). Service-role only.';

-- Seed de twee koppelingen die Orlando wil inrichten (status disconnected, nog geen tokens).
insert into public.social_connections (platform, company, account_label, status)
values
  ('linkedin', 'modiwe-software', 'Aquier', 'disconnected'),
  ('facebook', 'modiwe-software', 'Aquier', 'disconnected')
on conflict (platform, company, account_label) do nothing;
