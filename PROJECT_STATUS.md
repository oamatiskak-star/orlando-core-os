# Orlando Core OS — PROJECT_STATUS

> **Sessie protocol** (CLAUDE.md): Lees dit bestand bij elke nieuwe Claude Code sessie. Update na elke voltooide taak. Houd het herstel-blok actueel.

**Laatste update:** 2026-05-20

---

## 🔴 HERSTEL HIER NA CRASH

**Sessie focus**: Media Holding OS — Viral Intelligence auto-trigger ingericht via Vercel cron `/api/youtube/cron/autopilot-tick` (elke 4u). Wacht op eerstvolgende cron-firing om te valideren dat scanners weer data binnenhalen. Vóór die tijd kan handmatig worden getriggerd via `Start scan` knop op `/dashboard/media-holding/viral-intelligence`.

**Wat is gedaan in deze sessie:**
- ✅ Media Holding inhaalsprong (Settings, Analytics, Compete, Archives modules + API routes + migraties 073-075)
- ✅ Competitor Surveillance scanner-worker (gebouwd, gedeployed, paused — Orlando vindt Viral Intelligence afdoende)
- ✅ Workers UI live countdown ipv `paused` label
- ✅ Vercel cron `/api/youtube/cron/autopilot-tick` (vervangt manuele dispatch; triggert cron_dispatcher → viral + trend + audio scanners)

**Direct herstelbaar door:**
1. Trigger handmatige tick voor validatie: `curl -H "Authorization: Bearer $CRON_SECRET" https://<vercel-url>/api/youtube/cron/autopilot-tick`
2. Of via UI: `Start scan` op `/dashboard/media-holding/viral-intelligence`
3. Verifieer `viral_opportunities` rij-aanwas: `select count(*), max(captured_at) from viral_opportunities;`

---

## 📊 Module status

### Media Holding OS (6/6 fases completed, 23/23 modules live)

| Fase | Status | Voortgang |
|---|---|---|
| 1 — Cashflow First | ✅ Completed | 100% |
| 2 — Media Division Structuur | ✅ Completed | 100% |
| 3 — Dashboard & UX | ✅ Completed | 100% |
| 4 — AI System Behavior | ✅ Completed | 100% |
| 5 — Infrastructure Rules | ✅ Completed | 100% |
| 6 — Long Term Scale | ✅ Completed | 100% |

### Render services (deploy status)

| Service | Status |
|---|---|
| `orlando-youtube-engine` | ✅ Live |
| `orlando-executor` (planning-engine) | ✅ Live |
| `orlando-mail-engine` | ✅ Live |
| `orlando-competitor-scanner` | 🔄 Live maar Orlando wil suspenden (DB workers op `paused`) |
| `orlando-redis` | ✅ Live |

### Vercel crons (6 actief)

| Cron | Schedule | Doel |
|---|---|---|
| `refresh-tokens` | `0 5 * * *` | OAuth tokens vernieuwen |
| `sync-stats` | `0 8 * * *` | Channel/video stats syncen |
| `snapshot-daily-stats` | `55 23 * * *` | Dagelijkse snapshot |
| `run-pipeline` | `0 2 * * *` | Generatie/publish pipeline |
| `sync-video-analytics` | `0 10 * * *` | Analytics syncen |
| `autopilot-tick` | `0 */4 * * *` | **Nieuw** — triggert viral + trend + audio scanners |

---

## ⏳ Open / Aandachtspunten

1. **Render: orlando-competitor-scanner suspenden** — Orlando kiest expliciet voor Viral Intelligence ipv per-kanaal monitoring. Service nog niet gesuspend, kost ~$7/mo.
2. **Eerste autopilot-tick na deploy** — validatie nodig: heeft `viral_opportunities` 4u na deploy nieuwe rijen?
3. **Viral-scanner-tiktok** — status `offline`, nooit gebouwd. Geen TikTok publieke API met API-key zoals YouTube Data API v3. Out of scope tenzij scraping/3rd-party gebruikt wordt.

---

## 📁 Code locaties (referentie)

- **Frontend (Next.js / Vercel)**: `frontend/`
- **YouTube engine + competitor scanner (Render)**: `youtube-engine/`
- **Orchestrator/executor (Render)**: `planning-engine/`
- **Mail engine (Render)**: `mail-engine/`
- **Database migraties (Supabase)**: `supabase/migrations/`
- **Deploy config**: `vercel.json`, `render.yaml`, `youtube-engine/docker-compose.yml`
- **Master plan**: `MASTER_BUILD_PLAN.md`

---

## 🗂️ Commit-stijl

`feat(scope): korte beschrijving` — body in NL, korte zinnen. Eindigt met `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` voor Claude-bijdragen.
