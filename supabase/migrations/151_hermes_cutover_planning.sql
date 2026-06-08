-- ============================================================================
-- Migration 151: Gefaseerde cutover — Planning-engine → Vastgoed Core OS
-- ============================================================================
-- De planning-cyclus (daily-briefing) draait via een edge-function-call met een
-- HARDCODED api-key in het cron-commando. Om die secret niet in git/migratie te
-- zetten, laten we de bestaande daily-briefing-cron ONGEMOEID en voegen we een
-- dedicated producer-cron toe die de planning-cyclus bij Hermes aanmeldt op
-- dezelfde dagelijkse cadans (Vastgoed Core OS). Hergebruikt cron_produce_announce.
-- ROLLBACK onderaan.
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vc-planning-announce') then
    perform cron.unschedule('vc-planning-announce');
  end if;
  perform cron.schedule(
    'vc-planning-announce', '0 5 * * *',   -- gelijk met daily-briefing
    $c$select hermes.cron_produce_announce(
         'Vastgoed Core OS dagelijkse planning-briefing en build-tracker voortgang controleren',
         'planning-engine',
         'ff845e3c-6f1f-4730-beff-1a8144b5008c'::uuid)$c$  -- Modiwe Software BV
  );
end $$;

-- ============================================================================
-- ROLLBACK:
--   select cron.unschedule('vc-planning-announce');
-- ============================================================================
