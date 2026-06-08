---
slug: database_failure
title: Database-storing
project: Vastgoed Core OS
incident: true
triggers: [backend_review]
match: database, supabase, query, connectie, postgres, down, traag
resolves_locally: true
---

# Playbook — Database-storing

**Project:** Vastgoed Core OS · **Incident:** true

## Vereiste resources
- **Skills:** backend_review
- **Agents:** data-engineer, expert-nextjs-developer
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Connectie of query? Pool uitgeput?
2. Juiste project (orlando-core-os, niet legacy)?
3. RLS/policy blokkeert?
4. Migratie-mismatch (code verwacht kolom die ontbreekt)?

## Escalatieregels
- Lokaal; Claude bij query/schema-fix.
- Prod-migratie = HARDE GATE.

## Verboden acties
- Geen DROP/ALTER op prod zonder approval.
- Geen service_role-key loggen.
