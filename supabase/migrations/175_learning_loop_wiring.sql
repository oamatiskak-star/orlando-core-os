-- 175_learning_loop_wiring.sql
-- CF2 — sluit de Learning Loop: plan_content_horizon consumeert nu Winner Intelligence +
-- winnende hook-patronen (Winner → Pattern → Horizon → Nieuwe selectie). ADDITIEF.
-- Buffer max 48u. Gated engine blijft enabled=false; functie draait niet vanzelf.
-- HARDE GATE: niet auto-toepassen. Geen worker/spend.

-- provenance-kolommen op het horizon-plan (herleidbaarheid)
alter table public.content_horizon
  add column if not exists source_winner_video_id uuid,
  add column if not exists bron_hook_category text;

create or replace function public.plan_content_horizon()
returns integer language plpgsql as $fn$
declare v_count int := 0;
begin
  delete from public.content_horizon where status = 'planned';

  with cat_map(channel_niche, cats) as (
    values
      ('finance_education_nl', array['youtube_cat_27','youtube_cat_22','youtube_cat_25']),
      ('finance_education_es', array['youtube_cat_27','youtube_cat_22','youtube_cat_25']),
      ('vastgoed_education_nl',array['youtube_cat_27','youtube_cat_22','youtube_cat_25']),
      ('satisfying_cutting',   array['youtube_cat_20','youtube_cat_24','youtube_cat_1']),
      ('satisfying_brick_world',array['youtube_cat_20','youtube_cat_24','youtube_cat_1']),
      ('seamless loops / satisfying / mini-world', array['youtube_cat_20','youtube_cat_24','youtube_cat_1'])
  ),
  -- LEARNING: per niche de winnende hook-categorie + bron-winner (uit Winner Intelligence)
  niche_winner as (
    select distinct on (wi.niche) wi.niche, wi.category as best_hook,
           wi.id as winner_video_id, left(wi.title,70) as winner_title
    from public.v_winner_intelligence wi
    order by wi.niche, wi.hook_score desc, wi.views desc
  ),
  -- 1) viral-gedreven plan (waar extern signaal sterk is, bv. satisfying)
  ranked as (
    select mh.id as channel_id, mh.niche, vo.id as opp_id, vo.title, vo.views, vo.virality_score,
           row_number() over (partition by mh.id order by vo.virality_score desc nulls last, vo.view_velocity desc nulls last) as rn
    from public.media_holding_channels mh
    join cat_map cm on cm.channel_niche = mh.niche
    join public.viral_opportunities vo on vo.niche = any(cm.cats) and vo.captured_at > now() - interval '7 days'
    where mh.status in ('live','scaling','incubating')
  ),
  viral_plan as (
    select r.channel_id, r.niche, r.opp_id as source_opportunity_id, nw.winner_video_id, nw.best_hook,
      'Variant (' || coalesce(nw.best_hook,'hook') || '): ' || left(r.title, 60) as title_draft,
      r.virality_score::numeric as confidence, r.views as expected_views,
      concat_ws(' · ', 'Top-viral (vir ' || r.virality_score || ')',
        case when nw.best_hook is not null then 'winnende hook: ' || nw.best_hook end,
        case when nw.winner_title is not null then 'bron-winner: ' || nw.winner_title end) as reason
    from ranked r left join niche_winner nw on nw.niche = r.niche
    where r.rn <= 2
  ),
  -- 2) winner-gedreven plan (waar extern signaal zwak is, bv. finance/vastgoed) — uit eigen winners
  winner_plan as (
    select mh.id as channel_id, wi.niche, null::uuid as source_opportunity_id, wi.id as winner_video_id, wi.category as best_hook,
      'Variant (' || wi.category || '): ' || left(wi.title, 60) as title_draft,
      wi.hook_score::numeric as confidence, wi.views as expected_views,
      concat_ws(' · ', 'Bron-winner (score ' || wi.hook_score || ')', 'hook: ' || wi.category, 'niche-patroon') as reason,
      row_number() over (partition by mh.id order by wi.hook_score desc, wi.views desc) as rn
    from public.media_holding_channels mh
    join public.youtube_channels yc on yc.id = mh.youtube_channel_id
    join public.v_winner_intelligence wi on wi.channel = yc.name
    where mh.status in ('live','scaling','incubating')
      and mh.id not in (select channel_id from viral_plan)
  ),
  combined as (
    select channel_id, niche, source_opportunity_id, winner_video_id, best_hook, title_draft, confidence, expected_views, reason from viral_plan
    union all
    select channel_id, niche, source_opportunity_id, winner_video_id, best_hook, title_draft, confidence, expected_views, reason from winner_plan where rn <= 2
  )
  insert into public.content_horizon
    (channel_id, niche, source_opportunity_id, source_winner_video_id, bron_hook_category,
     title_draft, planned_publish_at, buffer_hours, confidence, expected_views, expected_subs, reason, status)
  select channel_id, niche, source_opportunity_id, winner_video_id, best_hook,
         title_draft, now() + interval '48 hours', 48, confidence, expected_views, null, reason, 'planned'
  from combined;

  get diagnostics v_count = row_count;
  return v_count;
end $fn$;
