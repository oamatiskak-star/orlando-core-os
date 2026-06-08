-- ============================================================================
-- Migration 126: Hermes Autopilot — Governance + beslissings-audit (Fase F3)
-- ============================================================================
-- F3 = classifier + governance in DRY-RUN. De autopilot-hook beslist al
-- (hard default-deny), maar F3 maakt de policy expliciet/bewerkbaar en logt
-- ELKE beslissing auditbaar, zodat Orlando ziet wat Hermes zou doen vóór F4.

create schema if not exists hermes;

-- 1. Governance-regels: de policy (bewerkbaar, auditbaar) -------------------
create table if not exists hermes.governance_rules (
  id          bigint generated always as identity primary key,
  kind        text not null,                 -- tool_permission | bash | numbered | confirm | press_enter | open
  matcher     text not null default 'tool'   -- tool | bash_prefix | regex
                check (matcher in ('tool', 'bash_prefix', 'regex')),
  pattern     text not null,                 -- 'Read' | 'git status' | regex
  decision    text not null
                check (decision in ('allow', 'ask', 'deny')),
  priority    int not null default 100,
  enabled     boolean not null default true,
  reason      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_governance_rules_enabled on hermes.governance_rules (enabled, priority desc);

-- 2. Beslissings-audit: elke (zou-)keuze van de autopilot -------------------
create table if not exists hermes.autopilot_decisions (
  id           bigint generated always as identity primary key,
  host         text not null default 'unknown',
  session_id   text,
  cwd          text,
  project      text,
  tool_name    text,
  kind         text,                          -- geclassificeerde prompt-soort
  prompt_text  text,
  decision     text not null,                 -- allow | ask | deny (effectief teruggegeven)
  would_allow  boolean not null default false,-- zou auto-goedkeuren als LIVE aan stond
  live         boolean not null default false,-- stond autopilot live?
  matched_rule text,
  reason       text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_autopilot_decisions_created on hermes.autopilot_decisions (created_at desc);
create index if not exists idx_autopilot_decisions_session on hermes.autopilot_decisions (session_id, created_at desc);

-- 3. RPC: hook logt een beslissing -----------------------------------------
create or replace function hermes.log_autopilot_decision(
  p_host text,
  p_session_id text,
  p_cwd text,
  p_project text,
  p_tool_name text,
  p_kind text,
  p_prompt_text text,
  p_decision text,
  p_would_allow boolean,
  p_live boolean,
  p_reason text
) returns bigint
language plpgsql
security definer
set search_path = hermes
as $$
declare v_id bigint;
begin
  insert into autopilot_decisions
    (host, session_id, cwd, project, tool_name, kind, prompt_text, decision, would_allow, live, reason)
  values
    (coalesce(p_host, 'unknown'), p_session_id, p_cwd, p_project, p_tool_name, p_kind,
     left(coalesce(p_prompt_text, ''), 500), coalesce(p_decision, 'ask'),
     coalesce(p_would_allow, false), coalesce(p_live, false), p_reason)
  returning id into v_id;
  return v_id;
end $$;

comment on function hermes.log_autopilot_decision is
  'F3: log één autopilot-beslissing (auditbaar). Wordt door hermes-autopilot.sh aangeroepen.';

-- 4. Read-only view voor het dashboard -------------------------------------
create or replace view hermes.v_autopilot_recent as
  select id, created_at, host, project, tool_name, kind, decision, would_allow, live,
         left(prompt_text, 120) as prompt, reason
  from hermes.autopilot_decisions
  order by created_at desc;

-- 5. Grants ----------------------------------------------------------------
grant usage on schema hermes to service_role, authenticated;
grant execute on function hermes.log_autopilot_decision(text, text, text, text, text, text, text, text, boolean, boolean, text)
  to service_role, authenticated;
grant select on hermes.governance_rules, hermes.autopilot_decisions, hermes.v_autopilot_recent
  to service_role, authenticated;
grant insert, update on hermes.autopilot_decisions to service_role;
grant insert, update, delete on hermes.governance_rules to service_role;

-- 6. Seed: de policy die de hook hanteert (hard default-deny) ---------------
insert into hermes.governance_rules (kind, matcher, pattern, decision, priority, reason)
select v.kind, v.matcher, v.pattern, v.decision, v.priority, v.reason
from (values
  ('tool_permission', 'tool', 'Read',         'allow', 100, 'read-only bestand lezen'),
  ('tool_permission', 'tool', 'Glob',         'allow', 100, 'read-only zoeken'),
  ('tool_permission', 'tool', 'Grep',         'allow', 100, 'read-only zoeken'),
  ('tool_permission', 'tool', 'LS',           'allow', 100, 'read-only listing'),
  ('tool_permission', 'tool', 'NotebookRead', 'allow', 100, 'read-only notebook'),
  ('tool_permission', 'tool', 'TodoWrite',    'allow', 100, 'lokale takenlijst, veilig'),
  ('bash', 'bash_prefix', 'ls',         'allow', 90, 'read-only shell'),
  ('bash', 'bash_prefix', 'cat',        'allow', 90, 'read-only shell'),
  ('bash', 'bash_prefix', 'head',       'allow', 90, 'read-only shell'),
  ('bash', 'bash_prefix', 'tail',       'allow', 90, 'read-only shell'),
  ('bash', 'bash_prefix', 'pwd',        'allow', 90, 'read-only shell'),
  ('bash', 'bash_prefix', 'grep',       'allow', 90, 'read-only shell'),
  ('bash', 'bash_prefix', 'rg',         'allow', 90, 'read-only shell'),
  ('bash', 'bash_prefix', 'git status', 'allow', 90, 'read-only git'),
  ('bash', 'bash_prefix', 'git log',    'allow', 90, 'read-only git'),
  ('bash', 'bash_prefix', 'git diff',   'allow', 90, 'read-only git'),
  ('bash', 'bash_prefix', 'git show',   'allow', 90, 'read-only git')
) as v(kind, matcher, pattern, decision, priority, reason)
where not exists (
  select 1 from hermes.governance_rules g
  where g.kind = v.kind and g.matcher = v.matcher and g.pattern = v.pattern
);

comment on migration is
  'Hermes Autopilot F3 — governance + beslissings-audit:
   - hermes.governance_rules: bewerkbare policy (allow/ask/deny per tool/bash/regel)
   - hermes.autopilot_decisions: auditlog van elke (zou-)beslissing (dry-run zichtbaar)
   - hermes.log_autopilot_decision(): RPC die de hook aanroept
   - hermes.v_autopilot_recent: dashboard-view
   - Seed = hard default-deny allowlist (read-only tools + read-only bash).';
