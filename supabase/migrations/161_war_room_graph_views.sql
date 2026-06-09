-- 161_war_room_graph_views.sql (hernummerd van 139 i.v.m. collisie met 139_hermes_routing_brain.sql)
-- Reeds toegepast op shaunum als 139; create-or-replace dus idempotent bij db push.
-- Media War Room — read-only Creative Graph views.
-- GEEN tabellen, GEEN workers, GEEN cron → Engine Planner-regel niet van toepassing.
-- Alles afgeleid uit bestaande media_holding_* tabellen (public schema, project shaunum).
-- Spine: campaign(niche) -> channel -> hook -> creative -> platform.
-- Thumbnail-concept + laatste performance = facet op de creative (geen losse nodes nu;
-- dedicated thumbnail-/winner-varianten komen zodra die engine data produceert).

-- ── NODES ────────────────────────────────────────────────────────────────────
create or replace view public.v_war_room_nodes as
with score_safe as (
  -- veilige numerieke cast van content_brief->>'source_score'
  select id,
         channel_id,
         hook,
         status,
         kind,
         title,
         duration_seconds,
         language,
         output_url,
         content_brief,
         created_at,
         scheduled_at,
         published_at,
         render_cost_eur,
         revenue_attributed,
         case when content_brief->>'source_score' ~ '^[0-9]+(\.[0-9]+)?$'
              then (content_brief->>'source_score')::numeric end as src_score
  from public.media_holding_content_items
),
latest_metric as (
  select distinct on (content_item_id)
         content_item_id, views, ctr_pct, retention_pct, revenue, snapshot_at, platform
  from public.media_holding_metrics
  order by content_item_id, snapshot_at desc
)
-- 1) CAMPAIGN (top grouping = channel niche)
select
  'campaign:' || c.campaign_key                       as node_id,
  'campaign'::text                                    as node_type,
  c.campaign_key                                      as label,
  null::text                                          as parent_id,
  null::uuid                                          as channel_id,
  null::text                                          as platform,
  null::text                                          as status,
  null::numeric                                       as score,
  null::text                                          as thumbnail_url,
  null::timestamptz                                   as created_at,
  null::timestamptz                                   as scheduled_at,
  jsonb_build_object('campaign_key', c.campaign_key)  as payload
from (
  select distinct coalesce(niche, 'overig') as campaign_key
  from public.media_holding_channels
) c

union all
-- 2) CHANNEL
select
  'channel:' || ch.id,
  'channel',
  ch.name,
  'campaign:' || coalesce(ch.niche, 'overig'),
  ch.id,
  null,
  ch.status,
  ch.current_views_10d::numeric,
  null,
  ch.created_at,
  null,
  jsonb_build_object(
    'niche', ch.niche, 'handle', ch.handle, 'language', ch.language,
    'status', ch.status, 'current_views_10d', ch.current_views_10d,
    'target_views_10d', ch.target_views_10d, 'persona_owner', ch.persona_owner
  )
from public.media_holding_channels ch

union all
-- 3) HOOK (afgeleid: per channel + hook-tekst)
select
  'hook:' || md5(s.channel_id::text || '|' || s.hook),
  'hook',
  s.hook,
  'channel:' || s.channel_id,
  s.channel_id,
  null,
  null,
  max(s.src_score),
  null,
  min(s.created_at),
  null,
  jsonb_build_object(
    'hook_pattern', max(s.content_brief->>'hook_pattern'),
    'variant_count', count(*)
  )
from score_safe s
where s.hook is not null and s.channel_id is not null
group by s.channel_id, s.hook

