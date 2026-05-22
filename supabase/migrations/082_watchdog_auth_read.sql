-- Allow authenticated users to read watchdog tables (dashboard page uses anon
-- client with cookie session). Writes remain service-role only.
-- Also enables realtime so the dashboard can subscribe.

drop policy if exists infra_watchdog_events_auth_read on public.infra_watchdog_events;
create policy infra_watchdog_events_auth_read on public.infra_watchdog_events
  for select to authenticated using (true);

drop policy if exists infra_watchdog_incidents_auth_read on public.infra_watchdog_incidents;
create policy infra_watchdog_incidents_auth_read on public.infra_watchdog_incidents
  for select to authenticated using (true);

alter publication supabase_realtime add table public.infra_watchdog_events;
alter publication supabase_realtime add table public.infra_watchdog_incidents;
