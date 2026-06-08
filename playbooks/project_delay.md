---
slug: project_delay
title: Bouwproject vertraging
project: STRKBOUW
incident: true
triggers: [project_delay_review]
match: vertraging, bouwproject, achterstand, planning, kritiek pad, deadline
resolves_locally: true
---

# Playbook — Bouwproject vertraging

**Project:** STRKBOUW · **Incident:** true

## Vereiste resources
- **Skills:** project_delay_review
- **Agents:** construction-project-manager
- **Boards:** ceo, operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke taak op het kritieke pad loopt achter?
2. Oorzaak: levering, weer, onderbezetting, vergunning?
3. Impact op opleverdatum.
4. Herplannings-opties.

## Escalatieregels
- Lokaal plannen; GPT voor scenario-afweging. Claude niet nodig.

## Verboden acties
- Geen toezeggingen aan klant zonder Orlando-akkoord.
