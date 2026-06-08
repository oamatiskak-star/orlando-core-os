---
slug: tax_deadline_failure
title: BTW/belasting-deadline gemist
project: Administratie
incident: true
triggers: [tax_deadline_review]
match: btw, belasting, deadline, aangifte, termijn, gemist, fiscaal
resolves_locally: true
---

# Playbook — BTW/belasting-deadline gemist

**Project:** Administratie · **Incident:** true

## Vereiste resources
- **Skills:** tax_deadline_review
- **Agents:** finance-controller-agent
- **Boards:** investor, contrarian

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke aangifte/termijn nadert of is gemist?
2. Benodigde stukken compleet?
3. Verzuimboete-risico inschatten.
4. Uitstel mogelijk?

## Escalatieregels
- Lokaal; GPT voor fiscale afweging. Claude niet nodig.

## Verboden acties
- Geen aangifte indienen zonder Orlando-akkoord.
- Geen schatting als definitieve aangifte boeken.
