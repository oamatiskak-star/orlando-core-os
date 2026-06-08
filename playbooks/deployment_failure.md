---
slug: deployment_failure
title: Deployment mislukt
triggers: [backend_review, scaling_review]
incident: true
match: deployment, deploy, build mislukt, vercel, render, docker, ci, pipeline
project: Vastgoed Core OS
resolves_locally: true
---

# Playbook — Deployment mislukt

## 1. Symptomen
- Vercel/Render-build faalt, service down na deploy, of `update_failed`.

## 2. Deterministische checks (lokaal)
1. Build-log: exacte faalregel (TS-fout breekt `next build`; ontbrekende dep; env-var mist).
2. Env-vars: nieuwe var nodig die niet in Vercel/Render staat?
3. Migratie-volgorde: code verwacht een DB-migratie die nog niet is toegepast.
4. Docker: image-build-fout op CLI-R (cache, dependency).
5. Health na deploy: draait het proces, antwoordt het health-endpoint?

## 3. Veelvoorkomende oorzaken (historie)
- TS-fout in frontend → `next build` faalt.
- Render-service `update_failed` op een specifieke PR-deploy → bron fixen, redeploy.
- Migratie niet toegepast vóór code-deploy.

## 4. Fix-pad
- Build-log oorzaak fixen, daarna gerichte redeploy.
- Render: `infra_watchdog_incidents.logs_tail` ophalen, bron fixen, incident sluiten.

## 5. Escalatiecriterium
- Claude bij code/architectuur-fix. Prod-deploy/promote = HARDE GATE → approval.
