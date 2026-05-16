-- Personeel module: employees, contracts, payslips, documents, UBO

create table if not exists public.employees (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies(id) on delete set null,
  name          text not null,
  email         text,
  phone         text,
  type          text not null default 'medewerker', -- medewerker | zzp | stagiair
  job_title     text,
  start_date    date,
  end_date      date,
  bsn           text,
  iban          text,
  hourly_rate   numeric(10,2),
  monthly_salary numeric(10,2),
  hours_per_week numeric(5,2),
  status        text not null default 'actief',     -- actief | inactief | ziek | verlof
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists employees_company_idx on public.employees(company_id);
create index if not exists employees_status_idx  on public.employees(status);

create table if not exists public.hr_contracts (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  type          text not null default 'arbeidscontract', -- arbeidscontract | zzp | opdrachtbevestiging | nul-uren
  status        text not null default 'actief',           -- concept | actief | verlopen | opgezegd
  start_date    date,
  end_date      date,
  salary        numeric(10,2),
  hours_per_week numeric(5,2),
  file_url      text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists hr_contracts_employee_idx on public.hr_contracts(employee_id);
create index if not exists hr_contracts_status_idx   on public.hr_contracts(status);

create table if not exists public.payslips (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  period        text not null,               -- YYYY-MM
  gross_salary  numeric(10,2),
  net_salary    numeric(10,2),
  file_url      text,
  sent_at       timestamptz,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists payslips_employee_idx on public.payslips(employee_id);
create index if not exists payslips_period_idx   on public.payslips(period desc);

create table if not exists public.hr_documents (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid references public.employees(id) on delete cascade,
  company_id    uuid references public.companies(id) on delete set null,
  doc_type      text not null default 'overig', -- id | diploma | vog | rijbewijs | certficaat | overig
  title         text not null,
  file_url      text,
  expires_at    date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index if not exists hr_documents_employee_idx on public.hr_documents(employee_id);
create index if not exists hr_documents_company_idx  on public.hr_documents(company_id);

create table if not exists public.ubo_records (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies(id) on delete cascade,
  name          text not null,
  date_of_birth date,
  nationality   text,
  percentage    numeric(5,2),
  address       text,
  registered_at date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ubo_records_company_idx on public.ubo_records(company_id);
