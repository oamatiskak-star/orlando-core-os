-- ============================================================================
-- Migration 140: Hermes Routing — Feedback-loop (FASE 5) + Skill-metadata (FASE 6)
-- ============================================================================
-- Additief op mig 139. Geen wijziging public.* behalve grants.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FASE 5 — routing_learning (feedback-loop: leert welke combinaties werken)
-- ----------------------------------------------------------------------------
create table if not exists hermes.routing_learning (
  id             uuid primary key default gen_random_uuid(),
  plan_id        uuid references hermes.routing_plans(id) on delete set null,
  request_id     uuid references hermes.routing_requests(id) on delete set null,
  company_id     uuid not null,
  problem_type   text,                                  -- incident-kind / project / 'general'
  active_project text,
  chosen_skills  jsonb not null default '[]'::jsonb,
  chosen_agents  jsonb not null default '[]'::jsonb,
  chosen_boards  jsonb not null default '[]'::jsonb,
  models_used    jsonb not null default '[]'::jsonb,    -- [{layer,provider,model}]
  confidence     numeric(4,3),
  escalation     text,                                  -- 'local' | 'gpt' | 'claude' | 'council'
  playbook       text,                                  -- gematchte playbook-slug (FASE 3)
  success        boolean,                               -- null tot bekend (feedback)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists hermes_routing_learning_problem_idx on hermes.routing_learning (problem_type, created_at desc);
create index if not exists hermes_routing_learning_project_idx on hermes.routing_learning (active_project, created_at desc);

alter table hermes.routing_learning enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='routing_learning' and policyname='service_role_full') then
    create policy "service_role_full" on hermes.routing_learning as permissive for all to service_role using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='hermes' and tablename='routing_learning' and policyname='auth_read') then
    create policy "auth_read" on hermes.routing_learning for select to authenticated using (true);
  end if;
end $$;
drop trigger if exists trg_routing_learning_touch on hermes.routing_learning;
create trigger trg_routing_learning_touch before update on hermes.routing_learning
  for each row execute function hermes.touch_updated_at();
grant all on hermes.routing_learning to service_role;
grant select on hermes.routing_learning to authenticated;

-- Aggregatie-view: best presterende combinaties per probleemtype (voor leren).
create or replace view hermes.v_routing_learning_stats as
select
  problem_type,
  active_project,
  count(*)                                          as runs,
  count(*) filter (where success is true)           as successes,
  count(*) filter (where success is false)          as failures,
  round(avg(confidence)::numeric, 3)                as avg_confidence,
  mode() within group (order by escalation)         as common_escalation
