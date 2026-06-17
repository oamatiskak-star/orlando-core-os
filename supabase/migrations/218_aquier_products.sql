-- 218_aquier_products.sql
-- Aquier productcatalogus — single source of truth voor promo-content (ads, product-
-- omschrijvingen, thumbnails) en WERKENDE productlinks per kanaal (AquierTv/AquierTvEs).
-- Geseed vanaf de live aquier.com-catalogus; needs_review=true tot Orlando bevestigt.

create table if not exists public.aquier_products (
  id           uuid primary key default gen_random_uuid(),
  sku          text unique not null,
  name         text not null,
  kind         text not null check (kind in ('report','membership','marketplace','program','lead_magnet')),
  description  text,
  audiences    text[] not null default '{}',   -- developer|investor|institutional|agent|dealfinder|financier|family_office
  price        text,
  url          text not null,                   -- werkende link (https://aquier.com/...)
  cta          text,
  active       boolean not null default true,
  needs_review boolean not null default true,   -- geseed van site → mens bevestigt
  sort         int not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.aquier_products enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='aquier_products' and policyname='aquier_products_read') then
    create policy aquier_products_read on public.aquier_products for select to authenticated using (true);
  end if;
end $$;
grant select on public.aquier_products to authenticated;

-- Seed (idempotent). Bron: aquier.com (2026-06-17). Prijzen/URL's = mens te bevestigen.
insert into public.aquier_products (sku, name, kind, description, audiences, price, url, cta, sort) values
  ('basic-investment-scan','Basis Investeringsscan','report','Snelle go/no-go score op één object.','{investor,developer,agent,dealfinder}','€97','https://aquier.com/checkout?product=basic-investment-scan','Scan je deal voor €97',10),
  ('premium-deal-scan','Premium Dealscan','report','Vlaggenschip-scan met vergelijkbare objecten en biedadvies.','{investor,developer,agent,dealfinder}','€297','https://aquier.com/checkout?product=premium-deal-scan','Krijg je Premium Dealscan',20),
  ('development-report','Ontwikkelrapport','report','Scenario''s, bouwkosten en marges voor ontwikkeling.','{developer,institutional}','vanaf €499','https://aquier.com/producten','Vraag je Ontwikkelrapport aan',30),
  ('transformation-analysis','Transformatie-analyse','report','Kantoor-naar-woning transformatiepotentieel.','{developer,investor}','€499','https://aquier.com/object-indienen?product=transformatie-analyse','Check transformatie-potentieel',40),
  ('yield-analysis','Rendementsanalyse','report','Bruto/netto rendement, huurpotentieel en cashflow.','{investor,agent,family_office}','vanaf €97','https://aquier.com/producten','Bereken je rendement',50),
  ('permitting-analysis','Vergunningsanalyse','report','Vergunningskans en bestemmingsplan-conformiteit.','{developer,investor}','vanaf €499','https://aquier.com/producten','Check je vergunningskans',60),
  ('financing-report','Financieringsrapport','report','Capital stack, LTV en DSCR-modellering.','{developer,institutional,financier}','vanaf €2.500','https://aquier.com/producten','Modelleer je financiering',70),
  ('mandaat-explorer','Mandaat I — Explorer','membership','Marktscreening, go/no-go, basisroutes, €1k/m² filter.','{investor,agent,dealfinder}','€199/mnd of €1.910/jr','https://aquier.com/membership?tier=explorer','Word Explorer-member',80),
  ('mandaat-developer','Mandaat II — Developer','membership','Capital stack, vergunningen per gemeente, white-label rapporten, 20 analyses/mnd, 3 seats.','{developer,institutional}','€299/mnd of €2.989/jr','https://aquier.com/membership?tier=developer','Word Developer-member',90),
  ('mandaat-warroom','Mandaat III — WarRoom (Black)','membership','Exclusieve dealflow, elite/distressed objecten.','{investor,institutional,family_office}','op aanvraag','https://aquier.com/membership','Vraag WarRoom-toegang',100),
  ('mandaat-capital-desk','Mandaat IV — Capital Desk','membership','Multi-user governance, private deal rooms, API-toegang, success manager.','{institutional,family_office,financier}','op aanvraag','https://aquier.com/contact?type=institutional','Neem contact op — Capital Desk',110),
  ('mandaat-track-record','Mandaat V — Track Record & Private Deal Room','membership','Private deal-samenwerking en mandaatbegeleiding (op uitnodiging).','{institutional,family_office}','op uitnodiging','https://aquier.com/institutional','Bekijk Track Record',120),
  ('kansenradar','Kansenradar™','marketplace','Live deal-monitoring en scoring-engine.','{investor,developer,agent,dealfinder}',null,'https://aquier.com/kansenradar','Open de Kansenradar',130),
  ('marketplace','Deal Flow / Marketplace','marketplace','Gepubliceerde A-klasse deals met scores.','{investor,developer,family_office}',null,'https://aquier.com/marketplace','Bekijk de Marketplace',140),
  ('founding-member','Founding Member Program','program','Eerste 50 leden: founding-tarief + één gratis deal-analyse.','{investor,developer,agent}','founding-tarief','https://aquier.com/founding','Word Founding Member',150),
  ('free-deal-analysis','Gratis Deal-analyse','lead_magnet','Eén object: inkoop vs. turnkey vergelijking (gratis).','{investor,developer,agent,dealfinder}','gratis','https://aquier.com/founding#gratis-analyse','Claim je gratis analyse',160)
on conflict (sku) do update set
  name=excluded.name, kind=excluded.kind, description=excluded.description,
  audiences=excluded.audiences, price=excluded.price, url=excluded.url,
  cta=excluded.cta, sort=excluded.sort, updated_at=now();
