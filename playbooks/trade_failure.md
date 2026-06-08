---
slug: trade_failure
title: Trade faalt
project: Trading Engine
incident: true
triggers: [trade_signal_review, portfolio_risk_review]
match: trade, order, mislukt, uitvoering, positie
resolves_locally: true
---

# Playbook — Trade faalt

**Project:** Trading Engine · **Incident:** true

## Vereiste resources
- **Skills:** trade_signal_review, portfolio_risk_review
- **Agents:** quant-analyst
- **Boards:** investor, operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Order afgewezen door exchange of strategie-fout?
2. Saldo/marge voldoende?
3. API-verbinding/rate-limit?
4. Risico-limiet geraakt?

## Escalatieregels
- Lokaal; GPT voor strategie-review. Claude alleen bij code-fix.

## Verboden acties
- Geen live-order zonder risico-check (HARDE GATE).
- Geen positie boven exposure-limiet.