from hermes.routing_learning
group by problem_type, active_project;
grant select on hermes.v_routing_learning_stats to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- FASE 6 — Skill-metadata: verrijk de 16 bestaande governance-skills
--          (hint/category/project/priority/reversible/target_host/boards/agents)
-- ----------------------------------------------------------------------------
update hermes.skills s set metadata = s.metadata || m.meta
from (values
  ('analytics',             '{"hint":"funnel conversie analytics meting cijfers dashboard","category":"analytics","project":"Marketing","priority":"P2","reversible":true,"target_host":"cli-r","boards":["growth","operator"],"agents":["data-analyst"]}'::jsonb),
  ('capital_matching',      '{"hint":"financiering kapitaal match project investeerder lening","category":"finance","project":"Vastgoed Core OS","priority":"P2","reversible":true,"target_host":"cli-l","boards":["investor","ceo"],"agents":["finance-controller-agent"]}'::jsonb),
  ('commercial_validation', '{"hint":"koper validatie persona vertrouwen zou ik betalen conversie azijn","category":"conversion","project":"Aquier","priority":"P1","reversible":true,"target_host":"cli-r","boards":["customer","contrarian"],"agents":["content-marketer"]}'::jsonb),
  ('content',               '{"hint":"content tekst genereren artikel post gegrond","category":"marketing","project":"Marketing","priority":"P3","reversible":true,"target_host":"cli-r","boards":["growth"],"agents":["content-marketer"]}'::jsonb),
  ('discovery',             '{"hint":"route discovery feature ontdekken registry orphan","category":"backend","project":"Vastgoed Core OS","priority":"P3","reversible":true,"target_host":"cli-r","boards":["operator"],"agents":["backend_agent"]}'::jsonb),
  ('entitlement',           '{"hint":"product tier capability entitlement toegang abonnement","category":"backend","project":"Vastgoed Core OS","priority":"P2","reversible":true,"target_host":"cli-r","boards":["operator"],"agents":["backend_agent"]}'::jsonb),
  ('finance',              '{"hint":"finance readiness capital desk financiering begroting score","category":"finance","project":"Vastgoed Core OS","priority":"P2","reversible":true,"target_host":"cli-l","boards":["investor","ceo"],"agents":["finance-controller-agent"]}'::jsonb),
  ('flow_test',             '{"hint":"flow test persona simulatie doorloop scenario","category":"qa","project":"Vastgoed Core OS","priority":"P2","reversible":true,"target_host":"cli-r","boards":["operator","customer"],"agents":["frontend_agent"]}'::jsonb),
  ('marketing',             '{"hint":"marketing campagne orchestratie distributie","category":"marketing","project":"Marketing","priority":"P3","reversible":true,"target_host":"cli-r","boards":["growth"],"agents":["content-marketer"]}'::jsonb),
  ('project_intelligence',  '{"hint":"project completeness risico financierbaarheid duiding","category":"risk","project":"Vastgoed Core OS","priority":"P2","reversible":true,"target_host":"cli-l","boards":["investor","contrarian"],"agents":["risk-manager"]}'::jsonb),
  ('repair',                '{"hint":"repair patch fix migratie herstel suggestie","category":"backend","project":"Vastgoed Core OS","priority":"P1","reversible":false,"target_host":"cli-r","boards":["operator"],"agents":["backend_agent"]}'::jsonb),
  ('route_audit',           '{"hint":"route integriteit orphan dead-route audit navigatie","category":"backend","project":"Vastgoed Core OS","priority":"P2","reversible":true,"target_host":"cli-r","boards":["operator"],"agents":["backend_agent"]}'::jsonb),
  ('seo',                   '{"hint":"seo keyword onderzoek on-page vindbaarheid ranking google","category":"seo","project":"Marketing","priority":"P2","reversible":true,"target_host":"cli-r","boards":["growth"],"agents":["seo-specialist"]}'::jsonb),
  ('social',                '{"hint":"social media distributie facebook youtube affiliate","category":"marketing","project":"Marketing","priority":"P3","reversible":true,"target_host":"cli-r","boards":["growth"],"agents":["content-marketer"]}'::jsonb),
  ('ui_audit',              '{"hint":"ui design consistentie ux readiness audit interface","category":"frontend","project":"Vastgoed Core OS","priority":"P2","reversible":true,"target_host":"cli-r","boards":["operator","customer"],"agents":["frontend_agent"]}'::jsonb),
  ('validation',            '{"hint":"validatie route flow ai validation errors checken","category":"qa","project":"Vastgoed Core OS","priority":"P2","reversible":true,"target_host":"cli-r","boards":["operator"],"agents":["backend_agent"]}'::jsonb)
) as m(name, meta)
where s.name = m.name and not (s.metadata ? 'hint');

-- Vul ook category/project/priority op de 10 routing-skills uit mig 139 (hadden hint maar geen category).
update hermes.skills set metadata = metadata || jsonb_build_object('category', c.cat, 'project', c.proj, 'priority', c.prio)
from (values
  ('payment_diagnostics','payments','Aquier','P1'),
  ('conversion_audit','conversion','Aquier','P1'),
  ('seo_audit','seo','Marketing','P2'),
  ('checkout_review','payments','Aquier','P1'),
  ('legal_review','legal','Administratie','P2'),
  ('build_tracker_review','ops','Vastgoed Core OS','P2'),
  ('risk_review','risk','Vastgoed Core OS','P2'),
  ('frontend_review','frontend','Vastgoed Core OS','P2'),
  ('backend_review','backend','Vastgoed Core OS','P2'),
  ('scaling_review','scaling','Vastgoed Core OS','P3')
) as c(name, cat, proj, prio)
where hermes.skills.name = c.name and not (metadata ? 'category');
