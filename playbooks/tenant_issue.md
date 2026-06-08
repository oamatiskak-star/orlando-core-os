---
slug: tenant_issue
title: Huurdersmelding
project: STRKBEHEER
incident: true
triggers: [tenant_review]
match: huurder, melding, klacht, storing, contract
resolves_locally: true
---

# Playbook — Huurdersmelding

**Project:** STRKBEHEER · **Incident:** true

## Vereiste resources
- **Skills:** tenant_review
- **Agents:** document-agent, hr-workforce-agent
- **Boards:** customer, operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Type melding: storing, betaling, klacht, contract?
2. Urgentie (veiligheid/bewoonbaarheid)?
3. Verantwoordelijke partij (huurder/verhuurder)?
4. SLA/reactietermijn.

## Escalatieregels
- Lokaal afhandelen; GPT voor klacht-antwoord-concept. Claude niet nodig.

## Verboden acties
- Geen toezegging over kosten zonder eigenaar-akkoord.
