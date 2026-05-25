-- ─────────────────────────────────────────────────────────────────────────
-- Migration 087 — AQUIER_USA_DOMINATION_ENGINE agent personas (FASE 8)
-- ─────────────────────────────────────────────────────────────────────────
-- 10 nieuwe specialist-personas voor de USA Domination Engine. Volgt het
-- pattern uit 039_agent_personas_and_chain.sql. Status = 'offline' tot hun
-- engine draait (geen fake activiteit — no mock).
--   config.code  = systeem-code (owner_agent referentie in aquier_projects)
--   config.project = AQUIER_USA_DOMINATION_ENGINE
-- ─────────────────────────────────────────────────────────────────────────

insert into public.agent_personas (name, persona_type, role, authority, description, icon, capabilities, status, config) values
  ('Conquest',   'specialist', 'usa acquisition intelligence', 'supervisor',
     'Coordinator van de USA Domination Engine; stuurt alle USA-intelligence agents aan', 'Crosshair',
     array['usa','intelligence','orchestration'], 'offline',
     jsonb_build_object('code','CONQUEST-USA','project','AQUIER_USA_DOMINATION_ENGINE')),
  ('Surge',      'specialist', 'seo dominator', 'operator',
     'Genereert + bewaakt USA SEO-pages, alternative/comparison pages, schema en internal linking', 'Search',
     array['seo','content','schema'], 'offline',
     jsonb_build_object('code','SURGE-SEO','project','AQUIER_USA_DOMINATION_ENGINE','section','seo_expansion')),
  ('Radar',      'specialist', 'acquisition radar', 'operator',
     'Detecteert high-probability acquisitiekansen op basis van gestackte signalen', 'Radar',
     array['acquisition','scoring','radar'], 'offline',
     jsonb_build_object('code','RADAR-ACQ','project','AQUIER_USA_DOMINATION_ENGINE','section','acquisition_radar')),
  ('Falcon',     'specialist', 'hedge fund monitor', 'operator',
     'Volgt institutionele/hedge fund koopactiviteit en deal-patronen in de VS', 'Landmark',
     array['institutional','hedgefund','tracking'], 'offline',
     jsonb_build_object('code','FALCON-HF','project','AQUIER_USA_DOMINATION_ENGINE','section','investor_intelligence')),
  ('Vulture',    'specialist', 'distressed deal', 'operator',
     'Distressed/foreclosure/tax-delinquency opportunity detectie en scoring', 'TriangleAlert',
     array['distressed','foreclosure','signals'], 'offline',
     jsonb_build_object('code','VULTURE-DIST','project','AQUIER_USA_DOMINATION_ENGINE','section','signal_stacking')),
  ('Domus',      'specialist', 'multifamily analytics', 'operator',
     'Multifamily absorptie, rental growth en build-to-rent analyse per metro', 'Building2',
     array['multifamily','rental','analytics'], 'offline',
     jsonb_build_object('code','DOMUS-MF','project','AQUIER_USA_DOMINATION_ENGINE','section','signal_stacking')),
  ('Funnelytics','specialist', 'funnel intelligence', 'operator',
     'Funnel/conversie-intelligence, CTA-optimalisatie en investor-segmentatie', 'Filter',
     array['funnel','conversion','segmentation'], 'offline',
     jsonb_build_object('code','FUNNEL-INT','project','AQUIER_USA_DOMINATION_ENGINE','section','funnel_engine')),
  ('Augur',      'specialist', 'trend prediction', 'operator',
     'USA markt/migratie/investor trend-detectie en voorspelling', 'TrendingUp',
     array['trend','prediction','market'], 'offline',
     jsonb_build_object('code','AUGUR-TREND','project','AQUIER_USA_DOMINATION_ENGINE','section','trend_detection')),
  ('Blaze',      'specialist', 'viral content', 'operator',
     'Viral USA-content detectie en scriptgeneratie voor YouTube/Shorts', 'Flame',
     array['viral','content','youtube'], 'offline',
     jsonb_build_object('code','BLAZE-VIRAL','project','AQUIER_USA_DOMINATION_ENGINE','section','content_engine')),
  ('Psyche',     'specialist', 'investor behavior', 'operator',
     'Analyseert investor-gedrag, koopsignalen en segmentatie voor matching', 'Users',
     array['investor','behavior','matching'], 'offline',
     jsonb_build_object('code','PSYCHE-INV','project','AQUIER_USA_DOMINATION_ENGINE','section','investor_intelligence'))
on conflict (name) do nothing;

-- Competitor Intelligence agent (de eerste die echt draait) — apart benoemd
insert into public.agent_personas (name, persona_type, role, authority, description, icon, capabilities, status, config) values
  ('Spyglass',   'specialist', 'competitor intelligence', 'operator',
     'Analyseert publieke marketing/SEO van US-concurrenten (PropStream/Zillow/CoStar e.a.)', 'Telescope',
     array['competitor','seo','intelligence'], 'offline',
     jsonb_build_object('code','SPYGLASS-CI','project','AQUIER_USA_DOMINATION_ENGINE','section','competitor_intelligence'))
on conflict (name) do nothing;
