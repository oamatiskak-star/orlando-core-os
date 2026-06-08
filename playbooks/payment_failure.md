---
slug: payment_failure
title: Betalingen mislukken
triggers: [payment_diagnostics, checkout_review]
incident: true
match: betaling, betalen, stripe, checkout, afrekenen, mandaat, webhook, prijs
project: Aquier
resolves_locally: true
---

# Playbook — Betalingen mislukken

Doel: betaalprobleem deterministisch diagnosticeren vóór een GPT/Claude-call. Als een stap de oorzaak vindt, is escalatie naar een cloud-model niet nodig.

## 1. Symptomen herkennen
- Klant kan niet afrekenen / checkout hangt / "betaling mislukt".
- Webhook-events komen niet binnen of order blijft `pending`.

## 2. Deterministische checks (lokaal, geen LLM)
1. Stripe-modus: draait de checkout op **live** keys, niet test? Controleer `STRIPE_SECRET_KEY` prefix (`sk_live_`).
2. Webhook-endpoint: bestaat de Stripe-webhook en is de `whsec_` secret correct? Check recente `events` in Stripe-dashboard → afgeleverd?
3. Prijs-id's: bestaan de `price_...` id's nog en zijn ze `active`? Verwijderde/gearchiveerde prices → checkout faalt.
4. Account/koppeling: draait de live checkout onder het juiste account (Bouwproffs Nederland BV)?
5. DB: blijft `orders`/`checkout_sessions` op `pending` ondanks HTTP-200? → webhook-handler faalt stil.

## 3. Veelvoorkomende oorzaken (historie)
- Webhook-secret mismatch na key-rotatie → handler verwerpt events.
- Gearchiveerde Stripe-price → `No such price`.
- Guest-checkout webhook maakt geen account aan → activatie-mail blijft uit.

## 4. Fix-pad
- Webhook-secret herstellen → events opnieuw afspelen (Stripe → resend).
- Price reactiveren of nieuwe price-id in env.
- Webhook-handler-log controleren op de exacte faalregel.

## 5. Escalatiecriterium
- Pas **GPT** (second opinion) als checks 1-5 geen oorzaak geven.
- Pas **Claude** als het om webhook-handler-code/architectuur gaat (code-fix nodig).
- Stripe-live wijziging = HARDE GATE → `hermes.approvals`, niet auto-uitvoeren.
