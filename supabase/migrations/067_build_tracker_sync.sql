-- 067_build_tracker_sync.sql
-- Fix build tracker: corrigeer routes, markeer gebouwde modules als live,
-- voeg ontbrekende modules toe (monetization-tracker), en installeer een
-- trigger die phase voortgang/status automatisch herberekent op basis van
-- de live-status van zijn modules.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Route corrections — match met daadwerkelijke /dashboard/media-holding paths
-- ─────────────────────────────────────────────────────────────────────────────
update public.media_holding_modules
   set route   = '/dashboard/media-holding/channel-incubator',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'channel-incubator';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/content-factory',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'content-factory';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/retention-lab',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'retention-lab';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/cross-platform',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'cross-platform';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/viral-intelligence',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'viral-intelligence';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/algorithm-gravity',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'algorithm-gravity';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/hook-library',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'hook-library';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/audio-library',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'audio-intelligence';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/trend-scanner',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'trend-scanner';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/winner-extraction',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'winner-extraction';

update public.media_holding_modules
   set route   = '/dashboard/media-holding/sponsor-engine',
       status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key = 'sponsor-engine';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Voeg ontbrekende monetization-tracker module toe (Fase 6)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.media_holding_modules
  (fase_nr, module_key, naam, omschrijving, status, route, gebouwd_door, live_at)
values
  (6, 'monetization-tracker', 'Monetization Tracker',
   'Multi-stream revenue tracking: AdSense, sponsors, affiliates, products, memberships, tips',
   'live', '/dashboard/media-holding/monetization', 'cli-l', now())
on conflict (module_key) do update
  set status = 'live',
      route = excluded.route,
      live_at = coalesce(public.media_holding_modules.live_at, excluded.live_at),
      updated_at = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Phase progress auto-sync functie + trigger
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.sync_phase_progress(p_fase_nr smallint default null)
returns void
language plpgsql
security definer
set search_path = public
as $f$
declare
  rec record;
  v_pct smallint;
  v_status text;
begin
  for rec in
    select fase_nr,
           count(*)                                 as total,
           count(*) filter (where status='live')    as live_count,
           count(*) filter (where status='blocked') as blocked_count
      from public.media_holding_modules
      where p_fase_nr is null or fase_nr = p_fase_nr
     group by fase_nr
  loop
    v_pct := case when rec.total = 0 then 0 else round((rec.live_count::numeric / rec.total) * 100) end;
    v_status := case
      when v_pct = 100             then 'active'
      when rec.live_count > 0      then 'building'
      when rec.blocked_count > 0   then 'pending'
      else                              'pending'
    end;

    update public.media_holding_phases
       set voortgang = v_pct,
           status    = v_status,
           updated_at = now()
     where fase_nr = rec.fase_nr;
  end loop;
end
$f$;

create or replace function public.trg_sync_phase_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $f$
begin
  if tg_op = 'DELETE' then
    perform public.sync_phase_progress(old.fase_nr);
    return old;
  end if;
  perform public.sync_phase_progress(new.fase_nr);
  if tg_op = 'UPDATE' and old.fase_nr <> new.fase_nr then
    perform public.sync_phase_progress(old.fase_nr);
  end if;
  return new;
end
$f$;

drop trigger if exists trg_mh_modules_sync_phase on public.media_holding_modules;
create trigger trg_mh_modules_sync_phase
  after insert or update of status, fase_nr or delete on public.media_holding_modules
  for each row execute function public.trg_sync_phase_progress();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Initial run: sync alle fases nu
-- ─────────────────────────────────────────────────────────────────────────────
select public.sync_phase_progress();
