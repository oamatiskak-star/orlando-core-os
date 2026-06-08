-- ============================================================================
-- Migration 149: Gefaseerde cutover — Account-setup/Affiliate als Hermes-producer
-- ============================================================================
-- Introduceert een GENERIEKE cron-producer-wrapper (herbruikbaar voor alle
-- volgende cron-cutovers) en bedraadt vc-account-setup-tick → Affiliate Engine.
-- Announce → bestaand endpoint (ongewijzigd, trigger-fout non-fataal).
-- ROLLBACK onderaan.
-- ============================================================================

-- Generieke wrapper: announce bij Hermes → bestaand Vercel-endpoint triggeren.
create or replace function hermes.cron_produce(p_task text, p_endpoint text, p_source text, p_company uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform hermes.submit_routing_request(p_company, p_task, p_source, false);
  begin
    perform public.trigger_vercel_cron(p_endpoint);
  exception when others then
    insert into hermes.logs(level, event, message, context)
    values ('warn', 'cron_trigger_failed', p_endpoint,
            jsonb_build_object('error', sqlerrm, 'source', p_source));
  end;
end $$;
grant execute on function hermes.cron_produce(text, text, text, uuid) to service_role;

-- Bedraad de account-setup-cron → Affiliate Engine (Modiwerijo).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'vc-account-setup-tick') then
    perform cron.unschedule('vc-account-setup-tick');
  end if;
  perform cron.schedule(
    'vc-account-setup-tick', '*/30 * * * *',
    $c$select hermes.cron_produce(
         'Affiliate account-setup verwerken en registraties controleren',
         '/api/account-setup/cron/tick',
         'affiliate-engine',
         '4679cb71-dab5-4e80-aae1-59db58dfe6c5'::uuid)$c$
  );
end $$;

-- ============================================================================
-- ROLLBACK:
--   select cron.unschedule('vc-account-setup-tick');
--   select cron.schedule('vc-account-setup-tick','*/30 * * * *',
--     $$select public.trigger_vercel_cron('/api/account-setup/cron/tick')$$);
--   -- (cron_produce kan blijven; wordt door volgende cutovers hergebruikt)
-- ============================================================================
