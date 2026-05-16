-- Kopers & Huurders portaal

create table if not exists public.kopers_huurders (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects(id) on delete set null,
  company_id    uuid references public.companies(id) on delete set null,
  type          text not null default 'koper',  -- koper | huurder
  status        text not null default 'prospect', -- prospect | actief | afgerond | afgevallen
  naam          text not null,
  email         text,
  telefoon      text,
  adres         text,
  bsn           text,
  koopsom       numeric(12,2),
  huurprijs     numeric(10,2),
  bouwnummer    text,
  notaris       text,
  leverdatum    date,
  tekendatum    date,
  opleverdatum  date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists kopers_project_idx   on public.kopers_huurders(project_id);
create index if not exists kopers_type_idx      on public.kopers_huurders(type);
create index if not exists kopers_status_idx    on public.kopers_huurders(status);
