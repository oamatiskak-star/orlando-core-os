---
slug: stabu_mapping_failure
title: STABU-mapping klopt niet
project: SterkCalc
incident: true
triggers: [stabu_calculation]
match: stabu, mapping, klopt niet, hoofdstuk, post, verkeerd, structuur
resolves_locally: true
---

# Playbook — STABU-mapping klopt niet

**Project:** SterkCalc · **Incident:** true

## Vereiste resources
- **Skills:** stabu_calculation
- **Agents:** construction-cost-agent, calculation-qa-agent
- **Boards:** contrarian, operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke post is verkeerd gemapt naar welk STABU-hoofdstuk?
2. Mapping-tabel/bron up-to-date?
3. Nieuwe/onbekende bouwdelen zonder mapping?
4. Steekproef tegen referentie-STABU.

## Escalatieregels
- Lokaal mappen + QA. GPT voor onbekende posten. Claude niet nodig.

## Verboden acties
- Geen automatische her-mapping zonder QA-controle.
