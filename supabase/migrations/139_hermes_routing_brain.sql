-- ============================================================================
-- Migration 139: Hermes Routing Brain — self-routing AI OS (v2)
-- ============================================================================
-- Project: Hermes Core OS v2 (orlando-core-os)
-- Datum:   2026-06-08
-- Auteur:  Orlando + Hermes plan (concurrent-mapping-finch)
--
-- DOEL: het routing-brein dat vóór elke uitvoering bepaalt: project, memory,
--       skills, agents, boards, model, risico's. DB-bemiddeld tussen het Vercel
--       dashboard (schrijft routing_requests) en de lokale orchestrator op CLI-L
--       (claimt + schrijft routing_plans). Additief, observer-first.
--
-- AFHANKELIJK VAN: mig 104 (schema hermes, touch_updated_at, skills),
--                  mig 110 (hosts, dispatch_claim-patroon),
--                  mig 121 (proactive_alerts — hergebruikt voor incidenten).
--
-- GEEN wijziging op public.* tabellen. RLS deny-by-default, service_role full,
-- authenticated read op leesbare tabellen (dashboard).
--
-- ROLLBACK: zie laatste sectie.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. SKILLS — structured routing-hints toevoegen (additief)
--    mig 104 skills heeft geen metadata-kolom; routing heeft hint/host/reversible nodig.
-- ----------------------------------------------------------------------------
alter table hermes.skills add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 1. ROUTING_REQUESTS (inbound — geschreven door chat-route op Vercel)
-- ----------------------------------------------------------------------------
create table if not exists hermes.routing_requests (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  raw_message   text not null,
  source        text not null default 'command-center',
  requested_by  text not null default 'orlando',
  is_incident   boolean not null default false,
  status        text not null default 'queued'
                  check (status in ('queued','claimed','planning','planned','executing','done','failed')),
  claimed_by    text references hermes.hosts(host_id) on delete set null,
  claimed_at    timestamptz,
  heartbeat_at  timestamptz,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists hermes_routing_requests_claimable_idx
  on hermes.routing_requests (is_incident desc, created_at) where status = 'queued';

-- ----------------------------------------------------------------------------
-- 2. ROUTING_PLANS (6-lagen output — geschreven door lokale orchestrator)
-- ----------------------------------------------------------------------------
create table if not exists hermes.routing_plans (
  id                  uuid primary key default gen_random_uuid(),
  request_id          uuid not null references hermes.routing_requests(id) on delete cascade,
  company_id          uuid not null,
  active_project      text,                                    -- LAAG 1
  project_confidence  numeric(4,3),
  context_bundle      jsonb not null default '{}'::jsonb,      -- LAAG 2: {memory_hits[], kv[]}
  candidate_skills    jsonb not null default '[]'::jsonb,      -- LAAG 3
  candidate_agents    jsonb not null default '[]'::jsonb,      -- LAAG 4
  candidate_boards    jsonb not null default '[]'::jsonb,      -- LAAG 5
  preflight_advice    jsonb not null default '{}'::jsonb,      -- {gpt:{...}, claude:{...}}
  final_selection     jsonb not null default '{}'::jsonb,      -- merged skills/agents/boards/order
  priority            text not null default 'P3' check (priority in ('P1','P2','P3')),
  dispatched_actions  jsonb not null default '[]'::jsonb,      -- [{dispatch_queue_id,title,target_host}]
  gated_actions       jsonb not null default '[]'::jsonb,      -- [{approval_id,kind,reason}]
  model_trace         jsonb not null default '[]'::jsonb,      -- [{layer,tier,provider,model,tokens,cost}]
  status              text not null default 'draft'
                        check (status in ('draft','dispatched','gated','done','failed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists hermes_routing_plans_request_idx on hermes.routing_plans (request_id);
create index if not exists hermes_routing_plans_recent_idx on hermes.routing_plans (created_at desc);

-- ----------------------------------------------------------------------------
-- 3. BOARDS (bestuursrol-persona's — LAAG 5)
-- ----------------------------------------------------------------------------
create table if not exists hermes.boards (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,
  label           text not null,
  persona_prompt  text not null,
  enabled         boolean not null default true,
  sort            int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. APPROVALS (HARDE GATE voor onomkeerbare acties)
--    Vercel registreert het besluit; de orchestrator voert pas uit na 'approved'.
-- ----------------------------------------------------------------------------
create table if not exists hermes.approvals (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid references hermes.routing_plans(id) on delete cascade,
  company_id    uuid not null,
  action_kind   text not null
                  check (action_kind in ('stripe_live','prod_db_migration','git_push','vercel_deploy')),
  title         text not null,
  reason        text not null,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected','executed','expired')),
  decided_by    text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists hermes_approvals_pending_idx
  on hermes.approvals (status, created_at) where status in ('pending','approved');

-- ----------------------------------------------------------------------------
-- 5. routing_claim — atomair claimen per host (race-veilig, incidenten eerst)
--    Patroon: mig 110 hermes.dispatch_claim.
-- ----------------------------------------------------------------------------
create or replace function hermes.routing_claim(p_host text, p_limit int default 1)
returns setof hermes.routing_requests
language plpgsql
security definer
set search_path = ''
as $$
begin
  update hermes.hosts set last_seen_at = now(), updated_at = now() where host_id = p_host;

  return query
  with claimable as (
    select r.id
    from hermes.routing_requests r
    where r.status = 'queued'
    order by r.is_incident desc, r.created_at asc
    limit greatest(p_limit, 0)
    for update skip locked
  )
  update hermes.routing_requests r
  set status = 'claimed', claimed_by = p_host, claimed_at = now(),
      heartbeat_at = now(), updated_at = now()
  from claimable c
  where r.id = c.id
  returning r.*;
end $$;

-- ----------------------------------------------------------------------------
-- 6. RLS — service_role full + authenticated read (patroon mig 110)
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['routing_requests','routing_plans','boards','approvals'] loop
    execute format('alter table hermes.%I enable row level security;', t);
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='service_role_full') then
      execute format($p$create policy "service_role_full" on hermes.%I as permissive for all to service_role using (true) with check (true);$p$, t);
    end if;
  end loop;
  -- Dashboard leest plannen/boards/approvals (niet de inbound requests).
  foreach t in array array['routing_plans','boards','approvals'] loop
    if not exists (select 1 from pg_policies where schemaname='hermes' and tablename=t and policyname='auth_read') then
      execute format($p$create policy "auth_read" on hermes.%I for select to authenticated using (true);$p$, t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 7. Triggers + grants
-- ----------------------------------------------------------------------------
drop trigger if exists trg_routing_requests_touch on hermes.routing_requests;
create trigger trg_routing_requests_touch before update on hermes.routing_requests
  for each row execute function hermes.touch_updated_at();
drop trigger if exists trg_routing_plans_touch on hermes.routing_plans;
create trigger trg_routing_plans_touch before update on hermes.routing_plans
  for each row execute function hermes.touch_updated_at();
drop trigger if exists trg_boards_touch on hermes.boards;
create trigger trg_boards_touch before update on hermes.boards
  for each row execute function hermes.touch_updated_at();
drop trigger if exists trg_approvals_touch on hermes.approvals;
create trigger trg_approvals_touch before update on hermes.approvals
  for each row execute function hermes.touch_updated_at();

grant usage on schema hermes to service_role;
grant all on hermes.routing_requests to service_role;
grant all on hermes.routing_plans   to service_role;
grant all on hermes.boards          to service_role;
grant all on hermes.approvals       to service_role;
grant select on hermes.routing_plans to authenticated;
grant select on hermes.boards        to authenticated;
grant select on hermes.approvals     to authenticated;
grant execute on function hermes.routing_claim(text, int) to service_role;

-- ----------------------------------------------------------------------------
-- 8. SEED — boards (7 bestuursrol-persona's)
-- ----------------------------------------------------------------------------
insert into hermes.boards (key, label, persona_prompt, sort) values
  ('ceo',        'CEO',        'Beoordeel als CEO: wat is nu de hoogste prioriteit, wat moet als eerst, en wat kan wachten? Focus en sequencing boven volledigheid.', 1),
  ('investor',   'Investor',   'Beoordeel als investeerder: wat is de ROI, welk risico loop ik, en welk hard bewijs onderbouwt de claim? Geen aannames zonder cijfers.', 2),
  ('contrarian', 'Contrarian', 'Beoordeel als criticus: wat breekt hier, welke aanname is fout, welk faalpad wordt over het hoofd gezien? Probeer het plan te weerleggen.', 3),
  ('customer',   'Customer',   'Beoordeel als klant: waarom zou ik dit kopen, waarom juist niet, en waar zit de frictie in de funnel? Denk mobiel-primair.', 4),
  ('growth',     'Growth',     'Beoordeel als growth-lead: waar zit de groei-hefboom, SEO en distributie? Welk kanaal schaalt het snelst?', 5),
  ('scale',      'Scale',      'Beoordeel als schaal-architect: werkt dit bij 1.000, 10.000 en 100.000 gebruikers? Waar zit de bottleneck bij volume?', 6),
  ('operator',   'Operator',   'Beoordeel als operator: wat zijn de concrete uitvoeringsstappen, wie doet wat, en wat is de eerstvolgende actie? Directe uitvoering.', 7)
on conflict (key) do update
  set label = excluded.label, persona_prompt = excluded.persona_prompt, sort = excluded.sort, updated_at = now();

-- ----------------------------------------------------------------------------
-- 9. SEED — skills (10 routing-skills met echte JSONSchema + checksum + hints)
--    metadata: {hint, target_host, reversible, boards[], agents[]} (routing-laag).
-- ----------------------------------------------------------------------------
insert into hermes.skills (name, version, checksum, description, input_schema, output_schema, enabled, metadata) values
  ('payment_diagnostics', '1.0.0', encode(sha256('payment_diagnostics'::bytea), 'hex'),
   'Diagnose van betaal-/Stripe-flow: webhooks, prices, checkout-sessies, faalredenen.',
   '{"type":"object","required":["company_id"],"properties":{"company_id":{"type":"string"},"symptom":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"root_cause":{"type":"string"},"affected_steps":{"type":"array","items":{"type":"string"}},"fix_proposal":{"type":"string"}}}'::jsonb,
   true,
   '{"hint":"betaling stripe checkout webhook prijs afrekenen mislukt","target_host":"cli-r","reversible":true,"boards":["operator","customer"],"agents":["fintech-engineer","backend_agent"]}'::jsonb),

  ('conversion_audit', '1.0.0', encode(sha256('conversion_audit'::bytea), 'hex'),
   'Conversie-/CRO-audit: funnel, CTA, frictie, mobiele conversie, would-buy.',
   '{"type":"object","required":["target_url"],"properties":{"target_url":{"type":"string"},"audience":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"score":{"type":"number"},"findings":{"type":"array","items":{"type":"string"}},"recommendations":{"type":"array","items":{"type":"string"}}}}'::jsonb,
   true,
   '{"hint":"conversie cro funnel cta frictie landingspagina would buy verkoopt niet","target_host":"cli-r","reversible":true,"boards":["customer","growth"],"agents":["content-marketer","seo-specialist"]}'::jsonb),

  ('seo_audit', '1.0.0', encode(sha256('seo_audit'::bytea), 'hex'),
   'Technische + on-page SEO-audit: meta, structured data, Core Web Vitals, keywords.',
   '{"type":"object","required":["target_url"],"properties":{"target_url":{"type":"string"},"keywords":{"type":"array","items":{"type":"string"}}}}'::jsonb,
   '{"type":"object","properties":{"issues":{"type":"array","items":{"type":"string"}},"keyword_gaps":{"type":"array","items":{"type":"string"}}}}'::jsonb,
   true,
   '{"hint":"seo zoekmachine ranking meta keywords vindbaarheid google indexering","target_host":"cli-r","reversible":true,"boards":["growth"],"agents":["seo-specialist","seo-analyzer"]}'::jsonb),

  ('checkout_review', '1.0.0', encode(sha256('checkout_review'::bytea), 'hex'),
   'Review van de checkout-flow: guest-checkout, account-aanmaak, activatie, edge-cases.',
   '{"type":"object","required":["company_id"],"properties":{"company_id":{"type":"string"},"flow":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"blocking_issues":{"type":"array","items":{"type":"string"}},"ux_issues":{"type":"array","items":{"type":"string"}}}}'::jsonb,
   true,
   '{"hint":"checkout afrekenen account aanmaken activatie bestelproces mandaat","target_host":"cli-r","reversible":true,"boards":["customer","operator"],"agents":["frontend_agent","fintech-engineer"]}'::jsonb),

  ('legal_review', '1.0.0', encode(sha256('legal_review'::bytea), 'hex'),
   'Juridische review: contracten, claims, AVG/GDPR, aansprakelijkheid, bewijslast.',
   '{"type":"object","properties":{"document":{"type":"string"},"context":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"risks":{"type":"array","items":{"type":"string"}},"required_changes":{"type":"array","items":{"type":"string"}}}}'::jsonb,
   true,
   '{"hint":"juridisch contract claim avg gdpr aansprakelijkheid bewijs ingebrekestelling","target_host":"cli-l","reversible":true,"boards":["contrarian","investor"],"agents":["legal-risk-agent"]}'::jsonb),

  ('build_tracker_review', '1.0.0', encode(sha256('build_tracker_review'::bytea), 'hex'),
   'Review van de build-tracker: openstaande taken, blokkades, voortgang per fabriek.',
   '{"type":"object","properties":{"company_id":{"type":"string"},"only_open":{"type":"boolean"}}}'::jsonb,
   '{"type":"object","properties":{"open_items":{"type":"array","items":{"type":"string"}},"blockers":{"type":"array","items":{"type":"string"}}}}'::jsonb,
   true,
   '{"hint":"build tracker taken voortgang fabriek roadmap planning milestone","target_host":"cli-l","reversible":true,"boards":["ceo","operator"],"agents":["project-manager"]}'::jsonb),

  ('risk_review', '1.0.0', encode(sha256('risk_review'::bytea), 'hex'),
   'Risico-review: financieel, operationeel, regelgeving, data-integriteit, faalkans.',
   '{"type":"object","properties":{"subject":{"type":"string"},"context":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"risks":{"type":"array","items":{"type":"object","properties":{"risk":{"type":"string"},"severity":{"type":"string"}}}}}}'::jsonb,
   true,
   '{"hint":"risico gevaar faalkans data-integriteit regelgeving exposure mitigatie","target_host":"cli-l","reversible":true,"boards":["contrarian","investor"],"agents":["risk-manager"]}'::jsonb),

  ('frontend_review', '1.0.0', encode(sha256('frontend_review'::bytea), 'hex'),
   'Frontend-review: UI, rendering, performance, Core Web Vitals, toegankelijkheid.',
   '{"type":"object","properties":{"target_url":{"type":"string"},"component":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"issues":{"type":"array","items":{"type":"string"}},"perf_notes":{"type":"array","items":{"type":"string"}}}}'::jsonb,
   true,
   '{"hint":"frontend ui component rendering performance laadtijd react pagina","target_host":"cli-r","reversible":true,"boards":["operator"],"agents":["frontend_agent","react-performance-optimizer"]}'::jsonb),

  ('backend_review', '1.0.0', encode(sha256('backend_review'::bytea), 'hex'),
   'Backend-review: API, data-pipelines, queries, integriteit, foutafhandeling.',
   '{"type":"object","properties":{"endpoint":{"type":"string"},"context":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"issues":{"type":"array","items":{"type":"string"}},"data_integrity":{"type":"array","items":{"type":"string"}}}}'::jsonb,
   true,
   '{"hint":"backend api database query pipeline endpoint server integriteit","target_host":"cli-r","reversible":true,"boards":["operator"],"agents":["backend_agent","data-engineer"]}'::jsonb),

  ('scaling_review', '1.0.0', encode(sha256('scaling_review'::bytea), 'hex'),
   'Schaal-review: architectuur bij 1k/10k/100k gebruikers, bottlenecks, kosten.',
   '{"type":"object","properties":{"system":{"type":"string"},"target_scale":{"type":"string"}}}'::jsonb,
   '{"type":"object","properties":{"bottlenecks":{"type":"array","items":{"type":"string"}},"scale_plan":{"type":"string"}}}'::jsonb,
   true,
   '{"hint":"schaal scaling 1000 10000 100000 gebruikers bottleneck architectuur volume","target_host":"cli-l","reversible":true,"boards":["scale"],"agents":["ai-architect"]}'::jsonb)
on conflict (name, version) do update
  set checksum = excluded.checksum, description = excluded.description,
      input_schema = excluded.input_schema, output_schema = excluded.output_schema,
      enabled = excluded.enabled, metadata = excluded.metadata;

-- ----------------------------------------------------------------------------
-- 10. ENGINE PLANNER — registreer de orchestrator-poller (verplicht, CLAUDE.md)
--     Event-driven (claimt uit de queue), geen tijdvenster → block_key NULL.
--     Puur informatief in /dashboard/planner; sync_engine_windows toggelt niets
--     omdat er geen bron-flag aan hangt.
-- ----------------------------------------------------------------------------
insert into public.engine_schedule (engine_key, grp, label, block_key, enabled) values
  ('ai:router-orchestrator', 'ai', 'Hermes Routing Brain (orchestrator-poller, event-driven)', null, true)
on conflict (engine_key) do update set label = excluded.label, grp = excluded.grp, updated_at = now();

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- delete from public.engine_schedule where engine_key = 'ai:router-orchestrator';
-- drop function if exists hermes.routing_claim(text,int);
-- drop table if exists hermes.approvals;
-- drop table if exists hermes.routing_plans;
-- drop table if exists hermes.routing_requests;
-- drop table if exists hermes.boards;
-- delete from hermes.skills where name in ('payment_diagnostics','conversion_audit','seo_audit',
--   'checkout_review','legal_review','build_tracker_review','risk_review','frontend_review',
--   'backend_review','scaling_review');
-- alter table hermes.skills drop column if exists metadata;
