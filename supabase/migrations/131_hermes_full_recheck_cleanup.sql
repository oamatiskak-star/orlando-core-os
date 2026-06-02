-- 131_hermes_full_recheck_cleanup.sql
-- "Ververs & hercheck" doet nu écht iets + Hermes zit niet stil: een volledige
-- hercheck die de supervisor draait, stale fails opschoont en stale workers reset.
-- Aangeroepen door de dashboard-knop én pg_cron (elke 20 min).

create or replace function public.hermes_full_recheck()
returns jsonb
language plpgsql security definer set search_path to 'public','hermes' as $function$
declare a int; i int; w int;
begin
  perform public.hermes_supervisor();

  -- stale media-workers (error > 3 dagen) terug naar idle
  update public.media_holding_workers
    set status='idle', last_error=null, updated_at=now()
    where status='error' and updated_at < now() - interval '3 days';
  get diagnostics w = row_count;

  -- stale alarmen (2u niet ge-raised) + deploy-debris (per-deploy-id, superseded) na 20 min
  update public.hermes_alerts
    set status='resolved', resolved_at=now()
    where status='open' and (
      last_seen_at < now() - interval '2 hours'
      or ((dedup_key like 'watchdog:deploy:%' or dedup_key like 'watchdog:escalate:%')
          and last_seen_at < now() - interval '20 minutes')
    );
  get diagnostics a = row_count;

  -- oude incidenten (2u) + deploy-failures (superseded) na 20 min. Watchdog heropent als 't nog faalt.
  update public.infra_watchdog_incidents
    set status='resolved', resolved_at=now()
    where resolved_at is null and (
      opened_at < now() - interval '2 hours'
      or (incident_kind='deploy_failure' and opened_at < now() - interval '20 minutes')
    );
  get diagnostics i = row_count;

  perform public.hermes_supervisor();

  insert into public.hermes_config(key,value) values ('full_recheck_last_run', now()::text)
    on conflict (key) do update set value = now()::text, updated_at = now();

  return jsonb_build_object('ran_at', now(),
    'alerts_resolved', coalesce(a,0), 'incidents_resolved', coalesce(i,0), 'workers_reset', coalesce(w,0));
end; $function$;

grant execute on function public.hermes_full_recheck() to service_role, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('hermes-full-recheck', '*/20 * * * *', 'select public.hermes_full_recheck();');
  end if;
end $$;
