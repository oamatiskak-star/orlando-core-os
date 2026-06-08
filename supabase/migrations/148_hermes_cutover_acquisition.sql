-- ============================================================================
-- Migration 148: Gefaseerde cutover — Acquisitie-engine als Hermes-producer
-- ============================================================================
-- Zelfde patroon als YouTube (mig 146): de 6 vc-acq-* crons melden zich EERST
-- aan bij Hermes (source='acquisition-engine', project=Aquier) en triggeren
-- DAARNA hun bestaande Vercel-endpoint ongewijzigd. Trigger-fout non-fataal.
-- ROLLBACK onderaan.
-- ============================================================================

create or replace function hermes.acq_cron_produce(p_task text, p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- 1. Aanmelden bij Hermes (producer)
  perform hermes.submit_routing_request(
    '4679cb71-dab5-4e80-aae1-59db58dfe6c5'::uuid,  -- Modiwerijo (Aquier-paraplu)
    p_task, 'acquisition-engine', false);
  -- 2. Bestaand werk (ongewijzigd) — non-fataal voor de announce
  begin
    perform public.trigger_vercel_cron(p_endpoint);
  exception when others then
    insert into hermes.logs(level, event, message, context)
    values ('warn', 'acq_cron_trigger_failed', p_endpoint,
            jsonb_build_object('error', sqlerrm, 'source', 'acquisition-engine'));
  end;
end $$;
grant execute on function hermes.acq_cron_produce(text, text) to service_role;

do $$
declare
  jobs text[][] := array[
    ['vc-acq-bouw-scan',      '0 4 * * *',  'Aquier kansenradar: bouwgrond en nieuwbouw scannen',          '/api/acquisition/cron/bouw-scan'],
    ['vc-acq-deal-scan',      '20 5 * * *', 'Aquier kansenradar: vastgoeddeals scannen op winstpotentie',  '/api/acquisition/cron/deal-scan'],
    ['vc-acq-director-brief', '40 5 * * *', 'Aquier acquisitie director-briefing samenstellen',            '/api/acquisition/cron/director-briefing'],
    ['vc-acq-distress-scan',  '20 4 * * *', 'Aquier kansenradar: probleemvastgoed en distress scannen',    '/api/acquisition/cron/distress-scan'],
    ['vc-acq-offmarket-scan', '0 5 * * *',  'Aquier kansenradar: off-market panden scannen',               '/api/acquisition/cron/offmarket-scan'],
    ['vc-acq-permit-scan',    '40 4 * * *', 'Aquier kansenradar: vergunningskansen scannen',               '/api/acquisition/cron/permit-scan']
  ];
  i int;
begin
  for i in 1 .. array_length(jobs, 1) loop
    if exists (select 1 from cron.job where jobname = jobs[i][1]) then
      perform cron.unschedule(jobs[i][1]);
    end if;
    perform cron.schedule(
      jobs[i][1], jobs[i][2],
      format('select hermes.acq_cron_produce(%L, %L)', jobs[i][3], jobs[i][4])
    );
  end loop;
end $$;

-- ============================================================================
-- ROLLBACK (per cron terug naar directe trigger):
--   select cron.unschedule('vc-acq-deal-scan');
--   select cron.schedule('vc-acq-deal-scan','20 5 * * *',
--     $$select public.trigger_vercel_cron('/api/acquisition/cron/deal-scan')$$);
--   ... (idem voor de overige 5) ; drop function hermes.acq_cron_produce(text,text);
-- ============================================================================
