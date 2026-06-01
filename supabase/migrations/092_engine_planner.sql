-- 092_engine_planner.sql
-- Centrale planner: zet alle scrapers + acquisitie-motoren in niet-overlappende
-- tijdblokken (Europe/Amsterdam) zodat ze nooit als één grote batch tegelijk
-- draaien. Lichte engines mogen een blok delen; zware batches krijgen een eigen slot.
-- Dispatchers checken engine_window_open() voordat ze een engine starten.

-- ── Tijdblokken (lanes) ───────────────────────────────────────────────────────
create table if not exists public.engine_schedule_blocks (
  block_key    text primary key,
  label        text not null,
  window_start time not null,
  window_end   time not null,        -- mag < window_start zijn = loopt over middernacht
  days         int[] not null default '{1,2,3,4,5,6,7}',  -- ISO dow (1=ma..7=zo)
  weight       int  not null default 1,                   -- 1=licht .. 3=zwaar
  color        text not null default '#6366f1',
  sort         int  not null default 0,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── Engine → blok toewijzing ──────────────────────────────────────────────────
create table if not exists public.engine_schedule (
  engine_key text primary key,        -- '<grp>:<naam>'
  grp        text not null,           -- 'scraper_config' | 'vastgoed' | 'acq' | 'youtube'
  label      text not null,
  block_key  text references public.engine_schedule_blocks(block_key) on delete set null,
  enabled    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_engine_schedule_block on public.engine_schedule(block_key);

-- ── Seed: de blokken (NL-tijd) ────────────────────────────────────────────────
insert into public.engine_schedule_blocks (block_key,label,window_start,window_end,weight,color,sort) values
  ('youtube',       'YouTube / Media',        '06:00','07:00',2,'#ef4444',10),
  ('nl_fast',       'NL snel (funda e.d.)',   '07:00','09:00',2,'#f59e0b',20),
  ('nl_slow',       'NL zwaar / intelligence','09:00','10:30',3,'#f97316',30),
  ('intl_eu',       'Intl · West-Europa',     '10:30','12:00',2,'#10b981',40),
  ('intl_iberia',   'Intl · Iberia/Italië',   '12:00','13:30',2,'#14b8a6',50),
  ('intl_uk',       'Intl · UK/Ierland',      '13:30','15:00',2,'#06b6d4',60),
  ('intl_americas', 'Intl · Amerika',         '15:00','17:00',2,'#3b82f6',70),
  ('acq_ai',        'Acquisitie AI-motoren',  '17:00','18:30',3,'#8b5cf6',80),
  ('intl_apac_me',  'Intl · APAC/Midden-Oosten','22:00','00:00',2,'#a855f7',90)
on conflict (block_key) do nothing;

-- ── Gate: mag deze engine nu draaien? ─────────────────────────────────────────
-- True als de engine enabled is, een enabled blok heeft, vandaag een toegestane
-- dag is, en de huidige NL-tijd binnen het venster valt (incl. over-middernacht).
create or replace function public.engine_window_open(p_engine_key text)
returns boolean
language sql stable as $$
  with n as (
    select (now() at time zone 'Europe/Amsterdam') as ts
  ), e as (
    select es.enabled as e_on, b.enabled as b_on, b.window_start, b.window_end,
           (extract(isodow from (select ts from n))::int = any(b.days)) as day_ok
    from public.engine_schedule es
    left join public.engine_schedule_blocks b on b.block_key = es.block_key
    where es.engine_key = p_engine_key
  )
  select case
    when not exists (select 1 from e) then true            -- onbekende engine: niet blokkeren
    when (select e_on from e) is not true then false
    when (select b_on from e) is not true then false        -- geen/uit blok = niet draaien
    when (select day_ok from e) is not true then false      -- vandaag geen toegestane dag
    else (
      select case
        when e.window_start <= e.window_end
          then (n.ts::time >= e.window_start and n.ts::time < e.window_end)
        else (n.ts::time >= e.window_start or n.ts::time < e.window_end)  -- over middernacht
      end
      from e, n
    )
  end;
$$;

-- ── Seed engines vanuit de bestaande bron-tabellen ────────────────────────────
-- NL scrapers: snel vs zwaar opsplitsen op naam.
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
select 'scraper_config:'||source, 'scraper_config', source,
  case when source in ('funda','jaap','huislijn','beleggingspanden','funda_business','vastgoed_nl','lead_scoring')
       then 'nl_fast' else 'nl_slow' end,
  enabled
from public.scraper_config
on conflict (engine_key) do nothing;

-- Acquisitie AI-motoren → eigen avondblok.
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
select 'acq:'||name, 'acq', name, 'acq_ai', (status = 'actief')
from public.acq_agent_registry
on conflict (engine_key) do nothing;

-- Internationale vastgoed-bronnen → round-robin over de 4 intl-blokken zodat er
-- nooit één grote batch tegelijk loopt (gelijkmatige spreiding op naam-volgorde).
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
select 'vastgoed:'||src, 'vastgoed', src,
  (array['intl_eu','intl_iberia','intl_uk','intl_americas','intl_apac_me'])[ (rn % 5) + 1 ],
  true
from (
  select coalesce(source_name, name) as src,
         row_number() over (order by coalesce(source_name, name)) - 1 as rn
  from vastgoed_core.scraper_sources
) s
on conflict (engine_key) do nothing;

-- ── Planner-view voor de UI ───────────────────────────────────────────────────
create or replace view public.v_engine_planner as
select es.engine_key, es.grp, es.label, es.enabled as engine_enabled,
       b.block_key, b.label as block_label, b.window_start, b.window_end,
       b.days, b.weight, b.color, b.sort, b.enabled as block_enabled,
       public.engine_window_open(es.engine_key) as window_open_now
from public.engine_schedule es
left join public.engine_schedule_blocks b on b.block_key = es.block_key;

grant select on public.v_engine_planner to anon, authenticated, service_role;
grant all on public.engine_schedule, public.engine_schedule_blocks to service_role;
