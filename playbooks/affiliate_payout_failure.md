---
slug: affiliate_payout_failure
title: Affiliate payout faalt
project: Affiliate Engine
incident: true
triggers: [affiliate_payout_review]
match: affiliate, payout, uitbetaling, mislukt, commissie
resolves_locally: true
---

# Playbook — Affiliate payout faalt

**Project:** Affiliate Engine · **Incident:** true

## Vereiste resources
- **Skills:** affiliate_payout_review
- **Agents:** finance-controller-agent
- **Boards:** investor, operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke payout faalt? Drempel bereikt?
2. Betaalgegevens/IBAN compleet?
3. Programma-status (account actief)?
4. Commissie-berekening klopt?

## Escalatieregels
- Lokaal; GPT zelden nodig. Claude niet nodig.

## Verboden acties
- Geen live betaalwijziging zonder approval-gate (HARDE GATE).
