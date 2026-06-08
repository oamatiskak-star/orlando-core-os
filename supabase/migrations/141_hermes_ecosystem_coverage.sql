-- ============================================================================
-- Migration 141: Hermes Ecosystem Coverage Upgrade (FASE 2/3/4)
-- ============================================================================
-- Additief. Breekt niets: enable bestaande skills, voeg nieuwe toe, repareer
-- dangling agent-refs. Geen wijziging aan routing/confidence/council/playbooks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FASE 4 — dangling agent-refs repareren (backend_agent / frontend_agent
--          bestaan niet in .claude/agents). Map naar echte agents.
--          backend_agent → data-engineer ; frontend_agent → expert-nextjs-developer
-- ----------------------------------------------------------------------------
update hermes.skills set metadata = jsonb_set(
  metadata, '{agents}',
  (select jsonb_agg(distinct v) from (
     select case
       when a = 'backend_agent'  then 'data-engineer'
       when a = 'frontend_agent' then 'expert-nextjs-developer'
       else a end as v
     from jsonb_array_elements_text(metadata->'agents') a
   ) z)
)
where metadata ? 'agents'
  and ((metadata->'agents') ? 'backend_agent' or (metadata->'agents') ? 'frontend_agent');

-- ----------------------------------------------------------------------------
-- FASE 2 — 16 governance-skills activeren (metadata al compleet via mig 140)
-- ----------------------------------------------------------------------------
update hermes.skills set enabled = true
where name in ('analytics','capital_matching','commercial_validation','content','discovery',
  'entitlement','finance','flow_test','marketing','project_intelligence','repair','route_audit',
  'seo','social','ui_audit','validation');

-- ----------------------------------------------------------------------------
-- FASE 3 — nieuwe ecosysteem-skills (32). Volledige metadata, echte agents.
-- ----------------------------------------------------------------------------
insert into hermes.skills (name, version, checksum, description, input_schema, output_schema, enabled, metadata)
select v.name, '1.0.0', encode(sha256(v.name::bytea),'hex'), v.descr,
  '{"type":"object","properties":{"context":{"type":"string"},"company_id":{"type":"string"}}}'::jsonb,
  '{"type":"object","properties":{"findings":{"type":"array","items":{"type":"string"}},"recommendation":{"type":"string"}}}'::jsonb,
  true, v.meta::jsonb
