-- 093_engine_window_sync.sql
-- Handhaving van de Engine Planner: elke minuut worden de bestaande bron-flags
-- (scraper_config.enabled, vastgoed_core.scraper_sources.is_active, acq-status)
-- gelijkgezet aan engine_window_open(). Buiten zijn tijdblok staat een engine
-- dus 'uit' in de tabel die de dispatcher leest → hij draait niet.
-- De planner (engine_schedule + engine_schedule_blocks) is hiermee de single
-- source of truth voor wanneer wat draait. Alleen engines mét een blok worden
-- aangeraakt; zonder blok blijft de huidige flag staan (= nog in te plannen).

create or replace function public.sync_engine_windows()
returns void
language plpgsql as $$
begin
  -- NL scrapers
  update public.scraper_config sc
  set enabled = public.engine_window_open(es.engine_key)
  from public.engine_schedule es
  where es.grp = 'scraper_config'
    and es.block_key is not null
    and es.engine_key = 'scraper_config:'||sc.source
    and es.enabled                                   -- planner-master uit = laat staan/uit elders
    and sc.enabled is distinct from public.engine_window_open(es.engine_key);

  -- planner-master uit → scraper hard uit
  update public.scraper_config sc set enabled = false
  from public.engine_schedule es
  where es.engine_key = 'scraper_config:'||sc.source
    and es.block_key is not null and not es.enabled and sc.enabled;

  -- Internationale vastgoed-bronnen
  update vastgoed_core.scraper_sources ss
  set is_active = (es.enabled and public.engine_window_open(es.engine_key))
  from public.engine_schedule es
  where es.grp = 'vastgoed'
    and es.block_key is not null
    and es.engine_key = 'vastgoed:'||coalesce(ss.source_name, ss.name)
    and ss.is_active is distinct from (es.enabled and public.engine_window_open(es.engine_key));

  -- Acquisitie AI-motoren: actief binnen venster (mits planner-master aan), anders paused
  update public.acq_agent_registry ar
  set status = case when es.enabled and public.engine_window_open(es.engine_key)
                    then 'actief' else 'paused' end
  from public.engine_schedule es
  where es.grp = 'acq'
    and es.block_key is not null
    and es.engine_key = 'acq:'||ar.name
    and ar.status is distinct from (case when es.enabled and public.engine_window_open(es.engine_key)
                                         then 'actief' else 'paused' end);
end;
$$;

-- Elke minuut handhaven.
select cron.schedule('engine_window_sync', '* * * * *', 'select public.sync_engine_windows()');

-- Direct één keer draaien zodat de huidige staat meteen klopt.
select public.sync_engine_windows();
