-- ─────────────────────────────────────────────────────────────────────────
-- Migration 103 — Affiliate Intelligence Engine Phase 2
-- ─────────────────────────────────────────────────────────────────────────
-- Uitbreiding affiliate_programs met intelligence-velden
-- Nieuwe tabellen: affiliate_channel_mappings, affiliate_country_mappings
-- Extended metrics in affiliate_conversions voor gedetailleerde analyse
--
-- Idempotent (IF NOT EXISTS). RLS: service_role full, authenticated read.

-- ── 1. Extend affiliate_programs met intelligence-velden ─────────────────
alter table public.affiliate_programs
  add column if not exists optimal_channels         uuid[] not null default '{}',
  add column if not exists optimal_countries        text[] not null default '{}',
  add column if not exists content_keywords         text[] not null default '{}',
  add column if not exists avg_epc                  numeric(10,2),
  add column if not exists avg_conversion_rate      numeric(5,4),
  add column if not exists audience_fit_score       integer check (audience_fit_score >= 0 and audience_fit_score <= 100),
  add column if not exists last_performance_update  timestamptz;

create index if not exists idx_aff_programs_channels on public.affiliate_programs using gin (optimal_channels);
create index if not exists idx_aff_programs_countries on public.affiliate_programs using gin (optimal_countries);
create index if not exists idx_aff_programs_keywords on public.affiliate_programs using gin (content_keywords);

-- ── 2. Extend affiliate_conversions met gedetailleerde metrics ──────────
alter table public.affiliate_conversions
  add column if not exists audience_country         text,
  add column if not exists audience_type            text check (audience_type in ('retail','investor','entrepreneur','mixed')),
  add column if not exists content_type             text check (content_type in ('educational','review','tutorial','news','opinion','interview')),
  add column if not exists funnel_phase             text check (funnel_phase in ('awareness','consideration','decision')),
  add column if not exists days_to_conversion       integer,
  add column if not exists repeat_purchase          boolean default false,
  add column if not exists repeat_purchase_value_eur numeric(12,2);

create index if not exists idx_aff_conv_audience_country on public.affiliate_conversions (audience_country);
create index if not exists idx_aff_conv_content_type on public.affiliate_conversions (content_type);
create index if not exists idx_aff_conv_funnel_phase on public.affiliate_conversions (funnel_phase);

-- ── 3. affiliate_channel_mappings — affiliate-to-channel strategie ──────
create table if not exists public.affiliate_channel_mappings (
  id                    uuid primary key default gen_random_uuid(),
  affiliate_program_id  uuid not null references public.affiliate_programs(id) on delete cascade,
  channel_id            uuid not null references public.media_holding_channels(id) on delete cascade,
  priority              integer not null check (priority >= 1 and priority <= 5),
  reason                text,
  est_conversion_rate   numeric(5,4),
  est_epc               numeric(10,2),
  is_active             boolean not null default true,
  last_performance_sync timestamptz,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (affiliate_program_id, channel_id)
);

create index if not exists idx_aff_channel_mapping_program on public.affiliate_channel_mappings (affiliate_program_id);
create index if not exists idx_aff_channel_mapping_channel on public.affiliate_channel_mappings (channel_id);
create index if not exists idx_aff_channel_mapping_priority on public.affiliate_channel_mappings (priority);
create index if not exists idx_aff_channel_mapping_active on public.affiliate_channel_mappings (is_active);

-- Update trigger voor affiliate_channel_mappings
create or replace function public.aff_channel_mapping_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_aff_channel_mapping_updated_at on public.affiliate_channel_mappings;
create trigger trg_aff_channel_mapping_updated_at before update on public.affiliate_channel_mappings
  for each row execute function public.aff_channel_mapping_touch_updated_at();

-- ── 4. affiliate_country_mappings — affiliate-to-country beschikbaarheid ─
create table if not exists public.affiliate_country_mappings (
  id                   uuid primary key default gen_random_uuid(),
  affiliate_program_id uuid not null references public.affiliate_programs(id) on delete cascade,
  country_code         text not null check (length(country_code) = 2),
  is_available         boolean not null default true,
  is_recommended       boolean not null default false,
  avg_conversion_rate  numeric(5,4),
  avg_epc              numeric(10,2),
  compliance_notes     text,
  payout_currency      text default 'USD',
  payout_threshold     numeric(10,2),
  tax_id_required      boolean default false,
  last_sync            timestamptz,
  metadata             jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (affiliate_program_id, country_code)
);

create index if not exists idx_aff_country_mapping_program on public.affiliate_country_mappings (affiliate_program_id);
create index if not exists idx_aff_country_mapping_country on public.affiliate_country_mappings (country_code);
create index if not exists idx_aff_country_mapping_available on public.affiliate_country_mappings (is_available);
create index if not exists idx_aff_country_mapping_recommended on public.affiliate_country_mappings (is_recommended);

-- Update trigger voor affiliate_country_mappings
create or replace function public.aff_country_mapping_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_aff_country_mapping_updated_at on public.affiliate_country_mappings;
create trigger trg_aff_country_mapping_updated_at before update on public.affiliate_country_mappings
  for each row execute function public.aff_country_mapping_touch_updated_at();

-- ── 5. View — affiliate_intelligence_summary ────────────────────────────
create or replace view public.v_affiliate_intelligence_summary as
select
  ap.id,
  ap.name,
  ap.category,
  ap.monthly_revenue,
  ap.lifetime_revenue,
  ap.avg_epc,
  ap.avg_conversion_rate,
  ap.audience_fit_score,
  coalesce(acm.channel_count, 0) as mapped_channel_count,
  coalesce(array_length(ap.optimal_channels, 1), 0) as optimal_channel_count,
  coalesce(acom.country_count, 0) as available_country_count,
  coalesce(acom2.recommended_country_count, 0) as recommended_country_count,
  ap.last_performance_update
from public.affiliate_programs ap
left join (
  select affiliate_program_id, count(*) as channel_count
    from public.affiliate_channel_mappings
   where is_active = true
   group by affiliate_program_id
) acm on acm.affiliate_program_id = ap.id
left join (
  select affiliate_program_id, count(*) as country_count
    from public.affiliate_country_mappings
   where is_available = true
   group by affiliate_program_id
) acom on acom.affiliate_program_id = ap.id
left join (
  select affiliate_program_id, count(*) as recommended_country_count
    from public.affiliate_country_mappings
   where is_available = true and is_recommended = true
   group by affiliate_program_id
) acom2 on acom2.affiliate_program_id = ap.id;

comment on view public.v_affiliate_intelligence_summary is
  'Affiliate Intelligence: per-programma overzicht met channel mappings, country availability, performance metrics.';

-- ── 6. RLS — affiliate_channel_mappings en affiliate_country_mappings ───
do $$
declare t text;
begin
  for t in select unnest(array['affiliate_channel_mappings','affiliate_country_mappings'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_service_all', t);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)', t || '_service_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_authenticated_read', t);
  end loop;
end$$;

grant select on public.v_affiliate_intelligence_summary to authenticated, service_role;

-- ── 7. Initial seed — affiliate_channel_mappings ────────────────────────
-- Seed data will be loaded via TypeScript sync once channels and programs exist
-- This section is intentionally empty to avoid dependency issues
-- Data will be created through affiliate-channel-mapper and database-sync components

-- ── 8. Initial seed — affiliate_country_mappings ──────────────────────────
-- Seed data will be loaded via TypeScript sync once programs exist
-- This section is intentionally empty to avoid dependency issues
-- Data will be created through affiliate-country-mapper and database-sync components
