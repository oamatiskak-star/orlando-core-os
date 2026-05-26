-- 083_media_holding_targets.sql
-- Business-plan overlay tabel voor Media Holding OS.
-- Elke KPI in het Executive dashboard kan tegen een verwachte waarde gezet
-- worden: Current vs Target vs Status. Per channel (NULL = ecosystem-wide).

create table if not exists public.media_holding_targets (
  id            uuid primary key default gen_random_uuid(),
  channel_id    uuid references public.media_holding_channels(id) on delete cascade,
  metric        text not null
                  check (metric in (
                    'views_24h','views_7d','views_30d',
                    'subscribers','subscribers_gained_7d',
                    'ctr','retention_avg','watch_time_hours',
                    'virality_score','momentum_score',
                    'breakouts_7d','swarm_readiness',
                    'revenue_30d','rpm','cpm'
                  )),
  period        text not null default 'rolling'
                  check (period in ('rolling','monthly','quarterly','annual')),
  target_value  numeric(14,2) not null,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (channel_id, metric, period)
);

create index if not exists idx_mh_targets_channel
  on media_holding_targets(channel_id, metric);

-- Default ecosystem-wide targets (channel_id NULL).
-- Cijfers afgeleid uit Media Holding businessplan baseline.
insert into public.media_holding_targets (channel_id, metric, period, target_value, notes) values
  (NULL, 'views_24h',         'rolling', 25000,  'Ecosystem totaal — alle 5 kanalen samen'),
  (NULL, 'views_7d',          'rolling', 175000, 'Ecosystem 7-daags target'),
  (NULL, 'views_30d',         'rolling', 800000, 'Ecosystem 30-daags target'),
  (NULL, 'retention_avg',     'rolling', 0.55,   'Gemiddelde retentie 55%+'),
  (NULL, 'ctr',               'rolling', 0.06,   'Gemiddelde CTR 6%+'),
  (NULL, 'subscribers_gained_7d', 'rolling', 250, 'Netto subs 7d ecosystem'),
  (NULL, 'virality_score',    'rolling', 80,     'Mediaan virality_score viral_opportunities'),
  (NULL, 'breakouts_7d',      'rolling', 12,     'Algorithm Gravity breakouts/week'),
  (NULL, 'swarm_readiness',   'rolling', 70,     'Aantal swarm-ready content_items 0-100'),
  (NULL, 'revenue_30d',       'monthly', 1500,   'YouTube + sponsor + affiliate omzet €'),
  (NULL, 'rpm',               'rolling', 2.5,    'RPM doelwit (gemiddeld)')
on conflict (channel_id, metric, period) do nothing;

-- updated_at trigger
create or replace function public.touch_media_holding_targets()
returns trigger language plpgsql as $f$
begin
  new.updated_at := now();
  return new;
end $f$;

drop trigger if exists trg_touch_mh_targets on public.media_holding_targets;
create trigger trg_touch_mh_targets
  before update on public.media_holding_targets
  for each row execute function public.touch_media_holding_targets();

-- View die targets aan huidige waarden koppelt voor het Executive dashboard.
-- Vult ecosystem-niveau in als geen channel-specifiek target bestaat.
create or replace view public.v_media_holding_kpi_targets as
  select
    t.id            as target_id,
    t.channel_id,
    c.name          as channel_name,
    t.metric,
    t.period,
    t.target_value,
    t.notes,
    t.updated_at
  from public.media_holding_targets t
  left join public.media_holding_channels c on c.id = t.channel_id;
