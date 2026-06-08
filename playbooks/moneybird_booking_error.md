---
slug: moneybird_booking_error
title: Moneybird-boeking klopt niet
project: Administratie
incident: true
triggers: [moneybird_accounting_review]
match: moneybird, boeking, klopt niet, grootboek, factuur, btw
resolves_locally: true
---

# Playbook — Moneybird-boeking klopt niet

**Project:** Administratie · **Incident:** true

## Vereiste resources
- **Skills:** moneybird_accounting_review
- **Agents:** finance-controller-agent, document-agent
- **Boards:** investor, operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke boeking/grootboekrekening wijkt af?
2. BTW-code/-percentage correct?
3. Dubbele of ontbrekende boeking?
4. Koppeling bank/factuur (matching) juist?

## Escalatieregels
- Lokaal afhandelen; GPT zelden nodig. Claude niet nodig.

## Verboden acties
- Geen correctieboeking zonder controle.
- Geen aanpassing in afgesloten periode zonder akkoord.
