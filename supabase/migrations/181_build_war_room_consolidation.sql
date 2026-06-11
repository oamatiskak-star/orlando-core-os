-- 181_build_war_room_consolidation.sql
-- Build Tracker War Room — fundament-tabellen voor de PROGRAMMA-laag, dependency-graaf
-- en de consolidation-engine (propose-only). Volgnummer geverifieerd: repo-tip = 180,
-- prod (shaunum) in sync → 181/182 vrij (aanscherping 1).
--
-- GEEN workers / GEEN cron / GEEN scraper → Engine-Planner-regel n.v.t.
-- (de consolidate-route draait on-demand vanuit de UI, geen achtergrond-interval).
-- Alles additief + idempotent. Raakt bestaande build_tracker-rijen niet (nieuwe kolom is nullable).
-- RLS-patroon conform 155 (authenticated full access binnen intern OS).

-- ── pg_trgm voor deterministische similarity-fallback (aanscherping 3) ──────
create extension if not exists pg_trgm;

-- ── 1. PROGRAMMA-laag (ENTITEIT → PROGRAMMA → PROJECT) ─────────────────────
-- "AQUIER MASTER ROADMAP", "MODIWE MEDIA MASTER ROADMAP" enz. — door consolidation
-- voorgesteld, door mens bevestigd. completion_pct wordt afgeleid (geen handmatig %).
create table if not exists public.build_programs (
  id             uuid primary key default gen_random_uuid(),
  entity_id      uuid not null references public.companies(id) on delete cascade,
  program_key    text not null,
  label          text not null,
  description    text,
  source_docs    jsonb not null default '[]'::jsonb,
  sort_order     int not null default 0,
  is_proposed    boolean not null default false,   -- true = nog niet door mens bevestigd
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists idx_build_programs_entity_key
  on public.build_programs (entity_id, program_key);
create index if not exists idx_build_programs_entity on public.build_programs (entity_id);

-- projecten kunnen onder een programma hangen (nullable → bestaande rijen ongemoeid)
alter table public.build_tracker
  add column if not exists program_id uuid references public.build_programs(id) on delete set null;
create index if not exists idx_build_tracker_program on public.build_tracker (program_id);

-- ── 2. DEPENDENCY-graaf (bestond niet op prod → additief aangemaakt) ────────
create table if not exists public.build_project_dependencies (
  id                uuid primary key default gen_random_uuid(),
  source_build_id   uuid not null references public.build_tracker(id) on delete cascade,
  target_build_id   uuid not null references public.build_tracker(id) on delete cascade,
  relationship_type text not null default 'depends_on'
                      check (relationship_type in ('blocks','depends_on')),
  description       text,
  created_at        timestamptz not null default now()
);
create unique index if not exists idx_build_dep_unique
  on public.build_project_dependencies (source_build_id, target_build_id, relationship_type);
create index if not exists idx_build_dep_source on public.build_project_dependencies (source_build_id);
create index if not exists idx_build_dep_target on public.build_project_dependencies (target_build_id);

-- ── 3. CONSOLIDATION-runs (audit van elke run; AI of deterministisch) ───────
create table if not exists public.build_consolidation_runs (
  id               uuid primary key default gen_random_uuid(),
  entity_id        uuid references public.companies(id) on delete set null,
  status           text not null default 'ok'
                     check (status in ('ok','deterministic_fallback','error')),
  model            text,
  duplicates_found int not null default 0,
  merges_proposed  int not null default 0,
  detail           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists idx_build_consol_runs_entity on public.build_consolidation_runs (entity_id);
create index if not exists idx_build_consol_runs_created on public.build_consolidation_runs (created_at desc);

-- ── 4. DUPLICATE/MERGE-voorstellen — propose-only (aanscherping 3) ──────────
-- AI/deterministisch schrijft alleen voorstellen; merge wordt pas effectief na
-- expliciete mens-actie (status pending → accepted/rejected).
create table if not exists public.build_duplicate_candidates (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid references public.build_consolidation_runs(id) on delete cascade,
  entity_id           uuid references public.companies(id) on delete set null,
  item_a_id           uuid references public.build_tracker_items(id) on delete cascade,
  item_b_id           uuid references public.build_tracker_items(id) on delete cascade,
  item_a_title        text,
  item_b_title        text,
  similarity          numeric(4,3),
  confidence          numeric(4,3),
  source_reason       text not null default 'title_fuzzy'
                        check (source_reason in ('ai','title_fuzzy','exact_repo','exact_route','manual')),
  ai_verdict          text,
  proposed_merge_title text,
  proposed_program    text,
  status              text not null default 'pending'
                        check (status in ('pending','accepted','rejected')),
  decided_by          text,
  decided_at          timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_build_dupcand_run    on public.build_duplicate_candidates (run_id);
create index if not exists idx_build_dupcand_status on public.build_duplicate_candidates (status);
create index if not exists idx_build_dupcand_entity on public.build_duplicate_candidates (entity_id);

-- ── 5. updated_at trigger (hergebruik bestaande functie indien aanwezig) ────
create or replace function public.set_updated_at_build_programs()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end$$;
drop trigger if exists trg_build_programs_updated_at on public.build_programs;
create trigger trg_build_programs_updated_at
  before update on public.build_programs
  for each row execute function public.set_updated_at_build_programs();

-- ── 6. RLS (conform 155 — authenticated full access; service_role bypass) ──
do $$
declare t text;
begin
  foreach t in array array[
    'build_programs','build_project_dependencies',
    'build_consolidation_runs','build_duplicate_candidates'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_authenticated', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t||'_authenticated', t);
  end loop;
end$$;

grant select, insert, update, delete on
  public.build_programs, public.build_project_dependencies,
  public.build_consolidation_runs, public.build_duplicate_candidates
  to authenticated, service_role;
