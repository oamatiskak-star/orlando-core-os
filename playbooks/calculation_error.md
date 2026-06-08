---
slug: calculation_error
title: Calculatiefout
project: SterkCalc
incident: true
triggers: [calculation_qa, stabu_calculation]
match: calculatie, fout, hoeveelheid, klopt niet, rekenfout, begroting
resolves_locally: true
---

# Playbook — Calculatiefout

**Project:** SterkCalc · **Incident:** true

## Vereiste resources
- **Skills:** calculation_qa, stabu_calculation
- **Agents:** calculation-qa-agent
- **Boards:** contrarian, operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke post/hoofdstuk wijkt af? Hoeveelheid vs eenheidsprijs.
2. Opslagen (AK/ABK/W&R) correct toegepast?
3. Regionale prijsvariatie meegenomen?
4. Invoer vs STABU-structuur consistent?

## Escalatieregels
- QA-skill lokaal; GPT alleen bij twijfel over normbedrag. Claude niet nodig.

## Verboden acties
- Geen offerte versturen vóór QA-akkoord.
- Geen prijzen hardcoden.
