-- ============================================================================
-- Migration 146: Gefaseerde cutover — YouTube Engine als eerste Hermes-producer
-- ============================================================================
-- Veilig + omkeerbaar. De 8 vc-yt-* crons melden zich nu EERST aan bij Hermes
-- (submit_routing_request, source='youtube-engine') en triggeren DAARNA hun
-- bestaande Vercel-endpoint ongewijzigd. Engine-trigger-fout is non-fataal →
-- de Hermes-aanmelding blijft altijd staan. Geen worker herschreven.
--
-- ROLLBACK: zie onderaan (crons terug naar directe trigger_vercel_cron).
-- ============================================================================

-- Wrapper: announce → execute. company = Modiwe Media BV (YouTube/media holding).
create or replace function hermes.yt_cron_produce(p_task text, p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- 1. Aanmelden bij Hermes (producer-poort)
  perform hermes.submit_routing_request(
    '082611e3-ecf7-4b14-bc83-4d5c4db9ec52'::uuid,  -- Modiwe Media BV
    p_task, 'youtube-engine', false);
  -- 2. Bestaand werk uitvoeren (ongewijzigd) — fout is non-fataal voor de announce
  begin
    perform public.trigger_vercel_cron(p_endpoint);
  exception when others then
    insert into hermes.logs(level, event, message, context)
    values ('warn', 'yt_cron_trigger_failed', p_endpoint,
            jsonb_build_object('error', sqlerrm, 'source', 'youtube-engine'));
  end;
end $$;
grant execute on function hermes.yt_cron_produce(text, text) to service_role;

-- Herbedraad de 8 vc-yt-* crons: zelfde schema, nu via de wrapper.
do $$
declare
  rec record;
  jobs text[][] := array[
    ['vc-yt-refresh-tokens', '0 5 * * *',    'YouTube OAuth-tokens verversen en kanaal-gezondheid controleren', '/api/youtube/cron/refresh-tokens'],
    ['vc-yt-run-analyst',    '30 10 * * *',  'YouTube analytics analyseren per kanaal',                          '/api/youtube/cron/run-analyst'],
    ['vc-yt-run-pipeline',   '0 2 * * *',    'YouTube upload pipeline draaien',                                  '/api/youtube/cron/run-pipeline'],
    ['vc-yt-snapshot-stats', '55 23 * * *',  'YouTube dagelijkse stats-snapshot maken',                          '/api/youtube/cron/snapshot-daily-stats'],
    ['vc-yt-sync-analytics', '0 10 * * *',   'YouTube video-analytics synchroniseren',                           '/api/youtube/cron/sync-video-analytics'],
    ['vc-yt-sync-stats',     '0 8 * * *',    'YouTube kanaal-stats synchroniseren',                              '/api/youtube/cron/sync-stats'],
    ['vc-yt-trend-scan',     '30 */6 * * *', 'YouTube trends scannen voor contentkansen',                        '/api/youtube/cron/trend-scan'],
    ['vc-yt-viral-scan',     '0 */6 * * *',  'YouTube virale videos scannen',                                    '/api/youtube/cron/viral-scan']
  ];
  i int;
begin
  for i in 1 .. array_length(jobs, 1) loop
    if exists (select 1 from cron.job where jobname = jobs[i][1]) then
      perform cron.unschedule(jobs[i][1]);
    end if;
    perform cron.schedule(
      jobs[i][1], jobs[i][2],
      format('select hermes.yt_cron_produce(%L, %L)', jobs[i][3], jobs[i][4])
    );
  end loop;
end $$;

-- ============================================================================
-- ROLLBACK (per cron terug naar directe trigger):
--   select cron.unschedule('vc-yt-run-pipeline');
--   select cron.schedule('vc-yt-run-pipeline','0 2 * * *',
--     $$select public.trigger_vercel_cron('/api/youtube/cron/run-pipeline')$$);
--   ... (idem voor de overige 7) ; drop function hermes.yt_cron_produce(text,text);
-- ============================================================================
