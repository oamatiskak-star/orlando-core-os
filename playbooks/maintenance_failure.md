---
slug: maintenance_failure
title: Onderhoud faalt
project: STRKBEHEER
incident: true
triggers: [maintenance_review]
match: onderhoud, reparatie, storing, installatie, defect
resolves_locally: true
---

# Playbook — Onderhoud faalt

**Project:** STRKBEHEER · **Incident:** true

## Vereiste resources
- **Skills:** maintenance_review
- **Agents:** procurement-agent
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke installatie/defect? Urgentie?
2. Onder garantie/contract?
3. Beschikbare vakman + kosten.
4. Tijdelijke mitigatie.

## Escalatieregels
- Lokaal; GPT voor leverancierskeuze. Claude niet nodig.

## Verboden acties
- Geen spoedopdracht boven mandaat zonder approval.
