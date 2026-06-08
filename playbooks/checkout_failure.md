---
slug: checkout_failure
title: Checkout werkt niet
triggers: [checkout_review, conversion_audit]
incident: true
match: checkout, afrekenen, bestelproces, account aanmaken, activatie, guest
project: Aquier
resolves_locally: true
---

# Playbook — Checkout werkt niet

## 1. Symptomen
- Checkout-knop reageert niet / pagina blijft laden / account wordt niet aangemaakt na betaling.

## 2. Deterministische checks (lokaal)
1. Frontend-fout: console-errors op de checkout-pagina? Netwerk-call naar de backend faalt (4xx/5xx)?
2. `project_id`/`company_id` aanwezig in de request (komt uit backend, nooit hardcoded)?
3. Guest-checkout: maakt de webhook ná betaling een account aan + verstuurt activatie-mail?
4. Edge-cases: dubbele submit, ontbrekend e-mailadres, ongeldige coupon.

## 3. Fix-pad
- Backend-validatie-fout → exacte faalregel uit de API-log.
- Activatie-mail-pad herstellen (webhook → account → mail).

## 4. Escalatiecriterium
- GPT als checks geen oorzaak geven.
- Claude bij code-fix in de checkout-flow.
- Geen Stripe-live/prod-migratie zonder approval-gate.
