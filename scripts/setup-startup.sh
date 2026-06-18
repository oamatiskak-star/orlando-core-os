#!/usr/bin/env bash
# Orlando Core OS — eenmalige startup-installatie voor CLI L (macOS) en CLI R (Linux).
#
# Gebruik:
#   bash scripts/setup-startup.sh            # CLI L (default)
#   ORLANDO_HOST=cli-r bash scripts/setup-startup.sh  # CLI R
#
# Vereisten:
#   - ~/.orlando-env met MACHINE_ID, SUPABASE_SERVICE_ROLE_KEY, ORLANDO_CORE_OS_DIR
#   - npm/node + pm2 geïnstalleerd (npm install -g pm2)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/.." && pwd)"
OS="$(uname)"
HOST="${ORLANDO_HOST:-${MACHINE_ID:-cli-l}}"

log() { echo "[$(date '+%F %T')] $*"; }

log "Orlando startup setup — OS=$OS HOST=$HOST REPO=$REPO"

# ── ~/.orlando-env check ──────────────────────────────────────────────────────
if [ -f "$HOME/.orlando-env" ]; then
  # shellcheck disable=SC1091
  source "$HOME/.orlando-env"
  log "~/.orlando-env geladen ✓"
else
  log "WAARSCHUWING: ~/.orlando-env niet gevonden. Maak aan:"
  echo "  cat > ~/.orlando-env << 'EOF'"
  echo "  export MACHINE_ID=$HOST"
  echo "  export SUPABASE_SERVICE_ROLE_KEY=<jouw-key>"
  echo "  export ORLANDO_CORE_OS_DIR=$REPO"
  echo "  EOF"
  echo ""
fi

# ── Ecosystem kiezen ──────────────────────────────────────────────────────────
if [ "$HOST" = "cli-r" ]; then
  ECO="$REPO/ecosystem.cli-r.config.js"
else
  ECO="$REPO/ecosystem.config.js"
fi
log "Ecosystem: $ECO"

# ── PM2 check ─────────────────────────────────────────────────────────────────
if ! command -v pm2 >/dev/null 2>&1; then
  log "PM2 niet gevonden — installeren..."
  npm install -g pm2
fi

# ── 1. PM2 startup (systemd/launchd daemon) ───────────────────────────────────
log "PM2 startup genereren..."
PM2_STARTUP_CMD=$(pm2 startup 2>&1 | grep -E "^\s*(sudo env|sudo systemctl|launchctl)" | head -1 | xargs || echo "")
if [ -n "$PM2_STARTUP_CMD" ]; then
  echo ""
  echo "┌─────────────────────────────────────────────────────────────────┐"
  echo "│  Voer dit commando uit (vereist sudo):                          │"
  echo "│  $PM2_STARTUP_CMD"
  echo "└─────────────────────────────────────────────────────────────────┘"
  echo ""
  read -rp "Druk ENTER nadat je bovenstaand commando hebt uitgevoerd... "
fi

# ── 2. PM2 processen starten en opslaan ──────────────────────────────────────
log "PM2 processen starten vanuit $ECO..."
pm2 start "$ECO" 2>/dev/null || true
pm2 save --force
log "PM2 dump opgeslagen: ~/.pm2/dump.pm2 ✓"

# ── 3a. macOS — LaunchAgent ───────────────────────────────────────────────────
if [ "$OS" = "Darwin" ]; then
  PLIST_SRC="$REPO/scripts/com.orlando.autostart.plist"
  PLIST_DST="$HOME/Library/LaunchAgents/com.orlando.autostart.plist"
  log "macOS: LaunchAgent installeren → $PLIST_DST"

  # Vervang pad in plist naar de werkelijke repo-locatie
  sed "s|\\\$HOME/Code/orlando-core-os|$REPO|g; s|/Users/[^/]*/Code/orlando-core-os|$REPO|g" \
    "$PLIST_SRC" > "$PLIST_DST"

  launchctl unload -w "$PLIST_DST" 2>/dev/null || true
  launchctl load -w "$PLIST_DST"
  log "LaunchAgent geladen: com.orlando.autostart ✓"
fi

# ── 3b. Linux — systemd user service ─────────────────────────────────────────
if [ "$OS" = "Linux" ]; then
  SERVICE_SRC="$REPO/scripts/orlando-autostart.service"
  SERVICE_DST="$HOME/.config/systemd/user/orlando-autostart.service"
  log "Linux: systemd user service installeren → $SERVICE_DST"
  mkdir -p "$(dirname "$SERVICE_DST")"

  # Vervang REPO_PATH placeholder door werkelijk pad
  sed "s|REPO_PATH|$REPO|g" "$SERVICE_SRC" > "$SERVICE_DST"

  systemctl --user daemon-reload
  systemctl --user enable orlando-autostart.service
  systemctl --user start orlando-autostart.service

  # Lingering: start service ook zonder actieve login-sessie (server-use)
  loginctl enable-linger "$(whoami)" 2>/dev/null \
    && log "loginctl linger ingeschakeld ✓" \
    || log "WAARSCHUWING: loginctl enable-linger mislukt (sudo nodig?)"

  log "systemd service actief: orlando-autostart ✓"
fi

echo ""
log "✅ Setup klaar voor $HOST"
log "   Na reboot: PM2 + engines starten automatisch"
log "   Handmatig testen: bash $REPO/scripts/boot-autostart.sh"
log "   PM2 status: pm2 status"
log "   Logs:       pm2 logs"
