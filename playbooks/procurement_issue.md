---
slug: procurement_issue
title: Inkoopprobleem
project: STRKBOUW
incident: false
triggers: [procurement_review]
match: inkoop, materiaal, prijs, leverancier, bestelling
resolves_locally: true
---

# Playbook — Inkoopprobleem

**Project:** STRKBOUW · **Incident:** false

## Vereiste resources
- **Skills:** procurement_review
- **Agents:** procurement-agent
- **Boards:** operator, investor

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Prijsstijging, levertijd of kwaliteit?
2. Vergelijk 2-3 leveranciers.
3. Optimaal inkoopmoment.
4. Voorraad vs just-in-time.

## Escalatieregels
- Lokaal; GPT voor onderhandelingsstrategie. Claude niet nodig.

## Verboden acties
- Geen langlopend contract zonder investor-board check.
