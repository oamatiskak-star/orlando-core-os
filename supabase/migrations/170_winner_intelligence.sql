-- 170_winner_intelligence.sql
-- Winner Intelligence — niet alleen "is winnaar" maar WAAROM winnaar: element-breakdown
-- (hook-categorie, lengte, kind, kanaal, niche, thumbnail) + afgeleide verklaring.
-- + variation_requests: "Maak 50 variaties" op de winnende structuur (consument = CF2, gated).
-- Bouwt voort op v_hook_classified (migr 169) → apply-volgorde: 169 vóór 170.
-- ADDITIEF + idempotent. HARDE GATE: niet auto-toepassen. Geen worker aangezet.

create or replace view public.v_winner_intelligence as
select
  hc.id, hc.youtube_video_id, hc.title, hc.thumbnail_url, hc.niche, hc.category,
  hc.views, hc.ctr, hc.retention, hc.revenue, hc.hook_score, hc.winner_status, hc.confidence,
  yc.name as channel,
  case when hc.is_short then 'short' else 'long' end as length_bucket,
  hc.duration_seconds,
  (hc.thumbnail_url is not null or hc.youtube_video_id is not null) as has_thumbnail,
  -- WAAROM WINNAAR (afgeleid uit echte elementen + performance)
  concat_ws('  ·  ',
    'Hook: ' || hc.category,
    case when hc.is_short then 'kort (short)' else 'lang' end,
    case when hc.ctr is not null then 'CTR ' || hc.ctr || '%' end,
    case when hc.retention is not null then 'retentie ' || hc.retention || '%' end,
    'score ' || hc.hook_score
  ) as why_winner
from public.v_hook_classified hc
join public.youtube_videos yv on yv.id = hc.id
left join public.youtube_channels yc on yc.id = yv.channel_id
where hc.winner_status in ('top_5pct','winner') and (hc.views > 0 or hc.ctr is not null)
order by hc.hook_score desc, hc.views desc;

-- Variatie-aanvragen: "Maak N variaties" op een winnende structuur. CF2 (gated) consumeert dit.
create table if not exists public.variation_requests (
  id              uuid primary key default gen_random_uuid(),
  source_video_id uuid references public.youtube_videos(id) on delete set null,
  title           text,
  niche           text,
  category        text,
  structure       jsonb not null default '{}'::jsonb,   -- hook/length/category/channel
  count           integer not null default 50,
  status          text not null default 'requested'
    check (status in ('requested','producing','done','cancelled')),
  requested_by    text,
  created_at      timestamptz not null default now()
);
create index if not exists variation_requests_status_idx on public.variation_requests (status, created_at desc);

grant select on public.v_winner_intelligence to authenticated, anon;
grant select, insert on public.variation_requests to authenticated;
