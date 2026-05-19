-- 064_autopilot.sql
-- Phase 12 — Autonomous Scaling
--
-- Het systeem stuurt zichzelf aan: per detectie van een signaal worden de
-- volgende stappen in de chain automatisch gedispatcht. Per chain-link kan
-- via autopilot_config aan/uit gezet worden + threshold ingesteld.
--
-- Chains:
--   A. viral_opportunity (score>=T) → content_factory  (link_key=viral_to_factory)
--   B. gravity breakout (magnitude>=T) → winner_extractor (link_key=gravity_to_winner)
--   C. gravity breakout (magnitude>=T) → language_expander (link_key=gravity_to_language)
--   D. youtube upload verified_live → atlas_upload fan-out cross-platform (link_key=upload_to_crossplatform)
--
-- Elke automatische dispatch wordt gelogd in autopilot_events.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. autopilot_config
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.autopilot_config (
  id                  uuid primary key default gen_random_uuid(),
  link_key            text not null unique,
  description         text,
  enabled             boolean not null default false,
  threshold           numeric,
  last_triggered_at   timestamptz,
  trigger_count       integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

insert into public.autopilot_config (link_key, description, enabled, threshold)
values
  ('viral_to_factory',         'Auto-dispatch content_factory bij viral_opportunity met virality_score >= threshold', false, 80),
  ('gravity_to_winner',        'Auto-dispatch winner_extractor bij algorithm_gravity_events breakout met magnitude >= threshold', false, 70),
  ('gravity_to_language',      'Auto-dispatch language_expander bij algorithm_gravity_events breakout met magnitude >= threshold', false, 75),
  ('upload_to_crossplatform',  'Auto-fan-out atlas_upload naar TikTok/IG/FB bij YouTube upload verified_live', false, 0)
on conflict (link_key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. autopilot_events
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.autopilot_events (
  id                  uuid primary key default gen_random_uuid(),
  link_key            text not null,
  source_table        text not null,
  source_id           uuid,
  target_executor     text not null,
  task_id             uuid,
  triggered_at        timestamptz not null default now(),
  details             jsonb
);
create index if not exists idx_autopilot_events_link on autopilot_events(link_key, triggered_at desc);
create index if not exists idx_autopilot_events_source on autopilot_events(source_table, source_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. helpers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._autopilot_link_active(p_link_key text, p_value numeric default null)
returns boolean
language plpgsql
stable
as $f$
declare
  cfg record;
begin
  select enabled, threshold into cfg
    from public.autopilot_config
   where link_key = p_link_key;
  if not found then return false; end if;
  if not cfg.enabled then return false; end if;
  if cfg.threshold is null or p_value is null then return true; end if;
  return p_value >= cfg.threshold;
end
$f$;

create or replace function public._autopilot_dispatch(
  p_link_key text,
  p_source_table text,
  p_source_id uuid,
  p_executor text,
  p_title text,
  p_task_type text,
  p_payload jsonb,
  p_objective text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_task_id uuid;
begin
  -- Dedupe op (link_key, source_id) binnen laatste 6 uur
  if exists (
    select 1 from public.autopilot_events
     where link_key = p_link_key
       and source_id = p_source_id
       and triggered_at > now() - interval '6 hours'
  ) then
    return null;
  end if;

  insert into public.orchestrator_tasks (
    company_id, title, task_type, executor, allowed_actions, priority, status, objective, payload
  ) values (
    'modiwerijo',
    p_title,
    p_task_type,
    p_executor,
    array['*'],
    3,  -- iets hogere prio dan handmatige (4)
    'open',
    case when p_objective is null then null else array[p_objective] end,
    p_payload
  )
  returning id into v_task_id;

  insert into public.autopilot_events (link_key, source_table, source_id, target_executor, task_id, details)
  values (p_link_key, p_source_table, p_source_id, p_executor, v_task_id, p_payload);

  update public.autopilot_config
     set last_triggered_at = now(),
         trigger_count = trigger_count + 1,
         updated_at = now()
   where link_key = p_link_key;

  return v_task_id;
end
$f$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger A — viral_opportunity → content_factory
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.autopilot_viral_to_factory()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_brief text;
begin
  if new.virality_score is null then return new; end if;
  if not public._autopilot_link_active('viral_to_factory', new.virality_score) then return new; end if;

  v_brief := format(
    'Auto-generate brief voor viral kans (score=%s). Source: %s. Titel: %s. URL: %s.',
    new.virality_score, new.source_platform, coalesce(new.title, '(geen titel)'), coalesce(new.url, '')
  );

  perform public._autopilot_dispatch(
    'viral_to_factory',
    'viral_opportunities',
    new.id,
    'content_factory',
    format('[autopilot] Forge brief — viral score %s', new.virality_score),
    'autopilot_factory',
    jsonb_build_object(
      'viral_opportunity_id', new.id,
      'brief', v_brief,
      'persona', 'Forge',
      'autopilot_source', 'viral_to_factory'
    ),
    format('Genereer content brief voor viral_opportunity met score %s.', new.virality_score)
  );
  return new;
end
$f$;

drop trigger if exists trg_autopilot_viral_to_factory on public.viral_opportunities;
create trigger trg_autopilot_viral_to_factory
  after insert or update of virality_score on public.viral_opportunities
  for each row execute function public.autopilot_viral_to_factory();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trigger B+C — gravity breakout → winner + language
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.autopilot_gravity_chain()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  if new.event_type <> 'breakout' then return new; end if;
  if new.content_item_id is null then return new; end if;

  -- B. winner_extractor
  if public._autopilot_link_active('gravity_to_winner', new.magnitude) then
    perform public._autopilot_dispatch(
      'gravity_to_winner',
      'algorithm_gravity_events',
      new.id,
      'winner_extractor',
      format('[autopilot] Winner extraction — breakout %.1f', new.magnitude),
      'autopilot_winner',
      jsonb_build_object(
        'source_content_item_id', new.content_item_id,
        'variants_per_kind', 1,
        'persona', 'Forge',
        'autopilot_source', 'gravity_to_winner'
      ),
      'Auto-fan-out 10 variants na breakout-detectie.'
    );
  end if;

  -- C. language_expander
  if public._autopilot_link_active('gravity_to_language', new.magnitude) then
    perform public._autopilot_dispatch(
      'gravity_to_language',
      'algorithm_gravity_events',
      new.id,
      'language_expander',
      format('[autopilot] Language expansion — breakout %.1f', new.magnitude),
      'autopilot_language',
      jsonb_build_object(
        'source_content_item_id', new.content_item_id,
        'target_langs', array['en','es','de','fr','pt','ar'],
        'persona', 'Atlas',
        'autopilot_source', 'gravity_to_language'
      ),
      'Auto-fan-out naar 6 talen na breakout-detectie.'
    );
  end if;

  return new;
end
$f$;

drop trigger if exists trg_autopilot_gravity_chain on public.algorithm_gravity_events;
create trigger trg_autopilot_gravity_chain
  after insert on public.algorithm_gravity_events
  for each row execute function public.autopilot_gravity_chain();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Trigger D — youtube upload verified_live → cross-platform fan-out
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.autopilot_upload_crossplatform()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
declare
  v_platform text;
  v_target_platforms text[] := array['tiktok','instagram','facebook','snapchat'];
begin
  if new.status <> 'verified_live' then return new; end if;
  if old.status = 'verified_live' then return new; end if;
  if new.platform <> 'youtube' then return new; end if;
  if not public._autopilot_link_active('upload_to_crossplatform') then return new; end if;

  foreach v_platform in array v_target_platforms loop
    -- Skip platforms die al een upload hebben voor dit content_item
    if exists (
      select 1 from public.media_holding_uploads
       where content_item_id = new.content_item_id
         and platform = v_platform
    ) then continue; end if;

    perform public._autopilot_dispatch(
      'upload_to_crossplatform',
      'media_holding_uploads',
      new.id,
      'atlas_upload',
      format('[autopilot] Cross-platform upload — %s', v_platform),
      'autopilot_crossplatform',
      jsonb_build_object(
        'content_item_id', new.content_item_id,
        'platform', v_platform,
        'persona', 'Atlas',
        'autopilot_source', 'upload_to_crossplatform'
      ),
      format('Auto-fan-out van YouTube naar %s.', v_platform)
    );
  end loop;
  return new;
end
$f$;

drop trigger if exists trg_autopilot_upload_crossplatform on public.media_holding_uploads;
create trigger trg_autopilot_upload_crossplatform
  after update of status on public.media_holding_uploads
  for each row execute function public.autopilot_upload_crossplatform();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Executor enum: voeg cron_dispatcher toe (voor scheduled scans)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.orchestrator_tasks
  drop constraint if exists orchestrator_tasks_executor_check;

alter table public.orchestrator_tasks
  add constraint orchestrator_tasks_executor_check
  check (executor in (
    'claude-code','anthropic','shell',
    'viral_scanner','content_factory','gravity_detector','atlas_upload','renderer',
    'trend_scanner','retention_lab','winner_extractor','audio_scanner',
    'sponsor_engine','monetization_tracker','language_expander','cron_dispatcher'
  ));
