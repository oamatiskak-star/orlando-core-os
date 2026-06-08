---
slug: asset_cashflow_issue
title: Asset-cashflow probleem
project: STRKBEHEER
incident: false
triggers: [asset_cashflow_review]
match: cashflow, pand, rendement, huur, kosten, negatief
resolves_locally: true
---

# Playbook — Asset-cashflow probleem

**Project:** STRKBEHEER · **Incident:** false

## Vereiste resources
- **Skills:** asset_cashflow_review
- **Agents:** finance-controller-agent
- **Boards:** investor, ceo

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welk pand heeft negatieve/lage cashflow?
2. Huurinkomsten vs vaste lasten + onderhoud.
3. Leegstand of achterstallige huur?
4. Rendement vs benchmark.

## Escalatieregels
- Lokaal analyseren; GPT voor scenario's. Claude niet nodig.

## Verboden acties
- Geen verkoop/herfinanciering-advies zonder Orlando.
