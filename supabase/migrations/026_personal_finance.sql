-- Personal Finance OS: net worth, assets, liabilities

create table if not exists public.personal_assets (
  id           uuid primary key default gen_random_uuid(),
  categorie    text not null default 'overig', -- spaarrekening | belegging | vastgoed | pensioen | crypto | bedrijf | overig
  naam         text not null,
  waarde       numeric(14,2) not null default 0,
  valuta       text not null default 'EUR',
  aanbieder    text,
  rekeningnummer text,
  rendement_pct numeric(6,2),        -- verwacht jaarrendement %
  aankoopdatum date,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.personal_liabilities (
  id           uuid primary key default gen_random_uuid(),
  categorie    text not null default 'overig', -- hypotheek | lening | creditcard | belasting | overig
  naam         text not null,
  saldo        numeric(14,2) not null default 0,
  rente_pct    numeric(6,2),
  maandbedrag  numeric(10,2),
  einddatum    date,
  aanbieder    text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists personal_assets_cat_idx on public.personal_assets(categorie);
create index if not exists personal_liab_cat_idx   on public.personal_liabilities(categorie);
