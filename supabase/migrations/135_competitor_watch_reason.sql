-- 135_competitor_watch_reason.sql
-- Splitst de gevolgde concurrent-kanalen in twee stromen + markeert ruis:
--   watch_reason = 'competitor'  → directe concurrent (benchmark: subs-groei, retentie, cadans)
--                  'viral_radar' → brede money/lifestyle-kanalen (format/hook-inspiratie, GEEN benchmark)
--                  'inactive'    → makelaars/listings e.d. (geen organische content) → niet scannen
-- En tagt elk signaal met signal_relevance zodat het dagrapport de stromen kan scheiden:
--   'benchmark' (concurrent) | 'format_only' (viral_radar) | 'noise'
-- Achtergrond: de scanner verdronk in viral_spike-ruis van brede kanalen (YassinDoes e.d.)
-- terwijl de echte concurrent-signals (BLOX/Benjamin) ondersneeuwden. Detector hanteert nu
-- groep-afhankelijke drempels (concurrent: 3× eigen mediaan; viral_radar: absoluut 500 v/u of 100k/72u).

alter table public.competitor_channels add column if not exists watch_reason text not null default 'competitor';
alter table public.competitor_channels drop constraint if exists competitor_channels_watch_reason_chk;
alter table public.competitor_channels add constraint competitor_channels_watch_reason_chk
  check (watch_reason in ('competitor','viral_radar','inactive'));

alter table public.competitor_signals add column if not exists signal_relevance text;
alter table public.competitor_signals drop constraint if exists competitor_signals_relevance_chk;
alter table public.competitor_signals add constraint competitor_signals_relevance_chk
  check (signal_relevance is null or signal_relevance in ('benchmark','format_only','noise'));

create index if not exists idx_competitor_channels_watch_reason on public.competitor_channels (watch_reason);

-- viral-radar (brede money/lifestyle/hustle — format/hook-inspiratie, geen benchmark)
update public.competitor_channels set watch_reason='viral_radar'
 where platform='youtube' and external_id in (
   'UCU1lHKQ8lQ8rQItsEPuKYHA', -- YassinDoes
   'UCq253J3bWfcCIgbjTfm9Ayg', -- WooHoo Dutch
   'UCj1uMmsvqVvDqki1ShpVppQ', -- TimTinTastisch
   'UCkU1KczKTiP5HEfleQF4ewg'  -- WebsiteHustle
 );

-- inactive (makelaars/listings — geen organische content); active=false → scanner slaat over
update public.competitor_channels set watch_reason='inactive', active=false
 where platform='youtube' and external_id in (
   'UC85AZNm_KCKU1Y_P9hK-hFw', -- Netherlands Sotheby's International Realty
   'UCjr3y_tlXCCKd9cSLoWfVqw'  -- Christie's International Real Estate
 );
