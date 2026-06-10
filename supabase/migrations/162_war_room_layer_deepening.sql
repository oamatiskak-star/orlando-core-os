-- 162_war_room_layer_deepening.sql
-- Media War Room — verdiept v_war_room_nodes met de geprojecteerde lagen:
--   Performance (engagement, kanaal-subscribers/omzet, platform-metrics),
--   Operator (failure_reason op creative), Commercial (conversies per creative).
-- ADDITIEF + idempotent (create or replace). GEEN tabellen, GEEN workers, GEEN cron
-- → Engine Planner-regel niet van toepassing (zelfde als 161).
-- Alles afgeleid uit bestaande tabellen (public schema, project shaunum).
-- De frontend werkt OOK zonder deze migratie: ontbrekende payload-keys → null → "Geen data".
-- HARDE GATE: niet automatisch op prod toepassen — los toepassen na review (Orlando).

create or replace view public.v_war_room_nodes as
with score_safe as (
  select id, channel_id, hook, status, kind, title, duration_seconds, language, output_url,
         content_brief, created_at, scheduled_at, published_at, render_cost_eur, revenue_attributed,
         failure_reason,
         case when content_brief->>'source_score' ~ '^[0-9]+(\.[0-9]+)?$'
              then (content_brief->>'source_score')::numeric end as src_score
  from public.media_holding_content_items
),
latest_metric as (
  select distinct on (content_item_id)
         content_item_id, views, ctr_pct, retention_pct, revenue, snapshot_at, platform,
         likes, comments, shares, saves
  from public.media_holding_metrics
  order by content_item_id, snapshot_at desc
),
platform_metric as (
  -- laatste metric per upload (platform-node performance)
  select distinct on (upload_id)
         upload_id, views, ctr_pct, retention_pct, revenue
  from public.media_holding_metrics
  where upload_id is not null
  order by upload_id, snapshot_at desc
),
conv_per_item as (
  -- commerciële koppeling per creative (laag 3)
  select content_item_id,
         count(*) as conversions,
         coalesce(sum(commission_eur) filter (where lower(status) = 'confirmed'), 0) as commission_eur
  from public.affiliate_conversions
  where content_item_id is not null
  group by content_item_id
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
-- 2) CHANNEL (+ youtube-koppeling voor subscribers/omzet)
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
    'target_views_10d', ch.target_views_10d, 'persona_owner', ch.persona_owner,
    'subscribers', yc.subscriber_count, 'channel_revenue', yc.estimated_revenue, 'rpm', yc.rpm
  )
from public.media_holding_channels ch
left join public.youtube_channels yc on yc.id = ch.youtube_channel_id

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
    'revenue', lm.revenue, 'metric_at', lm.snapshot_at,
    'failure_reason', s.failure_reason,
    'conversions', cpi.conversions,
    'commission_eur', cpi.commission_eur,
    'engagement_pct', case when coalesce(lm.views,0) > 0
      then round((coalesce(lm.likes,0)+coalesce(lm.comments,0)+coalesce(lm.shares,0)+coalesce(lm.saves,0))::numeric / lm.views * 100, 2)
      end
  )
from score_safe s
left join latest_metric lm on lm.content_item_id = s.id
left join conv_per_item cpi on cpi.content_item_id = s.id

union all
-- 5) PLATFORM (upload) — parent = creative, + laatste platform-metric
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
    'uploaded_at', u.uploaded_at, 'error', u.error,
    'views', pm.views, 'ctr_pct', pm.ctr_pct, 'retention_pct', pm.retention_pct, 'revenue', pm.revenue
  )
from public.media_holding_uploads u
left join public.media_holding_content_items ci on ci.id = u.content_item_id
left join platform_metric pm on pm.upload_id = u.id;

grant select on public.v_war_room_nodes to authenticated, anon;
