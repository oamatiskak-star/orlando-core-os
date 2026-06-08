---
slug: conversion_audit
title: Conversie-audit
triggers: [conversion_audit, commercial_validation]
incident: false
match: conversie, cro, funnel, cta, frictie, verkoopt niet, would buy, homepage
project: Aquier
resolves_locally: true
---

# Playbook — Conversie-audit (CRO)

Mobiel-primair (werving = mobiel; mobiele conversie = meetlat).

## 1. Funnel-checks (lokaal)
1. Boven de vouw: duidelijke waardepropositie + 1 primaire CTA?
2. Frictie: aantal velden, verplichte stappen, laadtijd mobiel.
3. Vertrouwen: social proof / bewijs zichtbaar (named bewijs > grote PNG)?
4. Prijs-helderheid en risico-omkering (garantie/try).
5. Mobiele weergave: CTA bereikbaar zonder scrollen, leesbaar bewijs.

## 2. Meetbaarheid
- Is conversie meetbaar (events: cta_clicked, consent-gate correct)?

## 3. Output
- Top-frictiepunten + concrete fixes, geprioriteerd op mobiele impact.

## 4. Escalatiecriterium
- Lokaal model levert de audit. GPT als second opinion op de prioritering. Claude alleen bij code-fix aan de pagina.
