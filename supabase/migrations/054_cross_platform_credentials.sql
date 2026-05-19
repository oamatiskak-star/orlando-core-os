-- 054_cross_platform_credentials.sql
-- Phase 9 — Cross-Platform Distribution
--
-- Per channel × platform combinatie een credentials-bundle:
--   - OAuth client (client_id, client_secret, redirect_uri)
--   - User-side tokens (refresh_token, access_token, expires_at)
--
-- Aparte tabel ipv jsonb op channels zodat:
--   - rotaties eenvoudiger zijn (per platform, niet hele jsonb herschrijven)
--   - de status van OAuth flow ('configured' / 'oauth_pending' / 'connected')
--     duidelijk gemodelleerd is
--   - per platform separate indexen mogelijk zijn

create table if not exists public.platform_credentials (
  id                  uuid primary key default gen_random_uuid(),
  channel_id          uuid not null references public.media_holding_channels(id) on delete cascade,
  platform            text not null check (platform in ('youtube','tiktok','instagram','facebook','snapchat')),
  -- OAuth client (per app/per channel)
  client_id           text,
  client_secret       text,   -- Plaintext voor MVP. TODO: encrypt via Supabase Vault
  redirect_uri        text,
  scopes              text[] not null default '{}',
  -- Tokens (na succesvolle OAuth flow)
  refresh_token       text,
  access_token        text,
  expires_at          timestamptz,
  -- State
  status              text not null default 'not_configured'
                         check (status in ('not_configured','configured','oauth_pending','connected','error','expired')),
  oauth_state         text,
  last_error          text,
  external_account_id text,
  external_account_name text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (channel_id, platform)
);

create index if not exists idx_platform_credentials_channel on platform_credentials(channel_id);
create index if not exists idx_platform_credentials_status  on platform_credentials(status);
create index if not exists idx_platform_credentials_oauth_state on platform_credentials(oauth_state) where oauth_state is not null;

-- Executor enum uitbreiden met 'atlas_upload'
alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in ('claude-code','anthropic','shell','viral_scanner','content_factory','gravity_detector','atlas_upload'));

-- Trigger om media_holding_workers status bij te werken wanneer een platform
-- 'connected' wordt
create or replace function public.refresh_atlas_worker_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_any_connected boolean;
begin
  select exists (
    select 1 from public.platform_credentials
     where platform = 'youtube' and status = 'connected'
  ) into v_any_connected;

  update public.media_holding_workers
     set status = case when v_any_connected then 'idle' else 'offline' end,
         last_seen = now()
   where name = 'upload-engine-youtube';

  return new;
end
$f$;

drop trigger if exists trg_refresh_atlas_status on public.platform_credentials;
create trigger trg_refresh_atlas_status
  after insert or update of status on public.platform_credentials
  for each row execute function public.refresh_atlas_worker_status();
