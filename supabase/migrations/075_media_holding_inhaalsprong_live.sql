-- Migration 075: Media Holding OS — inhaalsprong modules live
-- Zet de 3 modules die in dezelfde sessie als 073/074 hun UI+API kregen op 'live':
--   • settings        (Fase 2) — /dashboard/media-holding/settings
--   • analytics-engine(Fase 3) — /dashboard/media-holding/analytics
--   • archives        (Fase 5) — /dashboard/media-holding/archives
-- Daarna fase-voortgang opnieuw berekenen.

update public.media_holding_modules
   set status = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key in ('settings', 'analytics-engine', 'archives');

update public.media_holding_phases p
   set voortgang = coalesce(sub.pct, 0),
       status    = case
                     when sub.pct >= 100 then 'completed'
                     when sub.pct >=  50 then 'active'
                     when sub.pct >    0 then 'building'
                     else 'pending'
                   end,
       updated_at = now()
  from (
    select fase_nr,
           round(100.0 * count(*) filter (where status = 'live') / nullif(count(*), 0))::smallint as pct
      from public.media_holding_modules
     group by fase_nr
  ) sub
 where p.fase_nr = sub.fase_nr;
