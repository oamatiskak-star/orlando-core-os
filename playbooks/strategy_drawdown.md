---
slug: strategy_drawdown
title: Strategie drawdown
project: Trading Engine
incident: true
triggers: [portfolio_risk_review]
match: drawdown, verlies, strategie, risico, portfolio, daalt
resolves_locally: true
---

# Playbook — Strategie drawdown

**Project:** Trading Engine · **Incident:** true

## Vereiste resources
- **Skills:** portfolio_risk_review
- **Agents:** quant-analyst, risk-manager
- **Boards:** investor, contrarian

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Drawdown-omvang vs historische max?
2. Eén positie of systeembreed?
3. Strategie buiten regime (markt veranderd)?
4. Stop-loss/de-risk geactiveerd?

## Escalatieregels
- Lokaal + GPT-second-opinion; Claude bij modelwijziging.

## Verboden acties
- Geen positie vergroten om verlies in te halen.
- Geen strategiewijziging zonder backtest.