from (values
  -- SterkCalc
  ('stabu_calculation','STABU-calculatie: hoofdstukken/posten mappen en valideren.','{"hint":"stabu calculatie hoofdstuk post mapping bouwdeel begroting","category":"calculation","project":"SterkCalc","priority":"P1","reversible":true,"target_host":"cli-r","boards":["operator","investor"],"agents":["construction-cost-agent","calculation-qa-agent"]}'),
  ('construction_cost_estimate','Bouwkosten-raming: m2-prijs, casco/turnkey, installaties.','{"hint":"bouwkosten m2 prijs raming casco turnkey installaties verbouwkosten","category":"calculation","project":"SterkCalc","priority":"P1","reversible":true,"target_host":"cli-r","boards":["investor","operator"],"agents":["construction-cost-agent"]}'),
  ('quote_review','Offerte-review: marges, opslagen (AK/ABK/W&R), controle.','{"hint":"offerte review marge opslag ak abk controle prijs","category":"calculation","project":"SterkCalc","priority":"P1","reversible":true,"target_host":"cli-r","boards":["operator","investor"],"agents":["calculation-qa-agent"]}'),
  ('calculation_qa','Calculatie-QA: hoeveelheden, fouten, validatie vóór verzending.','{"hint":"calculatie controle hoeveelheden fouten validatie offerte qa","category":"qa","project":"SterkCalc","priority":"P1","reversible":true,"target_host":"cli-r","boards":["contrarian","operator"],"agents":["calculation-qa-agent"]}'),
  ('pdf_quote_diagnostics','PDF-offerte genereren: render-/document-fouten diagnosticeren.','{"hint":"pdf offerte genereren rapport document fout render","category":"backend","project":"SterkCalc","priority":"P2","reversible":true,"target_host":"cli-r","boards":["operator"],"agents":["document-agent","construction-cost-agent"]}'),
  -- STRKBOUW
  ('construction_planning','Bouwplanning: deadlines, mijlpalen, bouwteam, fasering.','{"hint":"bouwplanning deadline mijlpaal bouwteam fasering planning bouw","category":"ops","project":"STRKBOUW","priority":"P2","reversible":true,"target_host":"cli-l","boards":["ceo","operator"],"agents":["construction-project-manager"]}'),
  ('procurement_review','Inkoop-review: materiaalprijzen, leveranciers, inkoopmoment.','{"hint":"inkoop materiaal prijs leverancier vergelijken bestellen procurement","category":"procurement","project":"STRKBOUW","priority":"P2","reversible":true,"target_host":"cli-l","boards":["operator","investor"],"agents":["procurement-agent"]}'),
  ('subcontractor_review','Onderaannemer-review: planning, kwaliteit, ZZP-contract.','{"hint":"onderaannemer zzp planning kwaliteit contract subcontractor","category":"ops","project":"STRKBOUW","priority":"P2","reversible":true,"target_host":"cli-l","boards":["operator","contrarian"],"agents":["construction-project-manager","hr-workforce-agent"]}'),
  ('project_delay_review','Bouwvertraging: kritiek pad, achterstand, herplanning.','{"hint":"vertraging bouwproject planning achterstand kritiek pad delay","category":"ops","project":"STRKBOUW","priority":"P1","reversible":true,"target_host":"cli-l","boards":["ceo","operator"],"agents":["construction-project-manager"]}'),
  ('supplier_failure_review','Leveranciersfalen: levering mislukt, materiaaltekort.','{"hint":"leverancier levering mislukt materiaal tekort vertraging supplier","category":"procurement","project":"STRKBOUW","priority":"P1","reversible":true,"target_host":"cli-l","boards":["operator","contrarian"],"agents":["procurement-agent"]}'),
  -- STRKBEHEER
  ('property_management','Vastgoedbeheer: panden, huurders, beheer-overzicht.','{"hint":"vastgoedbeheer pand huurder beheer onderhoud property","category":"ops","project":"STRKBEHEER","priority":"P2","reversible":true,"target_host":"cli-l","boards":["operator","ceo"],"agents":["executive-dashboard-agent","document-agent"]}'),
  ('tenant_review','Huurder-review: meldingen, klachten, contracten.','{"hint":"huurder melding klacht contract verhuur tenant","category":"ops","project":"STRKBEHEER","priority":"P2","reversible":true,"target_host":"cli-l","boards":["customer","operator"],"agents":["document-agent","hr-workforce-agent"]}'),
  ('maintenance_review','Onderhoud-review: reparaties, installaties, storingen.','{"hint":"onderhoud reparatie pand installatie storing maintenance","category":"ops","project":"STRKBEHEER","priority":"P2","reversible":true,"target_host":"cli-l","boards":["operator"],"agents":["procurement-agent"]}'),
  ('asset_cashflow_review','Asset-cashflow: rendement, huurinkomsten, kosten per pand.','{"hint":"cashflow pand rendement huurinkomsten kosten asset","category":"finance","project":"STRKBEHEER","priority":"P2","reversible":true,"target_host":"cli-l","boards":["investor","ceo"],"agents":["finance-controller-agent"]}'),
  ('holding_dashboard_review','Holding-dashboard: BV-structuur, KPI-overzicht.','{"hint":"holding dashboard overzicht bv structuur kpi","category":"ops","project":"STRKBEHEER","priority":"P3","reversible":true,"target_host":"cli-l","boards":["ceo","investor"],"agents":["executive-dashboard-agent"]}'),
  -- YouTube Engine
  ('youtube_upload_pipeline','YouTube upload-pipeline: queue, gefaalde jobs, render.','{"hint":"youtube upload pipeline queue wachtrij gefaald render mislukt","category":"ops","project":"YouTube Engine","priority":"P1","reversible":true,"target_host":"cli-r","boards":["operator"],"agents":["youtube-ceo-agent","youtube-analytics-agent"]}'),
  ('youtube_oauth_health','YouTube OAuth-gezondheid: tokens, kanaal-herverbinding.','{"hint":"youtube oauth token verlopen kanaal verbinden client unauthorized","category":"ops","project":"YouTube Engine","priority":"P1","reversible":true,"target_host":"cli-r","boards":["operator"],"agents":["youtube-ceo-agent"]}'),
  ('youtube_content_audit','YouTube content-audit: ideeën, scripts, retentie, hooks.','{"hint":"youtube content idee script retentie hook video audit","category":"content","project":"YouTube Engine","priority":"P2","reversible":true,"target_host":"cli-r","boards":["growth"],"agents":["content-research-agent","script-agent"]}'),
  ('youtube_thumbnail_review','Thumbnail-review: CTR, ontwerp, A/B-varianten.','{"hint":"thumbnail ctr ontwerp variant a/b youtube","category":"content","project":"YouTube Engine","priority":"P2","reversible":true,"target_host":"cli-r","boards":["growth","customer"],"agents":["thumbnail-agent"]}'),
  ('youtube_channel_growth','Kanaalgroei: subscribers, algoritme, viral, SEO.','{"hint":"youtube groei subscribers algoritme viral seo kanaal","category":"growth","project":"YouTube Engine","priority":"P2","reversible":true,"target_host":"cli-r","boards":["growth"],"agents":["youtube-growth-hacker","youtube-seo-expert"]}'),
  -- Affiliate Engine
  ('affiliate_program_audit','Affiliate-programma-audit: registratie, commissie, netwerk.','{"hint":"affiliate programma registratie commissie netwerk audit","category":"marketing","project":"Affiliate Engine","priority":"P2","reversible":true,"target_host":"cli-l","boards":["growth","investor"],"agents":["sales-crm-agent"]}'),
  ('affiliate_payout_review','Affiliate-payout-review: uitbetalingen, commissie, verdiensten.','{"hint":"affiliate payout uitbetaling commissie verdiensten","category":"finance","project":"Affiliate Engine","priority":"P1","reversible":true,"target_host":"cli-l","boards":["investor","operator"],"agents":["finance-controller-agent"]}'),
  ('affiliate_account_setup','Affiliate-account-setup: registratie/aanmelding programma.','{"hint":"affiliate account aanmaken registratie aanmelden programma setup","category":"ops","project":"Affiliate Engine","priority":"P2","reversible":true,"target_host":"cli-l","boards":["operator"],"agents":["sales-automator","email-operations-agent"]}'),
  ('affiliate_tracking_review','Affiliate-tracking: links, kliks, conversie, attributie.','{"hint":"affiliate tracking link klik conversie attributie pixel","category":"analytics","project":"Affiliate Engine","priority":"P1","reversible":true,"target_host":"cli-r","boards":["growth","operator"],"agents":["sales-crm-agent","data-analyst"]}'),
  -- Trading Engine
  ('trade_signal_review','Trade-signaal-review: strategie, indicatoren, entry/exit.','{"hint":"trading signaal strategie indicator entry exit trade","category":"analytics","project":"Trading Engine","priority":"P2","reversible":true,"target_host":"cli-l","boards":["investor","contrarian"],"agents":["quant-analyst"]}'),
  ('portfolio_risk_review','Portfolio-risico: exposure, drawdown, allocatie, VaR.','{"hint":"portfolio risico exposure drawdown allocatie var","category":"risk","project":"Trading Engine","priority":"P1","reversible":true,"target_host":"cli-l","boards":["investor","contrarian"],"agents":["quant-analyst","risk-manager"]}'),
  ('market_data_feed_check','Markt-datafeed-check: koersen, feed-verbinding, API.','{"hint":"datafeed koers markt data feed verbinding api trading","category":"backend","project":"Trading Engine","priority":"P1","reversible":true,"target_host":"cli-r","boards":["operator"],"agents":["data-engineer"]}'),
  ('strategy_backtest_review','Strategie-backtest: historische validatie, Sharpe, rendement.','{"hint":"backtest strategie historisch sharpe rendement validatie","category":"analytics","project":"Trading Engine","priority":"P2","reversible":true,"target_host":"cli-l","boards":["investor","scale"],"agents":["quant-analyst"]}'),
  -- Administratie
  ('moneybird_accounting_review','Moneybird-boekhouding: boekingen, grootboek, facturen.','{"hint":"moneybird boeking boekhouding factuur grootboek administratie","category":"finance","project":"Administratie","priority":"P2","reversible":true,"target_host":"cli-l","boards":["investor","operator"],"agents":["finance-controller-agent","document-agent"]}'),
  ('tax_deadline_review','Belasting-deadline: BTW, aangiftetermijnen, fiscaal.','{"hint":"btw belasting deadline aangifte termijn fiscaal","category":"finance","project":"Administratie","priority":"P1","reversible":true,"target_host":"cli-l","boards":["investor","contrarian"],"agents":["finance-controller-agent"]}'),
  ('invoice_flow_review','Factuurflow: openstaande debiteuren, betalingen, herinneringen.','{"hint":"factuur flow openstaand debiteur betaling herinnering","category":"finance","project":"Administratie","priority":"P2","reversible":true,"target_host":"cli-l","boards":["operator","investor"],"agents":["finance-controller-agent","email-operations-agent"]}'),
  ('fixed_cost_review','Vaste-kosten-review: abonnementen, uitgaven, besparing.','{"hint":"vaste kosten abonnement uitgaven besparing overzicht","category":"finance","project":"Administratie","priority":"P2","reversible":true,"target_host":"cli-l","boards":["investor","ceo"],"agents":["finance-controller-agent"]}')
) as v(name, descr, meta)
on conflict (name, version) do update
  set description = excluded.description, enabled = excluded.enabled,
      input_schema = excluded.input_schema, output_schema = excluded.output_schema,
      metadata = excluded.metadata;
