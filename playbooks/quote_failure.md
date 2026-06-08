---
slug: quote_failure
title: Offerte genereren faalt
project: SterkCalc
incident: true
triggers: [quote_review]
match: offerte, mislukt, genereren, marge, fout
resolves_locally: true
---

# Playbook — Offerte genereren faalt

**Project:** SterkCalc · **Incident:** true

## Vereiste resources
- **Skills:** quote_review
- **Agents:** calculation-qa-agent, construction-cost-agent
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Faalt de berekening of de generatie (PDF)?
2. Ontbrekende invoervelden / lege posten?
3. Marge/opslag-config aanwezig?
4. Template-fout?

## Escalatieregels
- Lokaal; Claude alleen bij generatie-code-fix.

## Verboden acties
- Geen offerte met 0-posten versturen.
