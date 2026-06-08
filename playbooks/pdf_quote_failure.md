---
slug: pdf_quote_failure
title: PDF-offerte faalt
project: SterkCalc
incident: true
triggers: [pdf_quote_diagnostics]
match: pdf, offerte, genereren, fout, leeg, render
resolves_locally: true
---

# Playbook — PDF-offerte faalt

**Project:** SterkCalc · **Incident:** true

## Vereiste resources
- **Skills:** pdf_quote_diagnostics
- **Agents:** document-agent
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Executor draait laatste build (fpdf2 aanwezig)?
2. Bronbestanden/logo aanwezig?
3. Font/encoding-fout?
4. Output-pad schrijfbaar?

## Escalatieregels
- Lokaal; Claude alleen bij render-code-fix.
- Zelfde patroon als pdf_failure.

## Verboden acties
- Geen executor-redeploy zonder clear-cache check.
