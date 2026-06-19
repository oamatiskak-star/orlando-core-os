#!/usr/bin/env bash
#
# Eén commando: start (indien nodig) een debug-Chrome en laat de LLM-browser-agent
# de gerichte aanmeld-lijst afwerken. De debug-Chrome gebruikt een apart profiel
# (~/.orlando-chrome-debug) en laat je gewone Chrome + tabs met rust.
#
#   bash scripts/run-affiliate-agent.sh              # hele gerichte lijst (Groep B + C)
#   bash scripts/run-affiliate-agent.sh --url <URL>  # één specifieke aanmelding
#   AUTO_SUBMIT=1 bash scripts/run-affiliate-agent.sh # ook de finale knop zelf klikken
set -euo pipefail

PORT="${PORT:-9222}"
DEBUG_DIR="$HOME/.orlando-chrome-debug"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
REPO="$HOME/Github/orlando-core-os"

# laad SUPABASE/ANTHROPIC/OLLAMA env zodat de agent de lijst + brein heeft
[ -f "$HOME/.orlando-env" ] && { set -a; . "$HOME/.orlando-env"; set +a; }

if ! curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
  echo "Start debug-Chrome op poort $PORT (apart profiel, je gewone Chrome blijft open)…"
  "$CHROME" --remote-debugging-port="$PORT" --user-data-dir="$DEBUG_DIR" \
    --no-first-run --no-default-browser-check about:blank >/tmp/chrome-debug.log 2>&1 &
  curl -s --retry 25 --retry-delay 1 --retry-connrefused "http://127.0.0.1:$PORT/json/version" >/dev/null
  echo "Chrome klaar."
fi

# breng het Chrome-venster naar de voorgrond zodat je de agent ziet werken
osascript -e 'tell application "Google Chrome" to activate' >/dev/null 2>&1 || true
echo "→ Kijk naar het Chrome-venster; de prompts staan hieronder in deze Terminal."

cd "$REPO/local-agent"
exec npx ts-node --transpile-only src/browser-agent.ts "$@"
