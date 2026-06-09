-- 155_build_tracker_documents.sql
-- BUILD_TRACKER.md operationeel maken (Hybride C).
-- Markdown blijft canoniek (git); deze tabellen houden de geïngeste, gestructureerde staat vast.
-- Raakt public.build_tracker / public.holding_milestones NIET aan.

-- ── deel 1: documenten (één rij per sync) ──────────────────────────────────
create table if not exists public.build_tracker_documents (
  id            uuid primary key default gen_random_uuid(),
  scope         text not null default 'cross-project',
  source_file   text not null default 'BUILD_TRACKER.md',
  source_repo   text,
  source_branch text,
  source_commit text,
  raw_markdown  text not null,
  checksum      text not null,
  is_current    boolean not null default true,
  synced_by     text,
  synced_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index if not exists idx_btd_current on public.build_tracker_documents (is_current);
create index if not exists idx_btd_scope   on public.build_tracker_documents (scope);

-- ── deel 2: geparste regels per sectie A–E ─────────────────────────────────
create table if not exists public.build_tracker_items (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references public.build_tracker_documents(id) on delete cascade,
  section        text not null check (section in ('A','B','C','D','E')),
  item_rank      int  not null default 0,
  title          text not null,
  detail         text,
  status_tag     text,
  blocker_code   text,                       -- bv. 'C1' (sectie C)
  owner          text,
  repo           text,
  route          text,
  evidence       text,
  deploy_allowed boolean,                     -- sectie E: mag wel/niet deployen
  match_kind     text check (match_kind in ('workstream','title','repo','regex')),
  match_pattern  text,                        -- alleen sectie D; NULL = geen Hermes-flag (geen fuzzy auto-block)
  raw_line       text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_bti_document on public.build_tracker_items (document_id);
create index if not exists idx_bti_section  on public.build_tracker_items (section);

-- ── deel 3: RLS (conform holding_milestones, mig 096) ──────────────────────
alter table public.build_tracker_documents enable row level security;
drop policy if exists build_tracker_documents_authenticated on public.build_tracker_documents;
create policy build_tracker_documents_authenticated on public.build_tracker_documents
  for all to authenticated using (true) with check (true);

alter table public.build_tracker_items enable row level security;
drop policy if exists build_tracker_items_authenticated on public.build_tracker_items;
create policy build_tracker_items_authenticated on public.build_tracker_items
  for all to authenticated using (true) with check (true);

-- ── deel 4: Hermes conflict-check (advisory, read-only) ────────────────────
-- Returnt sectie-D ('niet opnieuw doen') items die matchen op een voorgenomen taak.
-- VEILIG: alleen items MET een expliciete match_pattern tellen mee → standaard 0 hits
-- tot iemand een patroon cureert. Geen fuzzy vals-blokkades.
create or replace function hermes.tracker_conflict_check(
  p_title      text,
  p_workstream text default null,
  p_repo       text default null
)
returns table (
  item_id       uuid,
  title         text,
  detail        text,
  match_kind    text,
  match_pattern text,
  source_commit text
)
language sql
stable
as $$
  select i.id, i.title, i.detail, i.match_kind, i.match_pattern, d.source_commit
  from public.build_tracker_items i
  join public.build_tracker_documents d on d.id = i.document_id
  where d.is_current
    and i.section = 'D'
    and i.match_pattern is not null
    and (
      (coalesce(i.match_kind,'title') = 'title'      and p_title      ilike '%' || i.match_pattern || '%') or
      (i.match_kind = 'workstream' and p_workstream is not null and p_workstream ilike '%' || i.match_pattern || '%') or
      (i.match_kind = 'repo'       and p_repo       is not null and p_repo       ilike '%' || i.match_pattern || '%') or
      (i.match_kind = 'regex'      and (
          p_title ~* i.match_pattern
          or (p_workstream is not null and p_workstream ~* i.match_pattern)
          or (p_repo       is not null and p_repo       ~* i.match_pattern)
      ))
    );
$$;

grant execute on function hermes.tracker_conflict_check(text, text, text) to authenticated, service_role;
