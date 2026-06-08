-- ============================================================================
-- Migration 150: Gefaseerde cutover — Content-factory → Marketing als producer
-- ============================================================================
-- content_radar_calendar draait een SQL-functie (geen Vercel-endpoint), gegate
-- door de engine-planner-window. Cutover: announce-only helper + behoud van de
-- exacte window-gating. Announce + generatie gebeuren beide ALLEEN als de window
-- open is (geen ruis). Bestaande generate_radar_content_queue() ongewijzigd.
-- ROLLBACK onderaan.
-- ============================================================================

-- Announce-only producer (geen HTTP-trigger; voor SQL-gedreven engines).
create or replace function hermes.cron_produce_announce(p_task text, p_source text, p_company uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform hermes.submit_routing_request(p_company, p_task, p_source, false);
  exception when others then
    insert into hermes.logs(level, event, message, context)
    values ('warn', 'cron_announce_failed', p_source, jsonb_build_object('error', sqlerrm));
  end;
end $$;
grant execute on function hermes.cron_produce_announce(text, text, uuid) to service_role;

-- Bedraad content_radar_calendar: window-gated announce + bestaande generatie.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'content_radar_calendar') then
    perform cron.unschedule('content_radar_calendar');
  end if;
  perform cron.schedule(
    'content_radar_calendar', '*/20 * * * *',
    $c$do $b$
      begin
        if public.engine_window_open('content:radar-calendar') then
          perform hermes.cron_produce_announce(
            'Marketing contentkalender uit viral-radar genereren en plannen',
            'content-factory',
            '082611e3-ecf7-4b14-bc83-4d5c4db9ec52'::uuid);  -- Modiwe Media BV
          perform public.generate_radar_content_queue();
        end if;
      end
    $b$;$c$
  );
end $$;

-- ============================================================================
-- ROLLBACK:
--   select cron.unschedule('content_radar_calendar');
--   select cron.schedule('content_radar_calendar','*/20 * * * *',
--     $$ select case when public.engine_window_open('content:radar-calendar')
--                    then public.generate_radar_content_queue() else 0 end $$);
-- ============================================================================
