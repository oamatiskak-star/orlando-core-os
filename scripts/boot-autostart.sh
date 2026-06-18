#!/usr/bin/env bash
# Orlando autostart — draait bij login/boot (via LaunchAgent) en zorgt dat alle
# altijd-aan software/workers starten. Logt daarna de host + actieve workers bij
# Hermes (public.host_heartbeat) zodat zichtbaar is dat de machine weer online is.
#
# Secrets/identiteit komen uit ~/.orlando-env (NIET in de repo):
#   export MACHINE_ID=cli-r                       # of cli-l
#   export SUPABASE_SERVICE_ROLE_KEY=...          # service-role key
#   export SUPABASE_URL=https://...supabase.co    # optioneel (heeft default)
#   export ORLANDO_CORE_OS_DIR=$HOME/Code/orlando-core-os   # optioneel

set -uo pipefail
[ -f "$HOME/.orlando-env" ] && source "$HOME/.orlando-env"
: "${MACHINE_ID:?MACHINE_ID ontbreekt — zet in ~/.orlando-env}"
: "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY ontbreekt — zet in ~/.orlando-env}"
SUPABASE_URL="${SUPABASE_URL:-https://shaunumewswpxhmgbtvv.supabase.co}"
REPO="${ORLANDO_CORE_OS_DIR:-$HOME/Code/orlando-core-os}"
log(){ echo "[$(date '+%F %T')] $*"; }

# 0) wacht tot netwerk/Supabase bereikbaar is (max ~60s)
for _ in $(seq 1 30); do
  curl -sf -m 3 "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" >/dev/null 2>&1 && break
  sleep 2
done

# 1) Altijd-aan infrastructuur (best-effort, alleen wat aanwezig is)
if [ "$MACHINE_ID" = "cli-r" ] && command -v colima >/dev/null 2>&1; then
  colima status >/dev/null 2>&1 || { log "colima start"; colima start >/dev/null 2>&1 & }
fi
if command -v ollama >/dev/null 2>&1; then
  pgrep -x ollama >/dev/null 2>&1 || { log "ollama serve"; (ollama serve >/dev/null 2>&1 &) ; }
fi

# 2) PM2 — herstel + ecosystem-fallback als resurrect onvoldoende oplevert
if command -v pm2 >/dev/null 2>&1; then
  pm2 resurrect >/dev/null 2>&1 || true

  # Tel online processen; als < 3 → start vanuit de juiste ecosystem
  ONLINE=0
  if command -v jq >/dev/null 2>&1; then
    ONLINE=$(pm2 jlist 2>/dev/null | jq '[.[] | select(.pm2_env.status=="online")] | length' 2>/dev/null || echo 0)
  fi
  if [ "${ONLINE:-0}" -lt 3 ]; then
    log "PM2 te weinig processen online ($ONLINE) — start vanuit ecosystem"
    if [ "$MACHINE_ID" = "cli-r" ]; then
      pm2 start "$REPO/ecosystem.cli-r.config.js" >/dev/null 2>&1 || true
    else
      pm2 start "$REPO/ecosystem.config.js" >/dev/null 2>&1 || true
    fi
  fi

  # Garandeer de resume-listener van deze host
  pm2 describe "resume-listener-$MACHINE_ID" >/dev/null 2>&1 || \
    pm2 start "$REPO/scripts/ecosystem.resume-listener.config.js" --only "resume-listener-$MACHINE_ID" >/dev/null 2>&1 || true

  # Garandeer ruflo-dispatcher + ruflo-swarm-orchestrator (nieuw 2026-06-18)
  if [ "$MACHINE_ID" = "cli-r" ]; then
    pm2 describe ruflo-dispatcher >/dev/null 2>&1 || \
      pm2 start "$REPO/ecosystem.config.js" --only ruflo-dispatcher >/dev/null 2>&1 || true
    pm2 describe ruflo-swarm-orchestrator >/dev/null 2>&1 || \
      pm2 start "$REPO/ecosystem.config.js" --only ruflo-swarm-orchestrator >/dev/null 2>&1 || true
    pm2 describe apify-engine >/dev/null 2>&1 || \
      pm2 start "$REPO/ecosystem.config.js" --only apify-engine >/dev/null 2>&1 || true
  fi

  pm2 save >/dev/null 2>&1 || true
  log "PM2 online: $(pm2 jlist 2>/dev/null | jq '[.[] | select(.pm2_env.status=="online")] | length' 2>/dev/null || echo '?') processen"
fi

# 3) Verzamel actieve workers en log de host online bij Hermes
workers="[]"
if command -v pm2 >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  workers="$(pm2 jlist 2>/dev/null | jq -c '[.[] | select(.pm2_env.status=="online") | .name]' 2>/dev/null || echo '[]')"
fi
curl -sf -m 10 -X POST "$SUPABASE_URL/rest/v1/rpc/host_heartbeat" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"p_machine\":\"$MACHINE_ID\",\"p_workers\":$workers,\"p_note\":\"$MACHINE_ID online na herstart\"}" >/dev/null 2>&1 \
  && log "host.online gelogd bij Hermes — workers: $workers" \
  || log "WAARSCHUWING: kon host_heartbeat niet bereiken"

log "autostart klaar voor $MACHINE_ID"
