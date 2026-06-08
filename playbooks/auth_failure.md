---
slug: auth_failure
title: Auth-storing
project: Vastgoed Core OS
incident: true
triggers: [backend_review]
match: auth, login, token, rls, supabase, sessie, 401
resolves_locally: true
---

# Playbook — Auth-storing

**Project:** Vastgoed Core OS · **Incident:** true

## Vereiste resources
- **Skills:** backend_review
- **Agents:** data-engineer, expert-nextjs-developer
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Auth-provider bereikbaar? Anon/service-key correct project?
2. Key-rotatie zonder env-update?
3. Redirect/site-URL correct?
4. RLS blokkeert eerste read?

## Escalatieregels
- Lokaal; Claude bij auth/RLS-code-fix.

## Verboden acties
- Geen RLS uitzetten op prod.
- Geen keys loggen.
