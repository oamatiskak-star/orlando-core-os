-- ─────────────────────────────────────────────────────────────────────────
-- Migration 087 — Per-entity fundatie (multi-company dashboard architectuur)
-- ─────────────────────────────────────────────────────────────────────────
-- Reconstructie van wijzigingen die initieel via Supabase MCP zijn applied
-- (versie 20260523174906 in supabase_migrations.schema_migrations).
-- Idempotent — herhaalde uitvoering veroorzaakt geen schade.
--
-- Doel:
--   1) Voeg `slug` toe aan companies + unique partial index
--   2) Sta type='persoon' toe naast bestaande types
--   3) Verbeter tasks.company_id (uuid, optional FK → companies)
--   4) Creëer build_tracker tabel voor /dashboard/build-tracker

-- ── deel 1: companies.slug ────────────────────────────────────────────────
alter table public.companies
  add column if not exists slug text;

create unique index if not exists idx_companies_slug
  on public.companies (slug)
  where slug is not null;

-- Backfill slugs voor bestaande rijen (idempotent — alleen waar nog leeg)
update public.companies set slug = 'osm'             where slug is null and lower(name) like 'o.s.m.%'             ;
update public.companies set slug = 'modiwerijo'      where slug is null and lower(name) like 'modiwerijo%'         ;
update public.companies set slug = 'modiwe-media'    where slug is null and lower(name) like 'modiwe media%'       ;
update public.companies set slug = 'modiwe-software' where slug is null and lower(name) like 'modiwe software%'    ;
update public.companies set slug = 'strkbeheer'      where slug is null and lower(name) like 'strkbeheer%'         ;
update public.companies set slug = 'strkbouw'        where slug is null and lower(name) like 'strkbouw%'           ;
update public.companies set slug = 'bouwproffs'      where slug is null and lower(name) like 'bouwproffs%'         ;

-- Ontbrekende entities upserten op slug
insert into public.companies (name, type, slug)
values
  ('O.S.M. Amatiskak',    'persoon', 'osm'),
  ('Modiwe Media BV',     'media_bv','modiwe-media'),
  ('Modiwe Software BV',  'bv',      'modiwe-software')
on conflict do nothing;

-- ── deel 2: type-check uitbreiden met 'persoon' ──────────────────────────
do $$
declare
  has_old_check boolean;
begin
  select exists (
    select 1 from pg_constraint
    where conrelid = 'public.companies'::regclass
      and contype  = 'c'
      and conname  = 'companies_type_check'
  ) into has_old_check;

  if has_old_check then
    execute 'alter table public.companies drop constraint companies_type_check';
  end if;
end$$;

alter table public.companies
  add constraint companies_type_check
  check (type in ('holding','bv','werkmaatschappij','persoon','media_bv'));

-- ── deel 3: tasks.company_id ──────────────────────────────────────────────
alter table public.tasks
  add column if not exists company_id uuid references public.companies(id) on delete set null;

create index if not exists idx_tasks_company_id on public.tasks (company_id);

-- ── deel 4: build_tracker tabel ───────────────────────────────────────────
create table if not exists public.build_tracker (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  name              text not null,
  description       text,
  status            text not null default 'planned'
                      check (status in ('planned','building','testing','deploying','live','paused','failed')),
  progress_pct      integer not null default 0 check (progress_pct between 0 and 100),
  owner             text,
  current_milestone text,
  started_at        timestamptz,
  target_at         timestamptz,
  last_update_at    timestamptz default now(),
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists idx_build_tracker_company on public.build_tracker (company_id);
create index if not exists idx_build_tracker_status  on public.build_tracker (status);
create unique index if not exists idx_build_tracker_unique_per_company
  on public.build_tracker (company_id, name);

-- updated_at trigger
create or replace function public.set_updated_at_build_tracker()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

drop trigger if exists trg_build_tracker_updated_at on public.build_tracker;
create trigger trg_build_tracker_updated_at
  before update on public.build_tracker
  for each row execute function public.set_updated_at_build_tracker();
