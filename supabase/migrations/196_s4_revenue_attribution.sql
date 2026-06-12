-- 196_s4_revenue_attribution.sql
-- AUTONOMOUS GROWTH PHASE 1 — S4 (P1): Revenue Engine / attributie.
--
-- DoD: omzet herleidbaar tot Kanaal → Video → Klik → Lead → Sale.
--
-- Uitgangspunt (geverifieerd live 12-06): de affiliate-infra BESTAAT al — tabellen
-- affiliate_links/clicks/conversions (met content_item_id + channel_id), video_attribution,
-- views v_attribution_channel/v_attribution_niche (mig 172), en trigger-functies
-- affiliate_revenue_rollup + sync_affiliate_to_monetization (rollen omzet automatisch door
-- bij een conversie-insert). Niet dupliceren.
--
-- Ontbrak: (a) een link gekoppeld aan een specifieke video, (b) attributie op VIDEO-niveau,
-- (c) funnel-conversieratio's. De ontbrekende redirect-handler + webhook (event-driven HTTP)
-- zitten in de frontend-routes, niet hier.

-- ── 1) Link koppelen aan een specifieke video (content item) ─────────────────
alter table public.affiliate_links
  add column if not exists content_item_id uuid references public.media_holding_content_items(id);
create index if not exists idx_aff_links_content on public.affiliate_links(content_item_id);

comment on column public.affiliate_links.content_item_id is
  'S4: koppelt een affiliate-link aan een specifieke video/content voor video-niveau attributie.';

-- ── 2) Attributie op VIDEO-niveau: Kanaal → Video → Klik → Lead → Sale ───────
create or replace view public.v_attribution_video as
select
  ci.id                                   as content_item_id,
  ci.title,
  ci.channel_id,
  mhc.name                                as channel_name,
  coalesce(cl.clicks, 0)                  as clicks,
  coalesce(cv.leads, 0)                   as leads,
  coalesce(cv.sales, 0)                   as sales,
  coalesce(cv.revenue, 0)                 as revenue
from public.media_holding_content_items ci
left join public.media_holding_channels mhc on mhc.id = ci.channel_id
left join (
  select content_item_id, count(*) as clicks
  from public.affiliate_clicks
  where content_item_id is not null
  group by content_item_id
) cl on cl.content_item_id = ci.id
left join (
  select content_item_id,
         count(*)                                              as leads,
         count(*) filter (where status = 'confirmed')          as sales,
         coalesce(sum(commission_eur) filter (where status = 'confirmed'), 0) as revenue
  from public.affiliate_conversions
  where content_item_id is not null
  group by content_item_id
) cv on cv.content_item_id = ci.id
where coalesce(cl.clicks, 0) > 0 or coalesce(cv.leads, 0) > 0;

comment on view public.v_attribution_video is
  'S4: per-video funnel (kanaal→video→klik→lead→sale→omzet) uit affiliate_clicks/conversions.';

-- ── 3) Funnel-performance: conversieratio's per kanaal ───────────────────────
create or replace view public.v_funnel_performance as
select
  channel_id,
  name as channel_name,
  niche,
  views, clicks, leads, sales, revenue,
  round(case when views  > 0 then clicks::numeric / views  else 0 end, 5) as view_to_click,
  round(case when clicks > 0 then leads::numeric  / clicks else 0 end, 4) as click_to_lead,
  round(case when leads  > 0 then sales::numeric  / leads  else 0 end, 4) as lead_to_sale,
  round(case when clicks > 0 then revenue / clicks else 0 end, 2)         as epc
from public.v_attribution_channel;

comment on view public.v_funnel_performance is
  'S4: funnel-conversieratio''s (view→click→lead→sale) + EPC per kanaal, op v_attribution_channel.';
