---
slug: affiliate_account_setup_failure
title: Affiliate account-setup faalt
project: Affiliate Engine
incident: true
triggers: [affiliate_account_setup]
match: affiliate, account, registratie, aanmelden, mislukt
resolves_locally: true
---

# Playbook — Affiliate account-setup faalt

**Project:** Affiliate Engine · **Incident:** true

## Vereiste resources
- **Skills:** affiliate_account_setup
- **Agents:** sales-automator, email-operations-agent
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke stap faalt: registratie, verificatie, of approval?
2. Vereiste velden/documenten compleet?
3. E-mailverificatie ontvangen (labels/inbox)?
4. Programma accepteert de niche/regio?

## Escalatieregels
- Lokaal + headed-browser co-pilot (approve-only). GPT/Claude niet nodig.

## Verboden acties
- Geen credentials in logs.
- Geen auto-submit zonder Orlando-approve.
