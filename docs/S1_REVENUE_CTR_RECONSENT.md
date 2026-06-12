# S1 — Revenue + CTR ingestion · oplevering + re-consent-stappenplan

> Onderdeel van **AUTONOMOUS GROWTH PHASE 1** (build_tracker: `AUTONOMOUS GROWTH PHASE 1 — Commerciële feedbackloop`, P0).
> Status: **code-compleet in branch `feat/cf2-stronger-model-track`**, wacht op deploy (CI) + 1 handmatige actie (re-consent).

## Wat S1 oplevert

| Deliverable | Bestand | Effect |
|---|---|---|
| CTR-ingestie gefixt | `frontend/app/api/youtube/cron/sync-video-analytics/route.ts` | Cron haalt nu echte `ctr`+`impressions` op (geïsoleerde best-effort call, columnHeaders-parsing). Was hardcoded 0. |
| Revenue-ingestie | idem | Best-effort `estimatedRevenue` → `estimated_revenue` + berekende `rpm` (omzet/1000 views). Degradeert naar 0 tot YPP+scope. |
| Monetary OAuth-scope | `oauth/connect/route.ts`, `media-holding/channels/[id]/credentials/route.ts` | `yt-analytics-monetary.readonly` toegevoegd (nodig voor omzet). |
| Aggregatie + dashboardbron | `supabase/migrations/193_s1_revenue_ctr_aggregation.sql` | Views `v_channel_revenue` (vandaag/7d/30d) + `v_top_videos_revenue`; functie `aggregate_monetization_metrics()`; Engine Planner-rijen. |
| Dashboard | `api/media-holding/metrics/revenue/route.ts` + `monetization/YoutubeRevenueCard.tsx` (+ wired in `MonetizationView.tsx`) | Omzet vandaag/7d/30d + top videos op omzet, met YPP-hint bij €0. |

**Robuustheid:** elke YouTube-Analytics-call is geïsoleerd met `try/null` — een falende CTR- of omzet-call breekt de werkende views/retention-ingestie niet (geen regressie).

## Belangrijke realiteit (bevestigd 12-06)
- Kanalen zitten **nog niet in YPP** → `estimated_revenue`/`rpm` blijven legitiem **€0** tot monetisatie aan staat. Dat is geen bug; de pijplijn vult zich automatisch zodra YPP live is.
- **CTR werkt los van YPP** (heeft alleen `yt-analytics.readonly` nodig, al aanwezig) → CTR moet vullen zodra de gedeployde cron draait.

## Re-consent-stappenplan (jij, eenmalig — pas relevant voor omzetdata)
De nieuwe `yt-analytics-monetary.readonly` scope wordt pas actief na her-autorisatie per kanaal.

1. **Deploy** de branch (CI / merge) zodat de nieuwe scope in de OAuth-flow live staat.
2. Per kanaal (11×) her-autoriseren — kies één:
   - Via dashboard: YouTube-kanaalinstellingen → **Reconnect / Autoriseren**.
   - Of direct: open `https://<APP_URL>/api/youtube/oauth/connect?channel_uuid=<KANAAL_UUID>` en keur de extra permissie **"View monetary data"** goed. (De flow gebruikt al `prompt=consent`, dus de nieuwe scope wordt getoond.)
3. Controleer `youtube_channels.oauth_status = 'connected'` en dat `access_token` ververst is.

> Tot de kanalen in YPP zitten levert stap 2 nog geen omzet op — doe het zodra (of vlak voordat) monetisatie ingaat. CTR vereist deze stap **niet**.

## Verificatie na deploy
1. Trigger de cron handmatig: `GET /api/youtube/cron/sync-video-analytics` met header `Authorization: Bearer <CRON_SECRET>`.
2. Check CTR landt: `select count(*) from youtube_video_analytics where ctr > 0;` → moet > 0 worden.
3. Check dashboard: `/dashboard/media-holding/monetization` toont de "YouTube-omzet (organisch)"-card (omzet €0 + YPP-hint, top videos met views/CTR).
4. (Optioneel) Draai `select public.aggregate_monetization_metrics();` → vult `monetization_metrics` (33 rijen: 11 kanalen × 3 periodes).

## Definition of Done (S1)
- [x] CTR-ingestie-code (geen externe blokker) — **klaar**, vult na deploy+cron-run.
- [x] Revenue-ingestie-code + scope — **klaar**, levert data na re-consent + YPP.
- [x] Dashboard omzet vandaag/7d/30d + top videos — **klaar**.
- [ ] CTR > 0 in productie (na deploy + cron-run) — **te verifiëren post-deploy**.
- [ ] Omzet > 0 (na YPP) — **extern geblokkeerd door YPP-status**, niet door code.

## Niet in scope (volgt in latere fasen)
S2 Learning loop (P0), S3 Winner replication, S4 Revenue engine/attributie, S5 Director repair, S6 Autonomous growth mode.
