---
slug: youtube_upload_failure
title: YouTube upload faalt
project: YouTube Engine
incident: true
triggers: [youtube_upload_pipeline]
match: youtube, upload, faalt, mislukt, queue, render, ffmpeg
resolves_locally: true
---

# Playbook — YouTube upload faalt

**Project:** YouTube Engine · **Incident:** true

## Vereiste resources
- **Skills:** youtube_upload_pipeline
- **Agents:** youtube-ceo-agent, youtube-analytics-agent
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Queue-status: hoeveel jobs queued/failed/manual_review (youtube_upload_queue)?
2. Faaloorzaak classificeren: ffmpeg input weg, OAuth unauthorized, of render-timeout?
3. Bronbestanden aanwezig (niet weg na /tmp/T7-opruiming)?
4. OAuth-status van het kanaal (terminale auth-fout?).

## Escalatieregels
- Eerst playbook + janitor-ronde. GPT alleen als oorzaak onduidelijk.
- Claude alleen bij worker-code-fix.

## Verboden acties
- Geen bulk-retry zonder broncheck (verspilt quota).
- Geen prod-deploy zonder approval-gate.
