-- ─────────────────────────────────────────────────────────────────────────
-- Migration 224 — Backlink Factory seed (aquier.com)
-- ─────────────────────────────────────────────────────────────────────────
-- Eerste targetlijst: owned (instant) + SaaS/AI/NL-directories + communities.
-- Tier 1 = vloer-prioriteit (snelste discovery + DR). target_page = pillar.
-- Idempotent (on conflict (site,name) do nothing).

insert into public.backlink_targets (name, category, url, domain_rating, dofollow, cost, tier, target_page) values
  -- Owned (gratis, vandaag — ook cruciaal voor crawl-DISCOVERY van de 94 'unknown to Google')
  ('YouTube kanaalbeschrijvingen (9 kanalen)','owned','https://youtube.com',100,false,'free',1,'/'),
  ('LinkedIn bedrijfspagina','owned','https://www.linkedin.com',98,false,'free',1,'/'),
  ('Substack nieuwsbrief','owned','https://substack.com',91,true,'free',1,'/kennisbank'),
  ('X (Twitter) profiel','owned','https://x.com',96,false,'free',1,'/'),
  ('Crunchbase company','directory_saas','https://www.crunchbase.com',91,false,'free',1,'/'),
  -- SaaS / startup directories
  ('Product Hunt','directory_saas','https://www.producthunt.com',91,false,'free',1,'/'),
  ('BetaList','directory_saas','https://betalist.com',71,false,'freemium',2,'/'),
  ('SaaSHub','directory_saas','https://www.saashub.com',72,true,'free',1,'/'),
  ('AlternativeTo','directory_saas','https://alternativeto.net',88,true,'free',1,'/'),
  ('G2','directory_saas','https://www.g2.com',92,false,'free',2,'/'),
  ('Capterra','directory_saas','https://www.capterra.com',91,false,'free',2,'/'),
  ('GetApp','directory_saas','https://www.getapp.com',88,false,'free',3,'/'),
  ('SaaSworthy','directory_saas','https://www.saasworthy.com',70,true,'free',2,'/'),
  ('StackShare','directory_saas','https://stackshare.io',82,false,'free',3,'/'),
  ('Slant','directory_saas','https://www.slant.co',79,true,'free',3,'/'),
  ('SideProjectors','directory_saas','https://www.sideprojectors.com',55,true,'free',3,'/'),
  -- AI directories
  ('There''s An AI For That','directory_ai','https://theresanaiforthat.com',80,false,'freemium',1,'/'),
  ('Futurepedia','directory_ai','https://www.futurepedia.io',74,false,'freemium',2,'/'),
  ('Future Tools','directory_ai','https://www.futuretools.io',72,false,'free',2,'/'),
  ('Toolify.ai','directory_ai','https://www.toolify.ai',70,true,'freemium',2,'/'),
  ('AIxploria','directory_ai','https://www.aixploria.com',65,true,'free',3,'/'),
  ('Insidr AI Tools','directory_ai','https://www.insidr.ai',58,true,'free',3,'/'),
  ('Bilarna (vastgoed-intelligence)','directory_ai','https://bilarna.com',45,true,'free',1,'/'),
  -- NL / EU
  ('Startuplijst.nl','directory_nl','https://www.startuplijst.nl',48,true,'free',1,'/'),
  ('StartupJuncture','directory_nl','https://startupjuncture.com',58,true,'free',2,'/'),
  ('Dutch Startup Jobs / Silicon Canals','directory_nl','https://siliconcanals.com',74,true,'freemium',2,'/'),
  ('Bedrijvengids (NL business listing)','directory_nl','https://www.bedrijvenpagina.nl',40,true,'free',2,'/'),
  ('Vastgoedjournaal (PR)','pr','https://www.vastgoedjournaal.nl',66,true,'free',1,'/'),
  ('Quote / Sprout (PR-pitch)','pr','https://www.sprout.nl',70,true,'free',2,'/'),
  -- Communities (alleen met echte waarde — geen spam)
  ('Reddit r/beleggen','community','https://www.reddit.com/r/beleggen',91,false,'free',2,'/kennisbank'),
  ('Reddit r/DutchFIRE','community','https://www.reddit.com/r/DutchFIRE',91,false,'free',2,'/kennisbank'),
  ('Indie Hackers','community','https://www.indiehackers.com',82,false,'free',3,'/'),
  ('Hacker News (Show HN)','community','https://news.ycombinator.com',91,false,'free',3,'/'),
  ('BiggerPockets forum','community','https://www.biggerpockets.com',83,false,'free',3,'/gids/netto-rendement-verhuur-berekenen')
on conflict (site, name) do nothing;
