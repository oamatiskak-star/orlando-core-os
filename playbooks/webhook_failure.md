---
slug: webhook_failure
title: Webhook-storing
project: Vastgoed Core OS
incident: true
triggers: [backend_review, payment_diagnostics]
match: webhook, event, komt niet binnen, stripe, handler, faalt
resolves_locally: true
---

# Playbook — Webhook-storing

**Project:** Vastgoed Core OS · **Incident:** true

## Vereiste resources
- **Skills:** backend_review, payment_diagnostics
- **Agents:** data-engineer, fintech-engineer
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Endpoint bereikbaar? Signing-secret correct?
2. Events afgeleverd volgens provider-dashboard?
3. Handler verwerkt stil fout (HTTP-200 maar geen actie)?
4. Idempotentie/duplicaten?

## Escalatieregels
- Lokaal; Claude bij handler-code-fix.
- Stripe-live = HARDE GATE.

## Verboden acties
- Geen webhook uitschakelen zonder vervanging.
