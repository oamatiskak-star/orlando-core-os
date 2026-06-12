# S4 — Revenue Engine / attributie · oplevering

> Onderdeel van **AUTONOMOUS GROWTH PHASE 1** (P1). Status: **code-compleet in branch `feat/cf2-stronger-model-track`**, wacht op deploy + migratie 196 + 1 env-var.

## Uitgangspunt (live geverifieerd 12-06)
De affiliate-infra **bestond al** — niet gedupliceerd: tabellen `affiliate_links`/`clicks`/`conversions` (met `content_item_id`+`channel_id`), rijke `video_attribution`, views `v_attribution_channel`/`v_attribution_niche`, click-/link-/conversion-endpoints, en **trigger-functies** `affiliate_revenue_rollup` + `sync_affiliate_to_monetization` (rollen omzet automatisch door bij een conversie-insert → ledger/monetization).

Wat ontbrak voor end-to-end **Kanaal → Video → Klik → Lead → Sale**:
1. **Short-link redirect-handler** — bestond NIET (de click werd nooit aangeroepen → 0 clicks).
2. **Publieke conversie-webhook** — conversion-endpoint vereiste auth → netwerken konden niet posten.
3. **Video-niveau attributie** + funnel-conversieratio's.

## Wat S4 oplevert (deliverables 1-5)

| # | Deliverable | Hoe | Bestand |
|---|---|---|---|
| 1 | Affiliate tracking | **`/r/<code>`** redirect-handler: resolveert short_code → logt klik (link/kanaal/video) → 302. Het ontbrekende instappunt. | `app/r/[code]/route.ts` |
| 2 | Conversion tracking | **Webhook** `/api/media-holding/affiliate-engine/webhook/<network>` — publiek maar secret-gated; schrijft `affiliate_conversions` (triggers rollen omzet door). | `webhook/[network]/route.ts` |
| 3 | Revenue attribution | Bestaande triggers + `video_attribution`; conversie gekoppeld aan klik → video → kanaal. | (hergebruik) |
| 4 | Landing/video attribution | `affiliate_links.content_item_id` (link↔video) + view **`v_attribution_video`** (per-video funnel). | migratie 196 |
| 5 | Funnel performance metrics | View **`v_funnel_performance`** (view→click→lead→sale-ratio's + EPC per kanaal). | migratie 196 |
| + | Dashboard | API `metrics/funnel` + `FunnelAttributionCard` (Views→Klik→Lead→Sale + omzet + top videos). | dashboard |

## De keten sluit
`/r/<code>` (klik + attributie) → `affiliate_clicks` → netwerk-conversie via webhook → `affiliate_conversions` → **triggers** rollen omzet naar ledger + `monetization_metrics` (S1-dashboard). Attributie zichtbaar per video (`v_attribution_video`) en als funnel-ratio's (`v_funnel_performance`).

## Read-only gevalideerd
Views schema-valide tegen live: `v_funnel_performance` = 12 kanalen (16.553 views, 0 clicks/revenue — verwacht, nog geen links/clicks). De pijplijn vult zich zodra links gegenereerd + geklikt worden.

## Realiteit / wat nodig is om data te laten stromen
- **Affiliate-links genereren** (per video) via de bestaande link-UI (nu `content_item_id`-aware) en de `/r/<code>`-links in video-beschrijvingen plaatsen.
- **Webhook activeren**: env-var **`AFFILIATE_WEBHOOK_SECRET`** zetten + per netwerk (PartnerStack/Awin/Amazon/Daisycon) de postback naar `…/webhook/<network>?token=<secret>` configureren. Per-netwerk payload-mapping is een dunne adapter op de genormaliseerde body.
- Dit is — net als YPP bij S1 — een externe activatiestap; de **infrastructuur is compleet en wacht op data**.

## Verificatie na deploy
1. Migratie 196 toepassen; env `AFFILIATE_WEBHOOK_SECRET` zetten.
2. Genereer een testlink (`POST …/affiliate-engine/links` met `content_item_id`), open `/r/<short_code>` → 302 + rij in `affiliate_clicks`.
3. POST een testconversie naar `…/webhook/test?token=<secret>` → rij in `affiliate_conversions` (status pending); triggers vullen ledger/monetization.
4. Dashboard `/dashboard/media-holding/monetization` → "Funnel & attributie"-card toont Views→Klik→Lead→Sale.
5. `select * from v_attribution_video; select * from v_funnel_performance;`

## Niet in scope (volgt)
S5 Director repair (P1), S6 Autonomous growth mode (P2). Per-netwerk webhook-signature-adapters (nu generiek secret-gated). Link-injectie in YouTube-beschrijvingen (raakt publicatie-pijplijn) is een vervolgstap.
