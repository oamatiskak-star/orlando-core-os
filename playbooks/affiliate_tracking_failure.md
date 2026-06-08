---
slug: affiliate_tracking_failure
title: Affiliate tracking faalt
project: Affiliate Engine
incident: true
triggers: [affiliate_tracking_review]
match: affiliate, tracking, link, klik, conversie, werkt niet, pixel
resolves_locally: true
---

# Playbook — Affiliate tracking faalt

**Project:** Affiliate Engine · **Incident:** true

## Vereiste resources
- **Skills:** affiliate_tracking_review
- **Agents:** sales-crm-agent, data-analyst
- **Boards:** growth, operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Klikken geregistreerd? Pixel/tag geladen?
2. UTM/attributie-parameters correct?
3. Consent-gate blokkeert tracking?
4. Postback/webhook van het netwerk binnen?

## Escalatieregels
- Lokaal diagnosticeren; Claude alleen bij tracking-code-fix.

## Verboden acties
- Geen consent-bypass.
- Geen PII in tracking-events.
