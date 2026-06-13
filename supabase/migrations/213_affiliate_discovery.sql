-- 213 — Affiliate Discovery (continue crawler — zichtbaarheid + planner)
-- De schema's bestaan al (affiliate_programs, affiliate_import_runs, affiliate_api_connectors).
-- Wat ontbrak: een CONTINUE discovery-crawler die netwerken afzoekt en nieuwe programma's
-- importeert (affiliate_import_runs = 0 → crawler draaide nooit). CLI-R levert: de
-- config-gedreven worker (local-agent/src/affiliate-discovery.ts), Engine-Planner-registratie
-- en deze zichtbaarheids-views. Het daadwerkelijk DRAAIEN (netwerktoegang + credentials)
-- is runtime, CLI-L lane (L3) + research-sourcing (L6).

-- ── discovery-run-historie ──────────────────────────────────────────────────
create or replace view public.v_affiliate_discovery_runs as
select
  ir.id,
  ir.network,
  ir.source,
  ir.rows_received,
  ir.rows_imported,
  ir.rows_skipped,
  ir.ran_at,
  ir.detail,
  case
    when ir.detail->>'error' is not null then 'error'
    when ir.rows_imported > 0 then 'imported'
    when ir.rows_received = 0 then 'empty'
    else 'no_new'
  end as outcome
from public.affiliate_import_runs ir
order by ir.ran_at desc nulls last;

comment on view public.v_affiliate_discovery_runs is
  'Discovery-crawl historie per netwerk: ontvangen/geïmporteerd/overgeslagen + outcome.';

-- ── netwerk/portefeuille-overzicht ──────────────────────────────────────────
create or replace view public.v_affiliate_network_overview as
select
  coalesce(nullif(p.category,''), 'onbekend')                 as network_category,
  count(*)                                                    as programs,
  count(*) filter (where p.media_relevant)                    as media_relevant,
  count(*) filter (where p.recurring)                         as recurring,
  count(*) filter (where p.api_available)                     as api_available,
  round(avg(nullif(p.rpm_equiv,0)), 2)                        as avg_rpm_equiv,
  round(avg(nullif(p.avg_epc,0)), 2)                          as avg_epc,
  round(sum(coalesce(p.revenue_potential,0)), 0)              as revenue_potential,
  max(p.updated_at)                                           as last_seen
from public.affiliate_programs p
group by 1
order by revenue_potential desc nulls last, programs desc;

comment on view public.v_affiliate_network_overview is
  'Affiliate-portefeuille per categorie: programma-aantallen, media-relevantie, EPC/RPM, omzetpotentie.';

-- ── connector-gezondheid (bron voor de crawler) ─────────────────────────────
create or replace view public.v_affiliate_connector_health as
select
  c.id,
  c.provider,
  c.base_url,
  c.auth_type,
  c.credential_env,
  c.enabled,
  c.last_sync_at,
  c.last_sync_status,
  c.last_error,
  p.name as program_name
from public.affiliate_api_connectors c
left join public.affiliate_programs p on p.id = c.program_id
order by c.enabled desc, c.last_sync_at desc nulls last;

comment on view public.v_affiliate_connector_health is
  'Connector-status die de discovery-crawler aanstuurt (provider/auth/credential_env/laatste sync).';

-- ── Engine Planner-registratie (VUISTREGEL) ─────────────────────────────────
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled)
values ('affiliate:discovery', 'media', 'Affiliate Discovery — continue crawler', 'acq_ai', true)
on conflict (engine_key) do nothing;
