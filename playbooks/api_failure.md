---
slug: api_failure
title: API-storing
project: Vastgoed Core OS
incident: true
triggers: [backend_review]
match: api, endpoint, 500, error, response, faalt, route
resolves_locally: true
---

# Playbook — API-storing

**Project:** Vastgoed Core OS · **Incident:** true

## Vereiste resources
- **Skills:** backend_review
- **Agents:** data-engineer, expert-nextjs-developer
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke route? 4xx (client) of 5xx (server)?
2. Exacte faalregel uit de log.
3. Env-var/secret ontbreekt?
4. Upstream (DB/extern) down?

## Escalatieregels
- Lokaal; Claude bij handler-code-fix.

## Verboden acties
- Geen secrets in responses/logs.
