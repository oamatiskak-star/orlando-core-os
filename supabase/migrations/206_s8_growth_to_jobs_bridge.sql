-- 206_s8_growth_to_jobs_bridge.sql
-- €60K INHAALSPRINT — Sprint A: de ontbrekende brug Growth Engine -> Producer.
--
-- Probleem (live 13-06): Hermes' growth-plan schrijft capaciteitsbesluiten naar
-- growth_allocations (videos_per_day per kanaal), maar die liepen DOOD — alleen
-- winner-replicatie seedde cf2_jobs. Hierdoor vertaalden Hermes' schaalbesluiten
-- zich nooit naar productie.
--
-- Deze migratie sluit de brug: growth_allocations -> cf2_jobs (status='planned'),
-- credit-vrij, idempotent (top-up tot videos_per_day per kanaal per dag via
-- bron_campaign-tag). Channel-id-mapping (geverifieerd live): growth_allocations.channel_id
-- = youtube_channels.id (uuid); de producer verwacht bron_channel_id = media_holding_channels.id;
-- media_holding_channels.youtube_channel_id bevat de youtube_channels.id (uuid) ->
-- join: mhc.youtube_channel_id = growth_allocations.channel_id.
--
-- Tevens: de producer-engine (content:cf2-video-projects-runner) wordt ENABLED zodat
-- de Engine Planner (engine_window_open) de producer-loop binnen het 'content'-blok
-- (18:30-22:00) autonoom laat draaien. VUISTREGEL: planner = single source of truth.

create or replace function public.cf2_seed_jobs_from_growth(p_period text default 'weekly')
returns integer
language plpgsql
as $fn$
declare
  v_total    int := 0;
  v_campaign text := 'growth:' || coalesce(p_period, 'weekly') || ':' || to_char(current_date, 'YYYY-MM-DD');
  r          record;
  v_existing int;
  v_need     int;
begin
  for r in
    select gp.channel_id, gp.channel_name, gp.videos_per_day, gp.growth_score, gp.director_action,
           mhc.id    as mhc_id,
           mhc.niche as mhc_niche
    from public.v_growth_plan_current gp
    join public.media_holding_channels mhc   on mhc.youtube_channel_id = gp.channel_id
    where coalesce(gp.videos_per_day, 0) > 0
      and coalesce(gp.director_action, '') <> 'stop'
  loop
    -- al geseede growth-jobs voor dit kanaal vandaag (top-up i.p.v. dupliceren)
    select count(*) into v_existing
    from public.cf2_jobs j
    where j.bron_campaign = v_campaign and j.bron_channel_id = r.mhc_id;

    v_need := greatest(0, coalesce(r.videos_per_day, 0) - v_existing);
    if v_need > 0 then
      with new_jobs as (
        insert into public.cf2_jobs
          (bron_niche, bron_channel_id, bron_campaign, reason, status)
        select r.mhc_niche, r.mhc_id, v_campaign,
               'Growth-allocatie (auto): ' || coalesce(r.channel_name, 'kanaal')
                 || ' · ' || r.videos_per_day || '/dag · score ' || round(coalesce(r.growth_score, 0), 3),
               'planned'
        from generate_series(1, v_need)
        returning id
      ),
      steps as (
        insert into public.cf2_job_steps (job_id, step, status, started_at, completed_at)
        select nj.id, s.step,
               case when s.step in ('viral','hook','horizon') then 'done' else 'pending' end,
               case when s.step in ('viral','hook','horizon') then now() end,
               case when s.step in ('viral','hook','horizon') then now() end
        from new_jobs nj
        cross join unnest(array['viral','hook','winner','horizon','creative','thumbnail','video','upload','attribution']) as s(step)
        returning 1
      )
      select v_total + (select count(*) from new_jobs) into v_total;
    end if;
  end loop;

  return v_total;
end $fn$;

comment on function public.cf2_seed_jobs_from_growth(text) is
  'Sprint A: brug growth_allocations -> cf2_jobs (planned). Top-up tot videos_per_day per kanaal/dag (bron_campaign-tag); credit-vrij; producer maakt de creatie.';

grant execute on function public.cf2_seed_jobs_from_growth(text) to authenticated;

-- Producer-engine activeren: de Engine Planner mag de producer-loop autonoom draaien
-- binnen het bestaande 'content'-blok (18:30-22:00, alle dagen). Geen overlap toegevoegd.
update public.engine_schedule
   set enabled = true, block_key = 'content', updated_at = now()
 where engine_key = 'content:cf2-video-projects-runner';
