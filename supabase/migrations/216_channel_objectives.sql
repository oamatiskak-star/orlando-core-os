-- 216_channel_objectives.sql
-- Hermes-intent-laag: maakt "maak een €60k/maand-kanaal" tot één uitvoerbare, volgbare
-- instructie. Additief. set_channel_objective() = de executor (registreert doel + schakelt
-- het kanaal om naar het finance data-explainer-profiel). v_channel_objective_progress =
-- de stuurbron (echte omzet vs doel) waarop director/Hermes/dashboard kunnen sturen.
--
-- SLEUTELS (live geverifieerd): channel_strategy.channel_id = media_holding_channels.id;
-- media_holding_channels.youtube_channel_id = youtube_channels.id;
-- monetization_metrics.channel_id = youtube_channels.id. De objective hangt daarom aan
-- media_holding_channels.id (consistent met channel_strategy), en de view mapt door naar
-- youtube_channels voor de echte omzet/views.

create table if not exists public.channel_objectives (
  id                          uuid primary key default gen_random_uuid(),
  channel_id                  uuid not null references public.media_holding_channels(id) on delete cascade,
  target_monthly_revenue_eur  numeric(12,2) not null,
  currency                    text not null default 'EUR',
  target_date                 date,
  format_profile              text,
  status                      text not null default 'active',  -- active | paused | achieved | abandoned
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Eén actief doel per kanaal.
create unique index if not exists channel_objectives_one_active
  on public.channel_objectives(channel_id) where status = 'active';

-- Executor: registreer/actualiseer het doel én schakel het kanaal om naar het profiel.
-- p_channel_id = media_holding_channels.id (= channel_strategy.channel_id).
create or replace function public.set_channel_objective(
  p_channel_id      uuid,
  p_target_eur      numeric,
  p_target_date     date    default null,
  p_format_profile  text    default 'us_finance_longform',
  p_target_seconds  int     default 840,
  p_data_symbols    jsonb   default '["^GSPC","^IXIC","^DJI"]'::jsonb
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  -- 1) oud actief doel afsluiten, nieuw doel registreren
  update public.channel_objectives
     set status = 'abandoned', updated_at = now()
   where channel_id = p_channel_id and status = 'active';

  insert into public.channel_objectives
    (channel_id, target_monthly_revenue_eur, target_date, format_profile, status, notes)
  values
    (p_channel_id, p_target_eur, p_target_date, p_format_profile, 'active',
     'Aangemaakt via set_channel_objective (Hermes-intent)')
  returning id into v_id;

  -- 2) kanaal omschakelen naar het format-profiel (format-engine leest content_rules)
  update public.channel_strategy
     set content_rules = coalesce(content_rules, '{}'::jsonb)
                         || jsonb_build_object(
                              'format_profile', p_format_profile,
                              'target_seconds', p_target_seconds,
                              'data_symbols',   p_data_symbols
                            ),
         updated_at = now()
   where channel_id = p_channel_id;

  return v_id;
end;
$$;

-- Stuurbron: doel vs werkelijkheid (laatste 30 dagen echte omzet + views uit monetization_metrics).
create or replace view public.v_channel_objective_progress as
with rev30 as (
  select channel_id,
         coalesce(sum(estimated_revenue), 0) as revenue_30d_eur,
         coalesce(sum(views), 0)             as views_30d
  from public.monetization_metrics
  where captured_at > now() - interval '30 days'
  group by channel_id
)
select o.id                                 as objective_id,
       o.channel_id                         as media_channel_id,
       yc.id                                as youtube_channel_id,
       yc.name                              as channel_name,
       o.target_monthly_revenue_eur,
       o.target_date,
       o.format_profile,
       o.status,
       coalesce(r.revenue_30d_eur, 0)       as revenue_30d_eur,
       coalesce(r.views_30d, 0)             as views_30d,
       coalesce(yc.subscriber_count, yc.subscribers, 0) as subscribers,
       case when o.target_monthly_revenue_eur > 0
            then round(100 * coalesce(r.revenue_30d_eur, 0) / o.target_monthly_revenue_eur, 1)
            else 0 end                      as progress_pct,
       greatest(o.target_monthly_revenue_eur - coalesce(r.revenue_30d_eur, 0), 0) as gap_eur,
       o.created_at,
       o.updated_at
from public.channel_objectives o
join public.media_holding_channels mh on mh.id = o.channel_id
join public.youtube_channels yc on yc.id = mh.youtube_channel_id
left join rev30 r on r.channel_id = yc.id
where o.status = 'active';

comment on function public.set_channel_objective is
  'Hermes-intent executor: registreert een omzetdoel voor een kanaal (media_holding_channels.id) en schakelt het om naar het format-profiel. Bron voor "maak een €60k/maand-kanaal".';
comment on view public.v_channel_objective_progress is
  'Stuurbron: actief kanaaldoel vs echte 30d-omzet/views. Voor director/Hermes/dashboard.';
