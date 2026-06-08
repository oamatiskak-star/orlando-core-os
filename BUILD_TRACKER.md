# BUILD_TRACKER.md — ENIGE BRON VAN WAARHEID (Aquier + Orlando Core OS)

> **Status:** Gereconcilieerd 2026-06-08 op basis van live bewijs (GitHub PR-states, Supabase shaunum DB, repo-code).
> **Regel:** Dit document is leidend. Geen agent mag een conclusie hieronder opnieuw uitvoeren als deze als
> KLAAR, SUPERSEDED of VERBODEN is gemarkeerd. Bouw alleen verder vanaf wat hier als canoniek staat.
> **Modus van deze reconciliatie:** AUDIT ONLY — geen code, geen deploy, geen migratie uitgevoerd.

**Twee verschillende "upload engines" / "quality gates" — verwar ze NIET:**
- **YouTube-engine (BESTAAND, LIVE):** uploadt nu autonoom (377 uploads/7d). Quality gate = dood in de praktijk.
- **Content Factory 2.0 (NIEUW, PR #148, DRAFT):** spine live in DB maar 0× gedraaid; eigen quality center/gates, inert.

---

## A. KLAAR EN BEWEZEN (met bewijs)

### Aquier — merged PR's (allemaal 2026-06-08, op origin/main)
| Item | Bewijs |
|---|---|
| **PR #110** revenue-stabilization | MERGED 15:09. `lib/email.ts` luide mail-failures (console.error + ntfyAdminAlert, try/catch); `ReportCTA` variant-prop → MembershipCTA = enige gold primary CTA op stad/deal-pagina's. 6 files. |
| **PR #111** report-intake CTA copy | MERGED 15:35. Tekst-only relabel "Bestel/Order"→"Naar brondocumenten" op 5 niet-checkout-knoppen; echte checkout-knoppen ongemoeid. |
| **PR #112** premium naming batch 1 | MERGED 16:46. Labels: KANSENRADAR™→Acquisition Desk · Membership→Mandaat · Rapporten→Dossiers. 10 files. Routes/slugs/SEO/type-unions NIET gewijzigd. |
| **PR #113** intake static summary | MERGED 17:25. `ReportSampleCard` compact-mode (naam+score+KPI's, geen PDF/slider/CTA) op object-indienen; bevat ook batch-2 Navbar/Footer naming (sweep). |
| **Domeinfix** commit `60575b9` | `.env.example`: `aquire.com`→`aquier.com` (SITE_URL + invite-redirect). Template-only. |

### Aquier — SEO / Growth / Revenue (DB-LIVE op shaunum)
| Item | Bewijs |
|---|---|
| **seo_pages live** | `public.seo_pages` = **274 rijen, allemaal `published`** (vastgoed 79 · beleggen 50 · vermogen 49 · sparen 48 · crypto 48). |
| **/kennisbank live** | `/gids`→`/kennisbank` rename **volledig** (geen gids-route/dir meer). 274 artikelen dynamisch uit DB. |
| **SEO Batch 1 + 2 + 3A** | Content **DB-live** (264→274). Commits op origin/main; docs `AQUIER_SEO_FACTORY_OUTPUT_BATCH1.md`. |
| **v_seo_revenue** | `vastgoed_core.v_seo_revenue` bestaat, **274 rijen**, 30 kolommen (sessions, revenue_per_session, revenue_rank…). |
| **v_seo_cta_gate** | `vastgoed_core.v_seo_cta_gate` bestaat, **274 rijen** (has_*_cta, conversion_path_ok). |
| **Intelligence Dashboard** | `app/dashboard/intelligence/*` **op origin/main** (attention-intelligence, migs 064–067). |
| **PostHog ingestie** | Wired + actief (browser `web` + `posthog-node`). UTM first-touch capture aanwezig. |
| **IndexNow cron** | PR #108 MERGED — `0 7 * * *` verkeer→indexatie. |
| **Membership-CTA op SEO-pagina's** | PR #109 MERGED — verkeer→membership-weg. |

### Orlando Core OS — YouTube-engine (BESTAAND, LIVE)
| Item | Bewijs |
|---|---|
| **Upload engine ACTIEF** | `youtube_upload_queue`: 712 verified_live · laatste upload 2026-06-08 20:02 UTC · **377 uploads/7d**. 11/11 kanalen OAuth connected. BullMQ-fleet onder PM2. |
| **Content-crons autonoom** | 14 actieve `vc-*` pg_cron jobs (run-pipeline 02:00, sync-stats, trend/viral-scan, content_radar_calendar */20) + in-process crons. 257 pipeline-runs. |
| **CF2 spine migratie 153 LIVE** | `20260608183306_content_factory_2` toegepast: 7 spine-tabellen + `youtube_quality_scores`-uitbreiding + `v_video_cqi`. (Schema staat; zie sectie B — nog 0× gedraaid.) |

### Orlando Core OS — Hermes Core OS v2
| Item | Bewijs |
|---|---|
| **PR #145/#146/#147** self-routing | MERGED 2026-06-08. Core OS v2 6-lagen + preflight + auto-dispatch op origin/main. |

---

## B. KLAAR MAAR NIET LIVE (gebouwd, niet gepromote / niet gedraaid)

| Item | Status | Bewijs / wat ontbreekt |
|---|---|---|
| **Deal Flow Card V3 (PR #116)** | OPEN **DRAFT** | Technical PASS (479/479 deals met alle 4 velden, tsc clean). **Visual validation PENDING** (screenshots). Bouwt op V2-shell, voegt read-only API-expansie + 5 type-velden toe. Niet mergen tot visueel akkoord. |
| **Deal Flow Card V2 (PR #115)** | OPEN **DRAFT** | Dossier-shell; **superseded door V3** (zie sectie D). Niet apart mergen. |
| **/admin/seo-revenue dashboard** | CODE-PRESENT, **NIET op main** | Op tak `seo-revenue-dashboard` (+ working branch). `page.tsx:120` GSC-connector TODO (impressies/CTR ontbreekt). Niet gepromote naar prod. |
| **CF2.0 hele pijplijn (PR #148)** | OPEN **DRAFT**, **0× gedraaid** | Migratie 153 live, alle local-agent libs (scene/audio/visual/render/thumbnail/music/learning) gebouwd + tsc clean. **Alle 7 spine-tabellen = 0 rijen.** `engine_schedule content:cf2-video-projects-runner` = `enabled=false`. Wacht op end-to-end shadow-run op live host. |
| **CF2 Fases A–H** | CODE-PRESENT, niet gedraaid | A visual · B render-ffmpeg · C QC-agents · D Quality Center · E thumbnail · F music · G gate-pass · H Quality Center UI. Alles op DRAFT-tak, niets gemerged, 0 runtime-rijen. |
| **CF2 Quality Center dashboard** | CODE-PRESENT | `dashboard/media-holding/content-quality-center` read-only (geen approve-knop). |

---

## C. OPEN BLOCKERS (echt blokkerend)

| # | Blocker | Detail / bewijs | Eigenaar-actie |
|---|---|---|---|
| **C1** | **Membership identity-gap** | `AQUIER_MEMBERSHIP_ENTITLEMENT_FORENSIC.md`: GEEN code-bug. Betaalde membership op guest-checkout `o.amatiskak@gmail.com` (active); ingelogde `o.amatiskak@icloud.com` = cancelled. Resolver geeft terecht `public`. = account-linking/guest-checkout gap. Fix-scope beschreven, **NIET uitgevoerd.** | Orlando: go op account-linking-fix (CLI-L bouw). |
| **C2** | **0 bewezen omzet / 0 active membership** | Elke betaalde record = refund/cancel-test. MRR-motor (active-delivery) nooit bewezen. | 1 echte E2E-betaling (laagste tier) → unlock → Moneybird-factuur. |
| **C3** | **CF2 shadow-run ontbreekt** | Alle spine-tabellen 0 rijen; runner `enabled=false`. Niet te draaien vanaf CLI-R (host-afhankelijk: LM Studio + lokale voice + Pexels op CLI-L). | Shadow-run op CLI-L draaien vóór PR #148 merge. |
| **C4** | **YouTube quality gate dood** | `youtube_quality_scores` = **0 rijen** over 257 pipeline-runs. `scoreVideo()` faalt stil (try/catch→null) door Anthropic-credits €0. Content gaat **ongefilterd** door; **geen approval-gate** vóór publish. | Anthropic-credits + gate herbevestigen; beslissen of ongegate autonome upload acceptabel is. |
| **C5** | **Visual screenshots Deal Flow Card** | V2/V3 niet visueel gevalideerd (`next build` lokaal geblokkeerd: gedeelde node_modules mist `pdf-lib`). | Screenshots in schone build-env. |
| **C6** | **Migratie 154 (learning-loop) niet toegepast** | Tabellen `video_performance_checkpoints` + `video_learning_summary` absent live; `learning-loop-worker.ts` inert. | Pas 154 als ADDITIVE migratie toe ná shadow-run (met go). |
| **C7** | **CF2 upload-protection chokepoint ontbreekt** | De orchestrator-gate (`upload-orchestrator.ts`) uit PR #149 is **niet overgenomen** in #148/main. Alleen writer-side `FORBIDDEN_STATUSES`-guard in #148. | FASE 3 upload-gate opnieuw wiren op canonieke spine (NIET via #149-code). |
| **C8** | **Tracking-attributie blind** | GA4+Meta-pixel = no-ops (wachten op keys, go-live gate). GTM afwezig. **YouTube-attributie MISSING.** GSC-impressies/CTR-connector = TODO. | Keys zetten ná go-live gate + GSC-connector bouwen. |
| **C9** | **Naming-firewall lek** | `components/conversion/FinancingLeadCTA.tsx`: **STRKBEHEER + STRKBOUW client-zichtbaar** (5 hits: succesmsg/consent/disclaimer). Waarschijnlijk bewuste Wft/AVG-disclosure maar schendt firewall-regel. | Orlando: bevestig of deze juridische disclosure een uitzondering is. |

---

## D. NIET OPNIEUW DOEN (verboden / afgerond / superseded)

| Verbod | Reden |
|---|---|
| ⛔ **Geen oude PR #149 CF2-spine toepassen** | #149 CLOSED 20:08 — Orlando-architectuurbeslissing. Tabellen `content_impact_weights`/`video_scores`/`video_attribution` + functie `approve_video_project` **absent live** en blijven dat. Branch = referentie, niet deleten, niet mergen. |
| ⛔ **Geen nieuwe CF2-spine bouwen** | Canoniek = `20260608183306_content_factory_2` (PR #148's 153). Alleen hierop verder bouwen. Geen duplicaat. |
| ⛔ **PR #114 niet opnieuw bouwen** | Naming-batch-2 (Navbar/Footer) zit al in main via #113 (commit `34b7d1c`). #114 gesloten als redundant. |
| ⛔ **Geen duplicate SEO-dashboard** | Intelligence-dashboard staat op main; seo-revenue-dashboard apart op tak — promoten, niet herbouwen. |
| ⛔ **Geen dashboard-deploy vanaf diverged branch** | Tak `feat/close-2b-seo-batch-script` = stale/diverged (0 ahead, mass-deletions). Niet gebruiken. `cli-r/content-packs` ook diverged. |
| ⛔ **Geen fake video-assets** | CF2 NO-MOCK: alles uit echte velden/render; geen placeholder-assets. |
| ⛔ **Geen upload zonder approval/gate** (CF2) | CF2-writer mag nooit naar approved/upload_ready/uploaded (`FORBIDDEN_STATUSES` hard guard). |
| ⛔ **Geen force-push** `docs/membership-entitlement-forensic` | Bevat andermans commit `1758c24`; forensisch doc bereikbaar via `c0f9f09`. Bij naar-main: nieuwe schone branch + cherry-pick alleen `c0f9f09`. |
| ✅ **SEO Batch 3B = strategie-doc, geen inserts** | `AQUIER_SEO_BATCH3_STRATEGY.md` is scoring-only; nog niet gegenereerd (bewust). |

---

## E. VOLGENDE 10 ACTIES (exacte volgorde)

| # | Actie | Eigenaar | Repo/route/bestand | Status nu | Bewijs nodig | Deploy? |
|---|---|---|---|---|---|---|
| 1 | **CF2 shadow-run draaien** (1 topic, geen upload) | CLI-L | `local-agent/src/video-projects-runner.ts` | enabled=false, 0 rijen | spine-tabellen >0 rijen + CQI-score gelogd | NEE (shadow) |
| 2 | **1 echte E2E-betaling** laagste tier → unlock → Moneybird | Orlando + CLI-L | Aquier checkout → `stripe_moneybird_invoices` | 0 betalingen ooit | completed+unlock+factuur-rij | JA (live, daarna evt. refund) |
| 3 | **Membership identity-gap fix** (account-linking) | CLI-L | resolver + guest-checkout flow | forensic klaar, fix niet gedaan | guest-checkout linkt aan ingelogd account | NEE tot review |
| 4 | **Anthropic-credits + YouTube quality-gate herstellen** | Orlando + CLI-R | `cron/run-pipeline` `scoreVideo()` | 0 scores/257 runs | `youtube_quality_scores` rijen >0 | n.v.t. (cron) |
| 5 | **Deal Flow Card V3 visual validatie** → merge #116 | CLI-R | PR #116 `DealCard.tsx` | DRAFT, tech PASS | screenshots vóór/na + `next build` PASS | NEE tot akkoord |
| 6 | **/admin/seo-revenue promoten** (na GSC-connector) | CLI-L | tak `seo-revenue-dashboard` | code, niet op main | merge naar main + prod 200 | JA (na connector) |
| 7 | **GSC-impressies/CTR-connector bouwen** | CLI-L | `app/admin/seo-revenue` API | TODO-marker | impressies/CTR in `v_seo_revenue` | NEE (data) |
| 8 | **CF2 migratie 154 (learning-loop) additive toepassen** | CLI-R | `154_content_factory_learning_loop.sql` | file-only, niet live | tabellen live + worker actief | ALLEEN na shadow-run + go |
| 9 | **CF2 upload-protection chokepoint herwiren** op canonieke spine | CLI-R | nieuwe `upload-orchestrator`-gate (NIET #149) | ontbreekt in main | gate blokkeert non-approved | NEE tot review |
| 10 | **Naming-firewall beslissing** FinancingLeadCTA (STRKBEHEER/STRKBOUW) | Orlando | `components/conversion/FinancingLeadCTA.tsx` | 5 client-hits | go/no-go als juridische uitzondering | NEE tot beslissing |

---

**Reconciliatie-eigenaar:** Hermes (CLI-R audit). **Bewijsbronnen:** GitHub PR-API (oamatiskak-star/aquire + orlando-core-os), Supabase shaunum (`public` + `vastgoed_core`), repo-code 2026-06-08.
