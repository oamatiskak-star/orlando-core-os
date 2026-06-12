-- 195_s3_winner_replication.sql
-- AUTONOMOUS GROWTH PHASE 1 — S3 (P1): Winner Replication Loop.
--
-- DoD: bij een bewezen winnaar worden automatisch nieuwe varianten gepland.
--
-- Uitgangspunt (geverifieerd live 12-06): de hele replicatie-keten BESTAAT al als
-- SQL-functies — cf2_seed_variants_to_horizon() -> cf2_seed_jobs_from_horizon() ->
-- cf2-producer. Er staan 30 'selected' variants klaar; 58 bewezen winners (allen
-- channel-mapped) wachten op replicatie. Het gat = AUTONOME aansturing (alles handmatig/gated)
-- en winner-detector stond UIT.
--
-- Deze migratie maakt de loop credit-vrij autonoom: winners -> content_horizon -> cf2_jobs,
-- met cooldown-dedupe. Geen LLM nodig voor de PLANNING (de creatie doet de CF2-producer).
-- Plant alleen jobs (status='planned'); geen upload/spend.

-- ── 1) Bewezen winners -> replicatie-queue (credit-vrij) ─────────────────────
create or replace function public.replicate_winners(
  p_max int default 5,
  p_cooldown_days int default 14
)
returns jsonb
language plpgsql
as $$
declare
  v_horizon int := 0;
  v_jobs    int := 0;
begin
  -- plan horizon-rijen voor top-winners zonder recente replicatie
  with cand as (
    select wi.id as winner_id, wi.title, wi.niche, wi.category, wi.hook_score, wi.views,
           yv.channel_id as yt_channel_id
    from public.v_winner_intelligence wi
    join public.youtube_videos yv on yv.id = wi.id
    where wi.winner_status in ('top_5pct','winner')
      and not exists (
        select 1 from public.cf2_jobs j
        where j.source_winner_video_id = wi.id
          and j.created_at > now() - make_interval(days => p_cooldown_days))
      and not exists (
        select 1 from public.content_horizon h
        where h.source_winner_video_id = wi.id and h.status in ('planned','producing'))
    order by wi.hook_score desc nulls last, wi.views desc nulls last
    limit greatest(p_max, 0)
  ), ins as (
    insert into public.content_horizon
      (niche, status, channel_id, confidence, title_draft, bron_hook_category,
       reason, planned_publish_at, source_winner_video_id, buffer_hours)
    select
      c.niche, 'planned', mhc.id, coalesce(c.hook_score, 0),
      c.title, c.category,
      'Winner-replicatie (auto): '||coalesce(left(c.title,60),'winner')||' · hook '||coalesce(c.category,'?'),
      now() + interval '48 hours', c.winner_id, 48
    from cand c
    left join public.media_holding_channels mhc on mhc.youtube_channel_id = c.yt_channel_id
    returning 1
  )
  select count(*) into v_horizon from ins;

  -- zet ALLE geplande horizon-rijen (winner- én variant-seeded) om naar cf2_jobs.
  -- cf2_seed_jobs_from_horizon dedupet zelf op bron_horizon_id.
  select public.cf2_seed_jobs_from_horizon() into v_jobs;

  return jsonb_build_object('winners_planned', v_horizon, 'jobs_seeded', v_jobs);
end;
$$;

comment on function public.replicate_winners(int,int) is
  'S3: plant bewezen winners (v_winner_intelligence) naar content_horizon + cf2_jobs met cooldown-dedupe. Credit-vrij; creatie via CF2-producer.';

-- ── 2) Replicatie-queue (dashboard/observability) ───────────────────────────
create or replace view public.v_replication_queue as
select
  j.id            as job_id,
  j.status,
  j.bron_niche    as niche,
  j.bron_hook_category as hook_category,
  j.reason,
  j.created_at,
  j.source_winner_video_id,
  yv.title        as source_title,
  yv.youtube_video_id
from public.cf2_jobs j
left join public.youtube_videos yv on yv.id = j.source_winner_video_id
where j.source_winner_video_id is not null
order by j.created_at desc;

comment on view public.v_replication_queue is
  'S3: cf2_jobs afkomstig van winner-replicatie, nieuwste eerst.';

-- ── 3) Winner-detector activeren + replicatie-engine registreren ─────────────
update public.engine_schedule set enabled = true, updated_at = now()
 where engine_key = 'content:winner-detector';

insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('content:winner-replication', 'media', 'S3 Winner-replicatie (winners -> horizon -> cf2_jobs)', 'youtube', true)
on conflict (engine_key) do update set enabled = true, updated_at = now();
