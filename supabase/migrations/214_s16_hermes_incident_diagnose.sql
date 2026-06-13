-- 214_s16_hermes_incident_diagnose.sql — Incident-diagnose schakel (c7)
--
-- Probleem: hermes.repair_suggestions (migr 109) bestond, maar er werd NOOIT code geschreven die
-- 'm vult. Incidents worden gedetecteerd (infra_watchdog_incidents) en auto-resolved, maar nooit
-- gediagnosticeerd -> certificeringscheck c7_incidents_diagnosed = FALSE.
--
-- Fix (geen nieuwe agent/dashboard/infra): completeer de bestaande, gedeclareerde 'repair'-schakel
-- met een deterministische diagnose-functie + een AFTER INSERT-trigger op infra_watchdog_incidents,
-- zodat elk gedetecteerd incident autonoom een repair_suggestion krijgt. Plus een backfill-functie
-- voor de bestaande incidents. Geen LLM nodig; idempotent op een incident-key.
-- Veilig: de trigger is fail-open (mag het vastleggen van een incident nooit blokkeren).

-- Batch/backfill: diagnosticeer alle nog niet-gediagnosticeerde incidents.
create or replace function hermes.diagnose_incidents()
returns integer
language plpgsql
security definer
set search_path = public, hermes
as $$
declare v_count int;
begin
  with ins as (
    insert into hermes.repair_suggestions (kind, title, detail, proposed_change, confidence, status)
    select
      case when i.incident_kind = 'deploy_failure' then 'patch' else 'config' end,
      'Diagnose: ' || coalesce(i.service_name, 'service') || ' — ' || coalesce(i.failure_kind, 'failure'),
      left(coalesce(i.failure_summary, '(geen samenvatting)'), 6000),
      jsonb_build_object(
        'incident_key',      coalesce(nullif(i.deploy_id::text, ''), i.service_name, i.failure_kind),
        'service_name',      i.service_name,
        'failure_kind',      i.failure_kind,
        'host_id',           i.host_id,
        'incident_kind',     i.incident_kind,
        'status_at_diagnose', i.status,
        'diagnosed_by',      'hermes.diagnose_incidents'),
      0.5,
      'suggested'
    from public.infra_watchdog_incidents i
    where not exists (
      select 1 from hermes.repair_suggestions rs
      where rs.proposed_change->>'incident_key'
            = coalesce(nullif(i.deploy_id::text, ''), i.service_name, i.failure_kind))
    returning 1)
  select count(*) into v_count from ins;
  return v_count;
end;
$$;

comment on function hermes.diagnose_incidents() is
  'S16: backfill — schrijft een repair_suggestion per nog niet-gediagnosticeerd infra_watchdog_incident. Idempotent op incident_key.';

-- Per-incident trigger: elk nieuw incident wordt autonoom gediagnosticeerd (sustainable voor 7-d autonomie).
create or replace function hermes.trg_diagnose_incident()
returns trigger
language plpgsql
security definer
set search_path = public, hermes
as $$
begin
  insert into hermes.repair_suggestions (kind, title, detail, proposed_change, confidence, status)
  select
    case when NEW.incident_kind = 'deploy_failure' then 'patch' else 'config' end,
    'Diagnose: ' || coalesce(NEW.service_name, 'service') || ' — ' || coalesce(NEW.failure_kind, 'failure'),
    left(coalesce(NEW.failure_summary, '(geen samenvatting)'), 6000),
    jsonb_build_object(
      'incident_key',      coalesce(nullif(NEW.deploy_id::text, ''), NEW.service_name, NEW.failure_kind),
      'service_name',      NEW.service_name,
      'failure_kind',      NEW.failure_kind,
      'host_id',           NEW.host_id,
      'incident_kind',     NEW.incident_kind,
      'status_at_diagnose', NEW.status,
      'diagnosed_by',      'trg_hermes_diagnose_incident'),
    0.5,
    'suggested'
  where not exists (
    select 1 from hermes.repair_suggestions rs
    where rs.proposed_change->>'incident_key'
          = coalesce(nullif(NEW.deploy_id::text, ''), NEW.service_name, NEW.failure_kind));
  return NEW;
exception when others then
  -- Diagnose mag het vastleggen van een incident nooit blokkeren.
  return NEW;
end;
$$;

drop trigger if exists trg_hermes_diagnose_incident on public.infra_watchdog_incidents;
create trigger trg_hermes_diagnose_incident
  after insert on public.infra_watchdog_incidents
  for each row execute function hermes.trg_diagnose_incident();

comment on function hermes.trg_diagnose_incident() is
  'S16: AFTER INSERT op infra_watchdog_incidents -> autonome repair_suggestion (fail-open). Completeert de incident->diagnose->repair-keten (c7).';
