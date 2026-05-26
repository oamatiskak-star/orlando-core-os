-- ─────────────────────────────────────────────────────────────────────────
-- Migration 094 — Routines incident Telegram relay (event-driven)
-- ─────────────────────────────────────────────────────────────────────────
-- pg_trigger op executive_alerts (target_kind='routine' + severity in
-- ('critical','high')) → pg_net.http_post naar Vercel API endpoint
-- /api/routines/incident-relay → endpoint stuurt Telegram met triage.
--
-- Token + URL staan in routines_incident_config tabel (single row, beheerd
-- via SQL door Orlando). pg_net response history is queryable via
-- net._http_response.

-- ── 1. routines_incident_config ──────────────────────────────────────────
create table if not exists public.routines_incident_config (
  id           int primary key default 1,
  relay_url    text,
  relay_token  text,
  enabled      boolean not null default false,
  updated_at   timestamptz not null default now(),
  constraint routines_incident_config_singleton check (id = 1)
);

insert into public.routines_incident_config (id, enabled)
values (1, false)
on conflict (id) do nothing;

alter table public.routines_incident_config enable row level security;
drop policy if exists routines_incident_config_service on public.routines_incident_config;
create policy routines_incident_config_service on public.routines_incident_config
  for all to service_role using (true) with check (true);

-- ── 2. routines_dispatch_incident_alert ─────────────────────────────────
-- Wordt gecalld door de AFTER INSERT trigger. Leest config, bouwt payload
-- en fired pg_net.http_post async. Geen blocking.
create or replace function public.routines_dispatch_incident_alert(p_alert_id uuid)
returns void language plpgsql security definer as $fn$
declare
  v_cfg     public.routines_incident_config%rowtype;
  v_alert   public.executive_alerts%rowtype;
  v_routine record;
  v_payload jsonb;
begin
  select * into v_cfg from public.routines_incident_config where id = 1;
  if not coalesce(v_cfg.enabled, false) or v_cfg.relay_url is null then
    return;
  end if;

  select * into v_alert from public.executive_alerts where id = p_alert_id;
  if v_alert.id is null then return; end if;

  if v_alert.target_id is not null then
    select r.id, r.name, r.slug, r.kind, r.status
    into v_routine
    from public.routines r where r.id = v_alert.target_id;
  end if;

  v_payload := jsonb_build_object(
    'alert', jsonb_build_object(
      'id',          v_alert.id,
      'alert_kind',  v_alert.alert_kind,
      'severity',    v_alert.severity,
      'title',       v_alert.title,
      'message',     v_alert.message,
      'payload',     v_alert.payload,
      'detected_at', v_alert.detected_at
    ),
    'routine', case when v_routine.id is null then null else
      jsonb_build_object(
        'id',     v_routine.id,
        'name',   v_routine.name,
        'slug',   v_routine.slug,
        'kind',   v_routine.kind,
        'status', v_routine.status
      )
    end,
    'context', jsonb_build_object(
      'failed_runs_1h', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'run_id',     rr.id,
          'routine_id', rr.routine_id,
          'started_at', rr.started_at,
          'error',      rr.error
        )), '[]'::jsonb)
        from public.routine_runs rr
        where rr.status = 'failed' and rr.ended_at > now() - interval '1 hour'
        limit 10
      ),
      'open_watchdog_incidents', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'service_id',   service_id,
          'service_name', service_name,
          'failure_kind', failure_kind,
          'opened_at',    opened_at
        )), '[]'::jsonb)
        from public.infra_watchdog_incidents
        where status = 'open' limit 10
      )
    )
  );

  perform net.http_post(
    url     := v_cfg.relay_url,
    body    := v_payload,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'X-Routines-Token', coalesce(v_cfg.relay_token, '')
    ),
    timeout_milliseconds := 5000
  );

  insert into public.routine_audit_log (action, actor, detail)
  values ('incident.relay_dispatched', 'system', jsonb_build_object(
    'alert_id',   p_alert_id,
    'severity',   v_alert.severity,
    'target_id',  v_alert.target_id
  ));
end$fn$;

-- ── 3. trigger op executive_alerts ───────────────────────────────────────
create or replace function public.trg_routines_incident_relay()
returns trigger language plpgsql as $fn$
begin
  if new.target_kind = 'routine' and new.severity in ('critical', 'high') then
    perform public.routines_dispatch_incident_alert(new.id);
  end if;
  return new;
end$fn$;

drop trigger if exists trg_routines_incident_relay on public.executive_alerts;
create trigger trg_routines_incident_relay
  after insert on public.executive_alerts
  for each row execute function public.trg_routines_incident_relay();
