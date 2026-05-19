-- 065_autopilot_module.sql
-- Phase 12: autopilot module registreren in media_holding_modules

insert into public.media_holding_modules
  (fase_nr, module_key, naam, omschrijving, status, route, gebouwd_door, live_at)
values
  (6, 'autopilot', 'Autopilot', 'Autonomous Scaling — auto-dispatch chains zonder menselijke knop', 'live',
   '/dashboard/media-holding/autopilot', 'cli-l', now())
on conflict (module_key) do update
  set status = 'live',
      route = excluded.route,
      live_at = coalesce(public.media_holding_modules.live_at, excluded.live_at),
      updated_at = now();

-- Phase 6 voortgang updaten (3/4 modules live: language-expansion, sponsor-engine, autopilot. Pending: affiliate-engine)
update public.media_holding_phases
   set voortgang = 75,
       status = 'building',
       updated_at = now()
 where fase_nr = 6;
