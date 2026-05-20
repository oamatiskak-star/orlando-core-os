-- Migration 073: Media Holding OS status backfill
-- Reconcile media_holding_modules.status met de feitelijk gebouwde
-- migraties 046 t/m 071. Markeer reeds-gebouwde modules als 'live' en
-- werk voortgang per fase bij.

-- ─────────────────────────────────────────────────────────────────────────────
-- Modules → live (gebouwd in migraties 046-072 en gerelateerde routes)
-- ─────────────────────────────────────────────────────────────────────────────
update public.media_holding_modules
   set status  = 'live',
       live_at = coalesce(live_at, now()),
       updated_at = now()
 where module_key in (
   'dashboard',           -- /dashboard/media-holding (045 + UI)
   'channel-incubator',   -- 045 channels + UI
   'content-factory',     -- 049 + UI
   'cross-platform',      -- 054 credentials + UI
   'retention-lab',       -- 057 + UI
   'viral-intelligence',  -- 046-048 + mission-control UI
   'algorithm-gravity',   -- 050 + UI
   'hook-library',        -- 051+053 + UI
   'audio-intelligence',  -- 059 + UI (route: audio-library)
   'trend-scanner',       -- 056 + UI
   'winner-extraction',   -- 058 + UI
   'language-expansion',  -- 062-063 + UI
   'sponsor-engine',      -- 060 + UI
   'affiliate-engine'     -- 066 + UI
 );

-- ─────────────────────────────────────────────────────────────────────────────
-- Fase voortgang bijwerken op basis van werkelijke module-status
-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: bereken voortgang als (live_modules / total_modules) * 100
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
