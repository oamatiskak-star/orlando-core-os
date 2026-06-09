-- ============================================================================
-- Migration 158: Build Tracker — canonieke refresh + 30-min auto-sync
-- ============================================================================
-- Depends on: 104 (hermes schema + touch_updated_at), 110 (hermes.dispatch_queue),
--             092 (engine_schedule), 155 (build_tracker_documents/_items + conflict_check)
-- Doel: handmatige "Refresh Canonieke Tracker"-knop + Hermes 30-min auto-sync,
--       beide read/sync-only (geen build/deploy). De echte parse van BUILD_TRACKER.md
--       draait file-based op CLI-L (local-agent); Vercel kan de checkout niet lezen,
--       dus de refresh ENQUEUET een dispatch-taak en leest direct de DB-staat uit.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SYNC-LOG — audittrail van elke refresh/auto-sync (manual | cron | dispatch)
-- ----------------------------------------------------------------------------
create table if not exists hermes.tracker_sync_log (
  id              uuid primary key default gen_random_uuid(),
  trigger         text not null default 'manual'
                    check (trigger in ('manual','cron','dispatch','planner')),
  document_id     uuid,
  documents_count int  not null default 0,
  items_count     int  not null default 0,
  updated_count   int  not null default 0,
  conflicts_count int  not null default 0,
  status          text not null default 'ok',
  detail          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists hermes_tracker_sync_log_created_idx
  on hermes.tracker_sync_log (created_at desc);

-- ----------------------------------------------------------------------------
-- 2. canonical_refresh_snapshot — read-only telling van de huidige canonieke staat
--    conflicts_count = aantal actieve sectie-D conflict-regels (match_pattern gezet)
-- ----------------------------------------------------------------------------
create or replace function hermes.canonical_refresh_snapshot()
returns table (
  document_id     uuid,
  source_commit   text,
  source_branch   text,
  synced_at       timestamptz,
  documents_count int,
  items_count     int,
  conflicts_count int
)
language sql
stable
security definer
set search_path = ''
as $$
  with doc as (
    select d.id, d.source_commit, d.source_branch, d.synced_at
    from public.build_tracker_documents d
    where d.is_current and d.scope = 'cross-project'
    order by d.synced_at desc
    limit 1
  )
  select
    doc.id,
    doc.source_commit,
    doc.source_branch,
    doc.synced_at,
    (select count(*)::int from public.build_tracker_documents where is_current and scope = 'cross-project'),
    (select count(*)::int from public.build_tracker_items i where i.document_id = doc.id),
    (select count(*)::int from public.build_tracker_items i
       where i.document_id = doc.id and i.section = 'D' and i.match_pattern is not null)
  from doc;
$$;

grant execute on function hermes.canonical_refresh_snapshot() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. dispatch_canonical_sync — enqueue CLI-L re-parse (idempotent) + log
--    Geen build/deploy: draait `npm run sync:tracker` op de host.
--    Idempotent: slaat over als er al een queued tracker-sync klaarstaat.
-- ----------------------------------------------------------------------------
create or replace function hermes.dispatch_canonical_sync(p_trigger text default 'manual')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_snap record;
begin
  select * into v_snap from hermes.canonical_refresh_snapshot();

  -- Idempotent: bestaat er al een wachtende tracker-sync? Dan niet dupliceren.
  select q.id into v_id
  from hermes.dispatch_queue q
  where q.status = 'queued' and q.workstream = 'tracker-sync'
  limit 1;

  if v_id is null then
    insert into hermes.dispatch_queue (title, workstream, repo, target_host, priority, status, payload)
    values (
      'BUILD_TRACKER.md canonieke sync',
      'tracker-sync',
      'orlando-core-os',
      'cli-l',
      4,
      'queued',
      jsonb_build_object(
        'cmd', 'cd ~/Code/orlando-core-os/local-agent && npm run sync:tracker',
        'reason', concat('canonieke refresh (', p_trigger, ')')
      )
    )
    returning id into v_id;
  end if;

  insert into hermes.tracker_sync_log (trigger, document_id, documents_count, items_count, conflicts_count, status, detail)
  values (
    case when p_trigger in ('manual','cron','dispatch','planner') then p_trigger else 'manual' end,
    v_snap.document_id,
    coalesce(v_snap.documents_count, 0),
    coalesce(v_snap.items_count, 0),
    coalesce(v_snap.conflicts_count, 0),
    'dispatched',
    jsonb_build_object('dispatch_id', v_id, 'source_commit', v_snap.source_commit)
  );

  return v_id;
end $$;

grant execute on function hermes.dispatch_canonical_sync(text) to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. RLS — service_role full + authenticated read (patroon mig 110)
-- ----------------------------------------------------------------------------
alter table hermes.tracker_sync_log enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='tracker_sync_log' and policyname='service_role_full') then
    create policy "service_role_full" on hermes.tracker_sync_log as permissive for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='tracker_sync_log' and policyname='auth_read') then
    create policy "auth_read" on hermes.tracker_sync_log for select to authenticated using (true);
  end if;
end $$;

grant usage on schema hermes to authenticated, service_role;
grant all on hermes.tracker_sync_log to service_role;
grant select on hermes.tracker_sync_log to authenticated;

-- ----------------------------------------------------------------------------
-- 5. ENGINE PLANNER — registreer de 30-min sync (project-regel: niets ongepland)
--    Event-driven enqueue → geen exclusief tijdblok (block_key null), zoals
--    'ai:router-orchestrator'.
-- ----------------------------------------------------------------------------
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('hermes:build-tracker-canonical-sync', 'hermes', 'Build Tracker Canonical Sync (30m)', null, true)
on conflict (engine_key) do update set label = excluded.label, updated_at = now();

-- ----------------------------------------------------------------------------
-- 6. pg_cron — elke 30 minuten een sync enqueue (upsert op jobnaam)
-- ----------------------------------------------------------------------------
select cron.schedule(
  'hermes_build_tracker_canonical_sync',
  '*/30 * * * *',
  $cron$select hermes.dispatch_canonical_sync('cron');$cron$
);

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- select cron.unschedule('hermes_build_tracker_canonical_sync');
-- delete from public.engine_schedule where engine_key = 'hermes:build-tracker-canonical-sync';
-- drop function if exists hermes.dispatch_canonical_sync(text);
-- drop function if exists hermes.canonical_refresh_snapshot();
-- drop table if exists hermes.tracker_sync_log;
