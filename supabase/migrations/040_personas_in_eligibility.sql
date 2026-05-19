-- 040_personas_in_eligibility.sql
-- Verbreedt planning_is_orchestrator_eligible() zodat persona-namen
-- uit agent_personas ook triggeren naast de generieke aliases.

create or replace function public.planning_is_orchestrator_eligible(toegewezen text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $f$
declare
  v_normalized text := lower(coalesce(toegewezen, ''));
begin
  if v_normalized = '' then return false; end if;

  -- Bestaande generieke aliases blijven werken
  if v_normalized in ('claude-code', 'ai', 'orchestrator') then
    return true;
  end if;

  -- Persona-namen (case-insensitive)
  return exists (
    select 1 from public.agent_personas
    where lower(name) = v_normalized
  );
end
$f$;
