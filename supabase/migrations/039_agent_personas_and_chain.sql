-- 039_agent_personas_and_chain.sql
-- Agent Identity Layer — voegt persona-laag toe bovenop bestaande agents
-- en mail_agents/oc_agents tabellen. Persona's zijn leesbare identiteiten
-- (Claude, Magnus, Mr. Franken …) die routing en logs leesbaar maken.
-- Plus de chain-tabel voor sequentiele agent-flows (assigned_chain).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. agent_personas — top-level identity layer
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.agent_personas (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  persona_type    text not null check (persona_type in ('core','business','specialist','human')),
  role            text not null,
  authority       text not null check (authority in ('root','supervisor','operator','observer')),
  description     text,
  icon            text,
  capabilities    text[] not null default '{}',
  workflow_agents uuid[] not null default '{}',
  status          text not null default 'available'
                     check (status in ('available','busy','offline','disabled')),
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_agent_personas_type   on agent_personas(persona_type);
create index if not exists idx_agent_personas_status on agent_personas(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. orchestrator_task_chain — koppelt orchestrator_tasks aan een sequence
--    van personas voor assigned_chain routing
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.orchestrator_task_chain (
  id              uuid primary key default gen_random_uuid(),
  parent_task_id  uuid not null references public.orchestrator_tasks(id) on delete cascade,
  step_order      integer not null,
  persona_name    text not null,
  status          text not null default 'pending'
                     check (status in ('pending','dispatched','completed','failed','skipped')),
  child_task_id   uuid references public.orchestrator_tasks(id) on delete set null,
  started_at      timestamptz,
  finished_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (parent_task_id, step_order)
);

create index if not exists idx_oc_task_chain_parent on orchestrator_task_chain(parent_task_id);
create index if not exists idx_oc_task_chain_status on orchestrator_task_chain(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Seed 20 personas (idempotent via ON CONFLICT DO NOTHING)
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.agent_personas (name, persona_type, role, authority, description, icon, capabilities) values
  ('Claude',      'core',       'executor',                 'operator',   'Builder en uitvoerder van taken; voert code en analyses uit',                                'Cpu',     array['code','analysis','reasoning']),
  ('Nexus',       'core',       'router',                   'supervisor', 'Workflow router; bepaalt welke agent een binnenkomende taak oppakt',                       'GitFork', array['routing','dispatch']),
  ('Sentinel',    'core',       'monitor',                  'supervisor', 'Security en system health monitor; bewaakt alle agents en infrastructuur',                  'Shield',  array['monitor','security']),
  ('Patch',       'core',       'fixer',                    'operator',   'Auto-repair voor errors en failing tasks; herstart, retry, fix',                            'Wrench',  array['fix','retry']),
  ('Chronos',     'core',       'scheduler',                'supervisor', 'Planning en timing van recurring jobs en deadlines',                                        'Clock',   array['schedule','cron']),
  ('Echo',        'core',       'logger',                   'observer',   'Memory en logging laag; archiveert alle activiteit van het systeem',                        'Archive', array['log','memory']),
  ('Magnus',      'business',   'vastgoed intelligence',    'supervisor', 'Coordinator van alle vastgoed-acquisitie agents en deal flow',                              'Building',array['vastgoed','deals','acquisitie']),
  ('Victoria',    'business',   'finance / cashflow',       'supervisor', 'Cashflow, openstaande facturen, BTW deadlines, financieel overzicht',                       'Wallet',  array['cashflow','facturen','btw']),
  ('Ledger',      'business',   'administratie',            'operator',   'Administratieve verwerking, documenten en boekhoudkundige flows',                           'FileText',array['admin','docs']),
  ('Fisk',        'business',   'belasting',                'operator',   'Belastingaangiftes en fiscale optimalisatie',                                               'Receipt', array['belasting','fiscaal']),
  ('Nova',        'business',   'youtube / media',          'supervisor', 'YouTube ecosysteem (5 kanalen) en content distributie',                                      'Video',   array['youtube','content','media']),
  ('Eve',         'business',   'customer support',         'operator',   'Klant-interactie, lead opvolging, helpdesk',                                                'MessageCircle', array['support','crm']),
  ('Mr. Franken', 'specialist', 'AI advocaat',              'operator',   'Juridische analyse, contractbeoordeling, vergunningenkwesties',                             'Scale',   array['legal','contracts']),
  ('Scout',       'specialist', 'scraping',                 'operator',   'Funda, kadaster, gemeente portals en data-scraping',                                        'Search',  array['scrape','data']),
  ('Oracle',      'specialist', 'voorspellingen',           'operator',   'Prognoses, trend-analyses, statistische voorspellingen',                                    'TrendingUp', array['forecast','stats']),
  ('Pulse',       'specialist', 'market scanner',           'operator',   'Realtime markt-bewaking voor vastgoed, crypto, financiele instrumenten',                    'Activity',array['market','realtime']),
  ('Architect',   'specialist', 'systeem architectuur',     'supervisor', 'Code- en infrastructuur architectuur advies',                                               'Layers',  array['architecture','design']),
  ('Orlando',     'human',      'root authority',           'root',       'Eigenaar — eindbeslissing, root authority over het hele systeem',                           'Crown',   array['root']),
  ('Operator',    'human',      'manual approval',          'supervisor', 'Handmatige task approvals en gates',                                                        'UserCheck', array['approve']),
  ('Reviewer',    'human',      'human validation',         'observer',   'Validatie van AI-output voordat deze in productie gaat',                                    'Eye',     array['review','validate'])
on conflict (name) do nothing;
