---
slug: market_data_feed_failure
title: Datafeed faalt
project: Trading Engine
incident: true
triggers: [market_data_feed_check]
match: datafeed, koers, markt, feed, verbinding, werkt niet, api
resolves_locally: true
---

# Playbook — Datafeed faalt

**Project:** Trading Engine · **Incident:** true

## Vereiste resources
- **Skills:** market_data_feed_check
- **Agents:** data-engineer
- **Boards:** operator

## Eerste diagnostische stappen (lokaal, geen LLM)
1. Welke feed/bron is down? Laatste timestamp?
2. API-key/rate-limit/quotum?
3. Netwerk of provider-zijde?
4. Fallback-bron beschikbaar?

## Escalatieregels
- Lokaal; Claude alleen bij feed-adapter-code-fix.

## Verboden acties
- Geen handel op stale/onbetrouwbare data.
