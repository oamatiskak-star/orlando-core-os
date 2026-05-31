-- 097_host_heartbeat.sql
-- Workers/hosts loggen zich bij online-komst na boot. Eén publieke RPC die de host
-- in hermes.hosts bijwerkt (active + last_seen) en host.online naar hermes.logs schrijft.
create or replace function public.host_heartbeat(
  p_machine text,
  p_workers jsonb default '[]'::jsonb,
  p_note    text default null
) returns void
language plpgsql security definer set search_path = public, hermes as $$
begin
  update hermes.hosts set active = true, last_seen_at = now(), updated_at = now()
  where host_id = p_machine;
  if not found then
    insert into hermes.hosts (host_id, label, role, capabilities, active, last_seen_at)
    values (p_machine, p_machine, 'worker', '{}', true, now());
  end if;

  perform public.log_to_hermes(
    'host-boot', 'info', 'host.online',
    coalesce(p_note, p_machine || ' online na herstart'),
    jsonb_build_object('machine', p_machine, 'workers', p_workers)
  );
end $$;

grant execute on function public.host_heartbeat(text, jsonb, text) to anon, authenticated, service_role;
