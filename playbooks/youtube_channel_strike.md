---
slug: youtube_channel_strike
title: YouTube channel strike
project: YouTube Engine
incident: true
triggers: [youtube_content_audit]
match: strike, copyright, community, guidelines, kanaal, geblokkeerd, geschorst
resolves_locally: true
---

# Playbook — YouTube channel strike

**Project:** YouTube Engine · **Incident:** true

## Vereiste resources
- **Skills:** youtube_content_audit
- **Agents:** youtube-ceo-agent
- **Boards:** operator, contrarian

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Type strike: copyright, community guidelines, of monetisatie?
2. Welke video triggerde het? Uit content-audit halen.
3. Bezwaar-/hersteltermijn checken.
4. Andere kanalen op zelfde patroon scannen.

## Escalatieregels
- Lokaal classificeren; GPT voor bezwaartekst-concept. Claude niet nodig.

## Verboden acties
- Geen automatische re-upload van geflagde content.
- Geen kanaal-acties zonder Orlando-goedkeuring.
