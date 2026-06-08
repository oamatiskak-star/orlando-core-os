---
slug: pdf_failure
title: PDF-generatie werkt niet
triggers: [backend_review]
incident: true
match: pdf, rapport genereren, fpdf, rapport, document genereren
project: Aquier
resolves_locally: true
---

# Playbook — PDF-generatie werkt niet

## 1. Symptomen
- Rapport/PDF wordt niet gegenereerd, leeg, of de executor-job faalt.

## 2. Deterministische checks (lokaal)
1. Executor-deploy: draait de laatste build? `fpdf2`-dependency aanwezig na clear-cache deploy?
2. Bronbestanden: bestaan de input-data/afbeeldingen nog (niet weg na schijfopruiming /tmp of T7)?
3. Fonts/encoding: ontbrekende font of niet-latin tekens → render-fout.
4. Geheugen/timeout op de render-worker.
5. Output-pad schrijfbaar?

## 3. Veelvoorkomende oorzaken (historie)
- Render-executor zonder fpdf2 na cache → clear-cache deploy nodig.
- Bronbestanden weg → job onherstelbaar, markeer en regenereer bron.

## 4. Fix-pad
- Executor clear-cache rebuild op Render.
- Bron regenereren, daarna PDF-job opnieuw queue'en.

## 5. Escalatiecriterium
- GPT/Claude pas als de bovenstaande oorzaken zijn uitgesloten; Claude bij render-code-fix.
