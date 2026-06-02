-- 138_director_cycles.sql
-- Hermes Directeur-lus Fase 0 (alleen media/MODIWE): gesloten dagcyclus
--   status lezen (SQL) → beslissen (edge function 'director-cycle', Claude) → taken dispatchen
--   (orchestrator_tasks, executor='director') → workers voeren uit → 's avonds verifiëren → rapport.
-- Guardrail (bijna-vol): reversibele media-taken autonoom; onomkeerbaar/duur → hermes_emit_action_prompt (Telegram).
-- pg_cron-jobs starten INACTIEF (active=false) — eerst handmatig getest met ?force=1.

create table if not exists public.director_cycles (
  id                     uuid primary key default gen_random_uuid(),
  cycle_date             date not null default current_date,
  phase                  text not null check (phase in ('plan','verify')),
  scope                  text not null default 'media',
  triggered_by           text default 'cron',
  status_snapshot        jsonb,
  summary                text,
  critical_alerts        jsonb default '[]'::jsonb,
  blockers               jsonb default '[]'::jsonb,
  execution_plan         jsonb default '[]'::jsonb,
  orlando_personal_tasks jsonb default '[]'::jsonb,
  autonomous_dispatched  int default 0,
  approval_queued        int default 0,
  dispatched_task_ids    uuid[] default '{}',
  verify_result          jsonb,
  llm_status             text,
  created_at             timestamptz not null default now()
);
create index if not exists idx_director_cycles_date on public.director_cycles(cycle_date desc, phase);
grant select on public.director_cycles to anon, authenticated;
grant all on public.director_cycles to service_role;

-- ── Read-laag: media-statussnapshot als één jsonb (hergebruikt de KPI-selects van hermes_director_update) ──
create or replace function public.director_media_snapshot()
returns jsonb language sql stable security definer set search_path=public,hermes as $$
  select jsonb_build_object(
    'date', current_date,
    'uploads', coalesce((select jsonb_object_agg(status, n) from (select status, count(*) n from public.youtube_upload_queue group by status) s),'{}'::jsonb),
    'uploads_queued_per_channel', coalesce((select jsonb_agg(jsonb_build_object('channel',coalesce(c.naam,'?'),'n',q.n))
        from (select channel_id, count(*) n from public.youtube_upload_queue where status='queued' group by channel_id order by count(*) desc limit 6) q
        left join public.youtube_channels c on c.id=q.channel_id),'[]'::jsonb),
    'oauth', (select jsonb_build_object('gezond',count(*) filter (where echte_status='gezond'),'totaal',count(*)) from public.v_ctl_oauth_health),
    'alerts', (select jsonb_build_object('open',count(*) filter (where status='open'),'critical',count(*) filter (where status='open' and severity='critical')) from public.hermes_alerts),
    'open_action_prompts', (select count(*) from hermes.action_prompts where status='open'),
    'channels', coalesce((select jsonb_agg(jsonb_build_object('name',name,'niche',niche,'status',current_status)) from public.media_holding_channels where status='live'),'[]'::jsonb),
    'content_radar_open', (select count(*) from public.content_radar_queue where status='idea'),
    'calendar_planned', (select count(*) from public.yt_content_calendar where status='planned'),
    'last_content_at', (select max(created_at) from public.yt_content_calendar),
    'last_media_item_at', (select max(created_at) from public.media_holding_content_items)
  );
$$;
grant execute on function public.director_media_snapshot() to service_role, authenticated, anon;

-- ── Auth-sleutel voor de cron→edge-call (uit DB gelezen door de function; nooit hardcoded) ──
insert into public.hermes_config(key,value)
values ('director_cron_key', gen_random_uuid()::text)
on conflict (key) do nothing;

-- ── Engine Planner: directeur-engines in bestaande blokken (anders fail-open) ──
insert into public.engine_schedule(engine_key,grp,label,block_key,enabled) values
  ('media:director-plan','media','Directeur — ochtendplan','youtube',true),
  ('media:director-verify','media','Directeur — avondverificatie','content',true)
on conflict (engine_key) do update set block_key=excluded.block_key, label=excluded.label, enabled=true;

-- ── pg_cron — PAS SCHEDULEN NA HANDMATIGE TEST (apart, niet in deze migratie) ──
-- Activeren met (06:05 plan, 21:05 verify; edge function gate't zelf op engine_window_open):
--   select cron.schedule('director_plan','5 6 * * *', $cron$
--     select net.http_post(url:='https://shaunumewswpxhmgbtvv.supabase.co/functions/v1/director-cycle?phase=plan',
--       headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',(select value from public.hermes_config where key='director_cron_key'))) $cron$);
--   select cron.schedule('director_verify','5 21 * * *', $cron$
--     select net.http_post(url:='https://shaunumewswpxhmgbtvv.supabase.co/functions/v1/director-cycle?phase=verify',
--       headers:=jsonb_build_object('Content-Type','application/json','x-cron-key',(select value from public.hermes_config where key='director_cron_key'))) $cron$);
