-- 176_cf2_seed_jobs.sql
-- CF2 — seed de producer-queue (cf2_jobs) uit het content_horizon-plan, met volledige
-- provenance + 9-stap audittrail. Dit is PLANNING/VOORBEREIDING (geen productie/spend):
-- viral/hook/winner/horizon = 'done' (selectie is gebeurd), creative→attribution = 'pending'.
-- Maakt Review Intelligence + Producer Graph zichtbaar met echte, herleidbare jobs.
-- ADDITIEF + idempotent (dedup op bron_horizon_id). HARDE GATE: niet auto-toepassen.
-- Geen worker aangezet; de producer draait pas in live-mode na aparte go.

create or replace function public.cf2_seed_jobs_from_horizon()
returns integer language plpgsql as $fn$
declare v_count int := 0;
begin
  with new_jobs as (
    insert into public.cf2_jobs
      (source_winner_video_id, bron_hook_category, bron_thumbnail_ref, bron_niche,
       bron_horizon_id, bron_strategy_channel_id, bron_channel_id, reason, status)
    select ch.source_winner_video_id, ch.bron_hook_category, w.youtube_video_id, ch.niche,
           ch.id, ch.channel_id, ch.channel_id, ch.reason, 'planned'
    from public.content_horizon ch
    left join public.youtube_videos w on w.id = ch.source_winner_video_id
    where ch.status = 'planned'
      and not exists (select 1 from public.cf2_jobs j where j.bron_horizon_id = ch.id)
    returning id
  ),
  steps as (
    insert into public.cf2_job_steps (job_id, step, status, started_at, completed_at)
    select nj.id, s.step,
           case when s.step in ('viral','hook','winner','horizon') then 'done' else 'pending' end,
           case when s.step in ('viral','hook','winner','horizon') then now() end,
           case when s.step in ('viral','hook','winner','horizon') then now() end
    from new_jobs nj
    cross join unnest(array['viral','hook','winner','horizon','creative','thumbnail','video','upload','attribution']) as s(step)
    returning 1
  )
  select count(*) into v_count from new_jobs;
  return v_count;
end $fn$;

grant execute on function public.cf2_seed_jobs_from_horizon() to authenticated;
