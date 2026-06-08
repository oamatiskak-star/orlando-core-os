---
slug: youtube_oauth_token_failure
title: YouTube OAuth-token verlopen
project: YouTube Engine
incident: true
triggers: [youtube_oauth_health]
match: youtube, oauth, token, verlopen, unauthorized, kanaal, verbinden
resolves_locally: true
---

# Playbook — YouTube OAuth-token verlopen

**Project:** YouTube Engine · **Incident:** true

## Vereiste resources
- **Skills:** youtube_oauth_health
- **Agents:** youtube-ceo-agent
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke kanalen tonen reconnect_required / unauthorized_client?
2. Eigen oauth_client_id per kanaal gezet, of fallback naar globale env?
3. OAuth consent screen in Testing (7-daagse tokens) of Production?
4. client_id/secret-naam harmonisatie (YOUTUBE_OAUTH_CLIENT_ID vs YOUTUBE_CLIENT_ID).

## Escalatieregels
- Lokaal diagnosticeren; reconnect = handmatige Orlando-actie (browser-consent).
- GPT/Claude niet nodig (config, geen code).

## Verboden acties
- Niet optimistisch oauth_connected=true schrijven zonder echte API-test.
- Geen tokens loggen.
