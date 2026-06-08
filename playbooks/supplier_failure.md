---
slug: supplier_failure
title: Leverancier faalt
project: STRKBOUW
incident: true
triggers: [supplier_failure_review]
match: leverancier, levering, mislukt, materiaal, tekort, vertraging
resolves_locally: true
---

# Playbook — Leverancier faalt

**Project:** STRKBOUW · **Incident:** true

## Vereiste resources
- **Skills:** supplier_failure_review
- **Agents:** procurement-agent
- **Boards:** operator, contrarian

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke levering/materiaal ontbreekt?
2. Alternatieve leverancier + prijs/levertijd?
3. Impact op bouwplanning.
4. Contract/boete-clausule.

## Escalatieregels
- Lokaal; GPT voor inkoop-alternatieven. Claude niet nodig.

## Verboden acties
- Geen bestelling plaatsen boven mandaat zonder approval.
