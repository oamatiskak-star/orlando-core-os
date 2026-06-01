-- 095_hermes_morning_automation.sql
-- Hermes ochtend-automatisering + Telegram-ontvanger + geplande dispatch-taken.
-- DB draait in UTC; NL = UTC+2 (zomertijd) → 07:00 NL = 05:00 UTC.

-- 1) Telegram-ontvanger (Orlando). telegram_recipients was leeg → meldingen kwamen
--    niet aan. chat_id aangeleverd 2026-05-31.
insert into hermes.telegram_recipients (chat_id, display_name, timezone, receive_severities, active, notes)
select '7583931210', 'Orlando', 'Europe/Amsterdam', array['info','warn','error','critical'], true, 'Hoofdontvanger — chat_id 2026-05-31'
where not exists (select 1 from hermes.telegram_recipients where chat_id = '7583931210');

-- 2) Ochtend-briefing (1/6) naar 07:00 NL (05:00 UTC). Hergebruikt de bestaande
--    daily-briefing edge-functie (jobid 3) — alleen het tijdstip verschuift.
select cron.alter_job(job_id := 3, schedule := '0 5 * * *');

-- 3) Geplande dispatch-taken vrijgeven: promoveert hermes.dispatch_queue rijen met
--    status 'scheduled' naar 'queued' zodra payload.scheduled_for is verstreken.
--    Zo kan Hermes taken vooruit plannen (zoals de 07:00 Aquier-hervatting).

-- Status 'scheduled' toestaan op de dispatch-queue (vooruit plannen).
alter table hermes.dispatch_queue drop constraint if exists dispatch_queue_status_check;
alter table hermes.dispatch_queue add constraint dispatch_queue_status_check
  check (status = any (array['scheduled','queued','claimed','running','done','failed','blocked']));
create or replace function hermes.release_scheduled_tasks()
returns integer
language sql as $$
  with promoted as (
    update hermes.dispatch_queue
    set status = 'queued', updated_at = now()
    where status = 'scheduled'
      and (payload->>'scheduled_for')::timestamptz <= now()
    returning 1
  )
  select count(*)::int from promoted;
$$;

select cron.schedule('hermes_release_scheduled', '*/5 * * * *', 'select hermes.release_scheduled_tasks()');

-- 4) Hermes kan op de achtergrond Claude Code (cli-l/cli-r) aanspreken voor fixes.
--    Zet een fix-taak in de dispatch_queue die een Claude Code worker oppakt.
create or replace function hermes.dispatch_fix(
  p_title text,
  p_detail text,
  p_target_host text default 'cli-r',
  p_repo text default null,
  p_priority int default 3
) returns uuid
language sql as $$
  insert into hermes.dispatch_queue (title, workstream, repo, target_host, priority, status, payload)
  values (
    p_title, 'fix', p_repo, coalesce(p_target_host,'any'), p_priority, 'queued',
    jsonb_build_object(
      'background_fix', true,
      'detail', p_detail,
      'instruction', 'Achtergrond-fix gevraagd door Hermes. Voer de fix uit als Claude Code; onomkeerbare/externe acties (verzenden, betalen, publiceren, prod-merge) vereisen expliciete goedkeuring Orlando — escaleer dan i.p.v. uitvoeren.',
      'requested_by', 'hermes'
    )
  )
  returning id;
$$;
