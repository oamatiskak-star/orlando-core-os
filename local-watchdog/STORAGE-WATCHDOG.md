# Storage Watchdog — CLI-R / CLI-L

Storage-saturatie preventie, ingebouwd in de bestaande `local-watchdog` (PM2, poort 3007).
Module: `src/storage-guard.ts` — hergebruikt de bestaande Telegram-laag (`src/telegram.ts`).

---

## Incident 2026-05-27 (CLI-R) — opgelost

**Symptoom:** interne SSD 99% vol (5,9 GB vrij), load average 9, Docker-daemon vastgelopen.

**Root cause:** container `openclaw-mission-control-webhook-worker-1` zat in een crash-loop
(`redis.exceptions.ConnectionError: Error -2 connecting to redis:6379` — zijn Redis stond
8 dagen `exited`). Log-driver `json-file` **zonder** size-limiet → één `*-json.log` van **129 GB**
in ~8 dagen. Dat vulde de Docker.raw (147 GB) en daarmee de hele SSD.

**Fix (veilig, geen dataverlies, geen actieve worker verwijderd):**
1. npm-cache + Claude-caches geleegd → 5,9 → 11 GB lucht.
2. Docker schoon herstart (wedged VM/CPU-storm gestopt).
3. `docker builder prune -f` + `docker image prune -f` (alleen build-cache + dangling).
4. Crash-loop-worker **gestopt** (`docker stop`, reversibel) + 129 GB log getrunceerd.
5. `fstrim /var/lib/docker` → Docker.raw **147 GB → 14 GB**.

**Resultaat:** host **99% → 67%**, vrij **5,9 → 145 GB**, ~133 GB teruggewonnen.

**Permanente preventie:** `~/.docker/daemon.json` → globale log-rotatie
(`log-opts: max-size=50m, max-file=5`). Geldt voor nieuw aangemaakte/herstartte containers.

---

## Storage-guard werking

Draait op eigen interval (`STORAGE_INTERVAL_MS`, default 5 min) binnen de watchdog.

1. **Hard runaway-log guard (altijd):** elke container-`json.log` > `STORAGE_HARD_LOG_MB` (2 GB)
   wordt getrunceerd + `fstrim`. Vangt exact het incident hierboven, ongeacht diskdruk.
2. **Drempels (df op `/System/Volumes/Data`):**
   - **≥70%** (warn): Telegram-waarschuwing, geen actie.
   - **≥80%** (aggressive): logs > 500 MB truncaten + safe prune + fstrim.
   - **≥90%** (emergency): logs > 100 MB truncaten + safe prune + fstrim.
3. **Veilig per ontwerp:** nooit volumes, nooit actieve images, nooit container-verwijdering.
   Alleen: build-cache, dangling images, oversized stdout/stderr-logs.

Status zichtbaar via `curl http://127.0.0.1:3007/health` → veld `storage`.

### Config (env, met defaults — overschrijfbaar in `.env.cli-r`)
| Var | Default | Betekenis |
|---|---|---|
| `STORAGE_GUARD_ENABLED` | `1` | 0 = uit |
| `STORAGE_INTERVAL_MS` | `300000` | checkinterval |
| `STORAGE_DATA_VOLUME` | `/System/Volumes/Data` | te monitoren volume |
| `STORAGE_WARN_PCT` / `_AGGRESSIVE_PCT` / `_EMERGENCY_PCT` | `70` / `80` / `90` | drempels |
| `STORAGE_HARD_LOG_MB` | `2000` | runaway-log grens |
| `STORAGE_AGGRESSIVE_LOG_MB` / `_EMERGENCY_LOG_MB` | `500` / `100` | log-truncatie per tier |
| `STORAGE_ALERT_COOLDOWN_MS` | `1800000` | anti-spam per alert |

---

## Handmatige noodherstel (als de SSD ooit weer vol loopt)

```bash
# 1. grootste container-logs vinden (binnen de Docker-VM)
docker run --rm --privileged --pid=host alpine \
  nsenter -t 1 -m -u -i -n sh -c \
  'du -sh /var/lib/docker/containers/*/*-json.log 2>/dev/null | sort -rh | head'

# 2. specifieke log legen (vervang <id>)
docker run --rm --privileged --pid=host alpine \
  nsenter -t 1 -m -u -i -n sh -c \
  'truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log'

# 3. ruimte teruggeven aan host (krimpt Docker.raw)
docker run --rm --privileged --pid=host alpine \
  nsenter -t 1 -m -u -i -n fstrim /var/lib/docker

# 4. veilige prune (nooit volumes!)
docker builder prune -f && docker image prune -f
```

---

## Open punten (NIET opgelost — vereisen beslissing/actie)

- **`WATCHDOG_HOST_ID=cli-l` op CLI-R:** alerts vanaf CLI-R worden gelabeld "cli-l". Corrigeren in `.env.cli-r`.
- **Repo-duplicatie:** draaiende code = `~/Github/orlando-core-os/`; er staat een tweede kopie in `~/Code/orlando-core-os/`. Eén bron van waarheid kiezen.
- **CLI-L SSH:** host-key gefixt, maar mijn key staat nog niet op CLI-L → `ssh-copy-id bouwproffsnederlandbv@cli-l.local`. Daarna kan deze guard ook op CLI-L worden uitgerold.
- **T7 = SMB-share vanaf CLI-L + bevat bedrijfsdocumenten.** Geschikt voor gedeelde datasets/reports (`/Volumes/T7/T7 AI SSD/`), NIET voor Docker.raw of mmap'd modellen op CLI-R. Aparte lokale AI-SSD aanbevolen voor echte gedeelde model-/Docker-infra.
- **openclaw mission-control stack** staat grotendeels `exited` (redis/db/backend/frontend). Beslis: opruimen of weer volledig opstarten.
