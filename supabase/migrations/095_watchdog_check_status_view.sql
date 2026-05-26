-- Materialized convenience view: each registered check joined with its most
-- recent run. Lets the dashboard render the current state of all 38 checks
-- with a single query instead of N+1.

create or replace view public.infra_watchdog_check_status as
select
  c.id,
  c.slug,
  c.display_name,
  c.check_type,
  c.layer,
  c.category,
  c.severity,
  c.interval_seconds,
  c.consecutive_failures_to_escalate,
  c.enabled,
  c.config,
  c.threshold,
  c.notes,
  r.ok          as last_ok,
  r.latency_ms  as last_latency_ms,
  r.value       as last_value,
  r.message     as last_message,
  r.metadata    as last_metadata,
  r.ran_at      as last_run_at
from public.infra_watchdog_checks c
left join lateral (
  select ok, latency_ms, value, message, metadata, ran_at
  from public.infra_watchdog_check_runs
  where check_id = c.id
  order by ran_at desc
  limit 1
) r on true;

grant select on public.infra_watchdog_check_status to authenticated, service_role;
