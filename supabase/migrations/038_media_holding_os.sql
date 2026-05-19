-- Migration 038: Media Holding OS
-- Phase/module tracking voor de Media Holding OS build

CREATE TABLE media_holding_phases (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fase_nr      smallint NOT NULL UNIQUE,
  naam         text NOT NULL,
  omschrijving text,
  status       text DEFAULT 'pending' CHECK (status IN ('pending','building','active','completed')),
  voortgang    smallint DEFAULT 0,
  focus        text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE TABLE media_holding_modules (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fase_nr      smallint NOT NULL,
  module_key   text NOT NULL UNIQUE,
  naam         text NOT NULL,
  omschrijving text,
  status       text DEFAULT 'pending' CHECK (status IN ('pending','building','live','blocked')),
  route        text,
  gebouwd_door text DEFAULT 'cli-l',
  live_at      timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX mh_phases_status_idx  ON media_holding_phases (status);
CREATE INDEX mh_modules_fase_idx   ON media_holding_modules (fase_nr);
CREATE INDEX mh_modules_status_idx ON media_holding_modules (status);

-- Seed: 6 fases
INSERT INTO media_holding_phases (fase_nr, naam, omschrijving, status, voortgang, focus) VALUES
  (1, 'Cashflow First',            '3 virale Shorts-kanalen, hoge upload-frequentie, 840K views in 10 dagen', 'active',   35,  'cashflow'),
  (2, 'Media Division Structuur',  'Volledige /media-holding directory aanmaken en koppelen aan OS',           'building', 20,  'structuur'),
  (3, 'Dashboard & UX',            'Operationeel dashboard per sectie, visueel en real-time',                 'building', 15,  'dashboard'),
  (4, 'AI System Behavior',        'Viral intelligence, algorithm gravity, competitor surveillance, AI loops', 'pending',  0,   'ai'),
  (5, 'Infrastructure Rules',      'Full logging, traceability, monitoring, mobile responsiveness',           'pending',  0,   'infra'),
  (6, 'Long Term Scale',           'Multilingual, sponsors, affiliates, licensing, media partnerships',       'pending',  0,   'scale');

-- Seed: 20 modules
INSERT INTO media_holding_modules (fase_nr, module_key, naam, omschrijving, status, route, gebouwd_door, live_at) VALUES
  -- Fase 1: Cashflow First
  (1, 'upload-engine',          'Upload Engine',           'Queue, scheduling, retry, upload workers',            'live',     '/dashboard/youtube/queue',           'cli-r', now()),
  (1, 'workers',                'Worker Infra',            'Docker worker services, heartbeat monitoring',         'live',     '/dashboard/infra',                   'cli-r', now()),
  (1, 'channel-incubator',      'Channel Incubator',       '3 kanalen live: SliceTheory, BrickPulse, LoopForge',  'building', '/dashboard/media-holding/channels',  'both',  null),

  -- Fase 2: Structuur
  (2, 'dashboard',              'Media Dashboard',         'Global media overview met live KPIs',                 'building', '/dashboard/media-holding',           'cli-r', null),
  (2, 'settings',               'Media Settings',          'Kanaalconfiguratie, targets, branding, API keys',     'pending',  '/dashboard/media-holding/settings',  'cli-l', null),

  -- Fase 3: Dashboard & UX
  (3, 'content-factory',        'Content Factory',         'Rendering queue, AI generatie, Short batches',        'building', '/dashboard/media-holding/factory',   'cli-l', null),
  (3, 'retention-lab',          'Retention Lab',           'Drop-off analyse, hook performance, replay analyse',  'pending',  '/dashboard/media-holding/retention', 'cli-l', null),
  (3, 'analytics-engine',       'Analytics Engine',        'Views, CTR, RPM, watch time per kanaal',              'pending',  '/dashboard/media-holding/analytics', 'cli-l', null),
  (3, 'cross-platform',         'Cross Platform',          'TikTok, Reels, Snapchat distributie',                 'pending',  '/dashboard/media-holding/cross',     'cli-l', null),

  -- Fase 4: AI
  (4, 'viral-intelligence',     'Viral Intelligence',      'Trending niches, virality scores, saturation alerts', 'pending',  '/dashboard/media-holding/viral',     'cli-l', null),
  (4, 'algorithm-gravity',      'Algorithm Gravity',       'Breakout exploitatie, swarm mode, varianten',         'pending',  '/dashboard/media-holding/gravity',   'cli-l', null),
  (4, 'hook-library',           'Hook Library',            'Best hooks per niche, AI hook generatie',             'pending',  '/dashboard/media-holding/hooks',     'cli-l', null),
  (4, 'audio-intelligence',     'Audio Intelligence',      'Trending sounds, viral audio tracking',               'pending',  '/dashboard/media-holding/audio',     'cli-l', null),
  (4, 'trend-scanner',          'Trend Scanner',           '24/7 niche scanning, velocity spikes detectie',       'pending',  '/dashboard/media-holding/trends',    'cli-l', null),
  (4, 'winner-extraction',      'Winner Extraction',       '1 viral asset → 50 content assets',                  'pending',  '/dashboard/media-holding/winner',    'cli-l', null),
  (4, 'competitor-surveillance','Competitor Surveillance',  'Upload freq, viral spikes, format tracking',          'pending',  '/dashboard/media-holding/compete',   'cli-l', null),

  -- Fase 5: Infrastructure
  (5, 'archives',               'Archives',                'Content archief, logging, audit trail',               'pending',  '/dashboard/media-holding/archives',  'cli-l', null),

  -- Fase 6: Scale
  (6, 'language-expansion',     'Language Expansion',      'Multilingual channels, automatische vertaling',       'pending',  '/dashboard/media-holding/languages', 'cli-l', null),
  (6, 'sponsor-engine',         'Sponsor Engine',          'Sponsor management, deal tracking, revenue',          'pending',  '/dashboard/media-holding/sponsors',  'cli-l', null),
  (6, 'affiliate-engine',       'Affiliate Engine',        'Affiliate links, tracking, revenue attribution',      'pending',  '/dashboard/media-holding/affiliates','cli-l', null);
