-- ============================================================================
-- Migration 152: Gefaseerde cutover — Orchestrator-engine → Vastgoed Core OS
-- ============================================================================
-- vc-orch-execute-tasks (*/5) triggert /api/orchestrator/cron/execute-tasks
-- (Vercel-cron-patroon). Cutover via de generieke hermes.cron_produce(): announce
-- bij Hermes (source='orchestrator-engine', Vastgoed Core OS) → bestaand endpoint
-- ongewijzigd, trigger-fout non-fataal. ROLLBACK onderaan.
-- ============================================================================

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vc-orch-execute-tasks') then
    perform cron.unschedule('vc-orch-execute-tasks');
  end if;
  perform cron.schedule(
    'vc-orch-execute-tasks', '*/5 * * * *',
    $c$select hermes.cron_produce(
         'Vastgoed Core OS orchestrator-taken uitvoeren en dispatch verwerken',
         '/api/orchestrator/cron/execute-tasks',
         'orchestrator-engine',
         'ff845e3c-6f1f-4730-beff-1a8144b5008c'::uuid)$c$  -- Modiwe Software BV
  );
end $$;

-- ============================================================================
-- ROLLBACK:
--   select cron.unschedule('vc-orch-execute-tasks');
--   select cron.schedule('vc-orch-execute-tasks','*/5 * * * *',
--     $$select public.trigger_vercel_cron('/api/orchestrator/cron/execute-tasks')$$);
-- ============================================================================
