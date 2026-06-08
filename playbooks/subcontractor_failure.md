---
slug: subcontractor_failure
title: Onderaannemer faalt
project: STRKBOUW
incident: true
triggers: [subcontractor_review]
match: onderaannemer, zzp, uitval, kwaliteit, planning
resolves_locally: true
---

# Playbook — Onderaannemer faalt

**Project:** STRKBOUW · **Incident:** true

## Vereiste resources
- **Skills:** subcontractor_review
- **Agents:** construction-project-manager, hr-workforce-agent
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Uitval, kwaliteitsprobleem of planningsconflict?
2. Vervangende capaciteit beschikbaar?
3. Certificaten/veiligheidsdocumenten op orde?
4. Contractuele gevolgen.

## Escalatieregels
- Lokaal; GPT voor herplanning. Claude niet nodig.

## Verboden acties
- Geen vervanger inzetten zonder geldige certificaten.