union all
-- 4) CREATIVE (content_item) — parent = hook indien aanwezig, anders channel
select
  'creative:' || s.id,
  'creative',
  coalesce(nullif(s.title, ''), nullif(s.content_brief->>'titel',''), left(s.hook, 60), 'Creative'),
  case when s.hook is not null and s.channel_id is not null
       then 'hook:' || md5(s.channel_id::text || '|' || s.hook)
       else 'channel:' || coalesce(s.channel_id::text, 'none') end,
  s.channel_id,
  null,
  s.status,
  coalesce(lm.ctr_pct, s.src_score),
  null,
  s.created_at,
  s.scheduled_at,
  jsonb_build_object(
    'kind', s.kind, 'duration_seconds', s.duration_seconds, 'language', s.language,
    'output_url', s.output_url, 'thumbnail_concept', s.content_brief->>'visual_prompt',
    'hook', s.hook, 'published_at', s.published_at,
    'render_cost_eur', s.render_cost_eur, 'revenue_attributed', s.revenue_attributed,
    'views', lm.views, 'ctr_pct', lm.ctr_pct, 'retention_pct', lm.retention_pct,
    'revenue', lm.revenue, 'metric_at', lm.snapshot_at
  )
from score_safe s
left join latest_metric lm on lm.content_item_id = s.id

union all
-- 5) PLATFORM (upload) — parent = creative
select
  'platform:' || u.id,
  'platform',
  u.platform,
  'creative:' || u.content_item_id,
  ci.channel_id,
  u.platform,
  u.status,
  null,
  null,
  u.created_at,
  u.uploaded_at,
  jsonb_build_object(
    'platform_video_id', u.platform_video_id, 'status', u.status,
    'uploaded_at', u.uploaded_at, 'error', u.error
  )
from public.media_holding_uploads u
left join public.media_holding_content_items ci on ci.id = u.content_item_id;

-- ── EDGES ────────────────────────────────────────────────────────────────────
create or replace view public.v_war_room_edges as
-- spine-edges direct uit de node-hiërarchie
select parent_id as source_id, node_id as target_id, 'spine'::text as edge_type
from public.v_war_room_nodes
where parent_id is not null
union all
-- winner-mutatie (leeg nu; Fase 2 — bron->variant)
select 'creative:' || w.source_content_id, 'creative:' || w.output_content_id, 'winner'
from public.winner_extraction_jobs w
where w.output_content_id is not null
union all
-- revenue (leeg nu; Fase 2 — creative->conversie)
select 'creative:' || ac.content_item_id, 'revenue:' || ac.id, 'revenue'
from public.affiliate_conversions ac
where ac.content_item_id is not null;

-- ── CAMPAIGN-AGGREGATEN ──────────────────────────────────────────────────────
create or replace view public.v_war_room_campaigns as
select
  coalesce(ch.niche, 'overig')                                          as campaign_key,
  count(distinct ch.id)                                                 as channels,
  count(distinct ci.id)                                                 as creatives,
  count(distinct ci.hook)                                               as hooks,
  count(distinct u.id)                                                  as uploads,
  count(distinct u.id) filter (
    where u.status in ('verified_live','published','live'))             as live_uploads,
  round(avg(met.ctr_pct), 2)                                            as avg_ctr,
  round(avg(met.retention_pct), 2)                                      as avg_retention,
  coalesce(sum(met.views), 0)                                           as total_views,
  coalesce(sum(ci.revenue_attributed), 0)                              as revenue_attributed
from public.media_holding_channels ch
left join public.media_holding_content_items ci on ci.channel_id = ch.id
left join public.media_holding_uploads u        on u.content_item_id = ci.id
left join lateral (
  select ctr_pct, retention_pct, views
  from public.media_holding_metrics m
  where m.content_item_id = ci.id
  order by snapshot_at desc
  limit 1
) met on true
group by coalesce(ch.niche, 'overig');

-- ── GRANTS (intern OS — authenticated leest) ─────────────────────────────────
grant select on public.v_war_room_nodes     to authenticated, anon;
grant select on public.v_war_room_edges     to authenticated, anon;
grant select on public.v_war_room_campaigns to authenticated, anon;
